// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17 <0.9.0;

import "forge-std/Test.sol";
import { ProxyDeployer } from "../../script/lib/ProxyDeployer.sol";

interface IAC {
    function hasRole(bytes32 role, address account) external view returns (bool);
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
    function renounceRole(bytes32 role, address account) external;
}

/// @notice The duty table, enforced: each privileged function reverts for the operator EOA and for every Safe
///         except the right one, MINTER_ROLE and FUNDER_ROLE can never meet on one address, the guardian can
///         pause but not unpause, and the data operator holds no governance role.
contract RoleSegregationTest is Test, ProxyDeployer {
    bytes4 internal constant SEGREGATION = bytes4(keccak256("SegregationOfDuties(address)"));

    address internal gov = makeAddr("govSafe");
    address internal treasury = makeAddr("treasurySafe");
    address internal minting = makeAddr("mintingSafe");
    address internal compliance = makeAddr("complianceSafe");
    address internal guardian = makeAddr("guardianSafe");
    address internal operator = makeAddr("operatorEOA"); // data posts only
    address internal dummy = makeAddr("dummy");

    address internal usdc;
    address internal anchor;
    address internal ledger;
    address internal series;
    address internal dist;

    bytes32 internal MINTER = keccak256("MINTER_ROLE");
    bytes32 internal FUNDER = keccak256("FUNDER_ROLE");
    bytes32 internal FX = keccak256("FX_ROLE");
    bytes32 internal ADMIN = keccak256("ADMIN_ROLE");
    bytes32 internal GUARDIAN = keccak256("GUARDIAN_ROLE");
    bytes32 internal DEFAULT_ADMIN = 0x00;

    function setUp() public {
        beaconOwner = gov;
        usdc = vm.deployCode("MockUSDC.sol:MockUSDC");
        // Initialised the way the deploy does: the deployer (here: this test) is admin, then roles are wired.
        anchor = _deployProxy("LedgerAnchor.sol:LedgerAnchor", abi.encodeWithSignature("initialize(uint256,address,address)", 42, operator, address(this)));
        ledger = _deployProxy(
            "DepositoPoolLedger.sol:DepositoPoolLedger",
            abi.encodeWithSignature("initialize(uint256,bytes32,address,address)", 42, keccak256("s"), operator, address(this))
        );
        series = _deployProxy(
            "TawfDepositoSeries.sol:TawfDepositoSeries",
            abi.encodePacked(
                bytes4(keccak256("initialize(address,address,address,address,address,(bytes32,uint8,uint16),address,address,address,uint64)")),
                abi.encode(anchor, dummy, dummy, dummy, dummy, keccak256("s"), uint8(3), uint16(6000), treasury, address(this), operator, uint64(1 days))
            )
        );
        address[] memory coins = new address[](1);
        coins[0] = usdc;
        dist = _deployProxy(
            "SukukDistributor.sol:SukukDistributor",
            abi.encodePacked(
                bytes4(keccak256("initialize(address[],address,address,address,address,(bytes32,uint256,uint40,uint256,uint256,uint40,address),address)")),
                abi.encode(coins, anchor, dummy, dummy, dummy, keccak256("k"), uint256(1_000e6), uint40(block.timestamp + 365 days), uint256(100e6), uint256(10e6), uint40(30 days), treasury, address(this))
            )
        );

        // Wire the duty table (what DeployAll does), then drop the deployer's own admin rights.
        IAC(series).grantRole(GUARDIAN, guardian);
        IAC(ledger).grantRole(GUARDIAN, guardian);
        IAC(series).grantRole(MINTER, minting);
        IAC(series).grantRole(FUNDER, treasury);
        IAC(series).grantRole(DEFAULT_ADMIN, gov);
        IAC(series).grantRole(ADMIN, gov);
        IAC(series).revokeRole(ADMIN, address(this));
        IAC(series).renounceRole(DEFAULT_ADMIN, address(this));

        IAC(dist).grantRole(FUNDER, treasury);
        IAC(dist).grantRole(GUARDIAN, guardian);
        IAC(dist).grantRole(DEFAULT_ADMIN, gov);
        IAC(dist).grantRole(ADMIN, gov);
        IAC(dist).revokeRole(FUNDER, address(this));
        IAC(dist).revokeRole(ADMIN, address(this));
        IAC(dist).renounceRole(DEFAULT_ADMIN, address(this));

        IAC(ledger).grantRole(DEFAULT_ADMIN, gov);
        IAC(ledger).renounceRole(DEFAULT_ADMIN, address(this));
        IAC(anchor).grantRole(DEFAULT_ADMIN, gov);
        IAC(anchor).renounceRole(DEFAULT_ADMIN, address(this));
    }

    function _reverts(address caller, address target, bytes memory data) internal returns (bool) {
        vm.prank(caller);
        (bool ok,) = target.call(data);
        return !ok;
    }

    // ---- the data operator holds nothing but data roles ----

    function test_operatorHoldsOnlyTheFxRole() public view {
        assertTrue(IAC(series).hasRole(FX, operator));
        assertFalse(IAC(series).hasRole(MINTER, operator));
        assertFalse(IAC(series).hasRole(FUNDER, operator));
        assertFalse(IAC(series).hasRole(ADMIN, operator));
        assertFalse(IAC(series).hasRole(DEFAULT_ADMIN, operator));
        assertFalse(IAC(dist).hasRole(FUNDER, operator));
        assertFalse(IAC(dist).hasRole(ADMIN, operator));
        assertFalse(IAC(dist).hasRole(DEFAULT_ADMIN, operator));
        assertFalse(IAC(ledger).hasRole(DEFAULT_ADMIN, operator));
        assertFalse(IAC(anchor).hasRole(DEFAULT_ADMIN, operator));
        // The deployer left no admin behind either.
        assertFalse(IAC(series).hasRole(DEFAULT_ADMIN, address(this)));
        assertFalse(IAC(dist).hasRole(DEFAULT_ADMIN, address(this)));
    }

    // ---- minting is the Minting Safe only ----

    function test_allocate_onlyTheMintingSafe() public {
        bytes memory call = abi.encodeWithSignature("allocate(address[],uint256,uint64,uint256,bytes32[])", new address[](0), 0, uint64(0), 0, new bytes32[](0));
        address[6] memory others = [operator, treasury, compliance, guardian, gov, address(this)];
        for (uint256 i; i < others.length; i++) assertTrue(_reverts(others[i], series, call), "a non-minter could allocate");
        // The minting Safe passes the role check (and reverts later for its own reasons, not an access error).
        vm.prank(minting);
        (, bytes memory err) = series.call(call);
        assertTrue(err.length < 4 || bytes4(err) != bytes4(keccak256("AccessControlUnauthorizedAccount(address,bytes32)")));
    }

    // ---- money commitments are the Treasury Safe only ----

    function test_distributeAndMaturity_onlyTheTreasurySafe() public {
        bytes memory dp = abi.encodeWithSignature("distributeProfit(uint32,uint256,uint256,bytes32[])", uint32(1), 0, 0, new bytes32[](0));
        bytes memory sm = abi.encodeWithSignature("settleMaturity(uint64,uint32,uint256,uint256,bytes32[])", uint64(0), uint32(0), 0, 0, new bytes32[](0));
        address[6] memory others = [operator, minting, compliance, guardian, gov, address(this)];
        for (uint256 i; i < others.length; i++) {
            assertTrue(_reverts(others[i], series, dp), "a non-funder could distribute");
            assertTrue(_reverts(others[i], series, sm), "a non-funder could settle maturity");
        }
    }

    function test_distributorMoneyOut_onlyTheTreasurySafe() public {
        bytes memory close = abi.encodeWithSignature("closeSubscription()");
        bytes memory sweep = abi.encodeWithSignature("sweepUnclaimed()");
        bytes memory release = abi.encodeWithSignature("releaseHeldProfit(uint16,address,uint256,uint256,bytes32[])", uint16(1), usdc, 1, 0, new bytes32[](0));
        address[6] memory others = [operator, minting, compliance, guardian, gov, address(this)];
        for (uint256 i; i < others.length; i++) {
            assertTrue(_reverts(others[i], dist, close), "closeSubscription needs the treasury");
            assertTrue(_reverts(others[i], dist, sweep), "sweep needs the treasury");
            assertTrue(_reverts(others[i], dist, release), "release needs the treasury");
        }
    }

    // ---- segregation of duties ----

    function test_minterAndFunderNeverMeet() public {
        // The Treasury Safe cannot also mint, the Minting Safe cannot also fund, on the series. By anyone, in any order.
        vm.prank(gov);
        vm.expectRevert(abi.encodeWithSelector(SEGREGATION, treasury));
        IAC(series).grantRole(MINTER, treasury);
        vm.prank(gov);
        vm.expectRevert(abi.encodeWithSelector(SEGREGATION, minting));
        IAC(series).grantRole(FUNDER, minting);
        // A fresh address can hold one but not both.
        address fresh = makeAddr("fresh");
        vm.startPrank(gov);
        IAC(series).grantRole(MINTER, fresh);
        vm.expectRevert(abi.encodeWithSelector(SEGREGATION, fresh));
        IAC(series).grantRole(FUNDER, fresh);
        vm.stopPrank();
    }

    // ---- guardian: pause only, never unpause, never mint ----

    function test_guardianPausesButCannotUnpauseOrMint() public {
        address[3] memory targets = [series, dist, ledger];
        for (uint256 i; i < 3; i++) {
            assertFalse(_reverts(guardian, targets[i], abi.encodeWithSignature("pause()")), "the guardian could not pause");
            assertTrue(_reverts(guardian, targets[i], abi.encodeWithSignature("unpause()")), "the guardian could unpause");
            assertFalse(_reverts(gov, targets[i], abi.encodeWithSignature("unpause()")), "governance could not unpause");
            // Nobody else can pause.
            assertTrue(_reverts(operator, targets[i], abi.encodeWithSignature("pause()")));
            assertTrue(_reverts(treasury, targets[i], abi.encodeWithSignature("pause()")));
            assertTrue(_reverts(minting, targets[i], abi.encodeWithSignature("pause()")));
        }
        // The guardian holds neither mint nor money roles.
        assertFalse(IAC(series).hasRole(MINTER, guardian));
        assertFalse(IAC(series).hasRole(FUNDER, guardian));
        assertFalse(IAC(dist).hasRole(FUNDER, guardian));
        bytes memory alloc = abi.encodeWithSignature("allocate(address[],uint256,uint64,uint256,bytes32[])", new address[](0), 0, uint64(0), 0, new bytes32[](0));
        assertTrue(_reverts(guardian, series, alloc), "the guardian could mint");
    }

    function test_pauseBlocksMoneyPathsButNotTheExits() public {
        vm.prank(guardian);
        series.call(abi.encodeWithSignature("pause()"));
        // Allocate and distribute are blocked by the pause even for the right Safe.
        vm.prank(minting);
        (bool ok, bytes memory err) = series.call(abi.encodeWithSignature("allocate(address[],uint256,uint64,uint256,bytes32[])", new address[](0), 0, uint64(0), 0, new bytes32[](0)));
        assertFalse(ok);
        assertEq(bytes4(err), bytes4(keccak256("EnforcedPause()")));
        // cancelSubscription stays reachable while paused: it fails for its own reason (no pending), not the pause.
        vm.prank(dummy);
        (ok, err) = series.call(abi.encodeWithSignature("cancelSubscription(address)", usdc));
        assertTrue(bytes4(err) != bytes4(keccak256("EnforcedPause()")));
    }

    // ---- governance-only configuration ----

    function test_configuration_isGovernanceOnly() public {
        bytes[5] memory seriesCalls = [
            abi.encodeWithSignature("addStablecoin(address)", usdc),
            abi.encodeWithSignature("removeStablecoin(address)", usdc),
            abi.encodeWithSignature("setTreasury(address)", dummy),
            abi.encodeWithSignature("setTawfShare(uint16,address)", uint16(1000), dummy),
            abi.encodeWithSignature("setMaxRateAge(uint64)", uint64(1 days))
        ];
        address[5] memory others = [operator, minting, treasury, compliance, guardian];
        for (uint256 i; i < seriesCalls.length; i++) {
            for (uint256 j; j < others.length; j++) assertTrue(_reverts(others[j], series, seriesCalls[i]), "series config not governance only");
        }
        // Banks and the operator key (ledger and anchor) are governance only.
        for (uint256 j; j < others.length; j++) {
            assertTrue(_reverts(others[j], ledger, abi.encodeWithSignature("addBank(bytes32,string,string)", keccak256("b"), "n", "r")));
            assertTrue(_reverts(others[j], ledger, abi.encodeWithSignature("transferOperator(address)", dummy)));
            assertTrue(_reverts(others[j], anchor, abi.encodeWithSignature("transferOperator(address)", dummy)));
        }
        assertTrue(_reverts(operator, ledger, abi.encodeWithSignature("addBank(bytes32,string,string)", keccak256("b"), "n", "r")));
        assertFalse(_reverts(gov, ledger, abi.encodeWithSignature("addBank(bytes32,string,string)", keccak256("b"), "n", "r")));
    }

    // ---- data posts stay with the operator ----

    function test_dataPosts_areTheOperators() public {
        assertFalse(_reverts(operator, anchor, abi.encodeWithSignature("push(bytes32)", bytes32(uint256(1)))));
        assertTrue(_reverts(gov, anchor, abi.encodeWithSignature("push(bytes32)", bytes32(uint256(1)))));
        assertTrue(_reverts(treasury, anchor, abi.encodeWithSignature("push(bytes32)", bytes32(uint256(1)))));
    }
}
