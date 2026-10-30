// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17 <0.9.0;

import "forge-std/Test.sol";
import { ProxyDeployer } from "../../script/lib/ProxyDeployer.sol";

interface IUpgradeable {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    function hasRole(bytes32 role, address account) external view returns (bool);
    function grantRole(bytes32 role, address account) external;
    function UPGRADER_ROLE() external view returns (bytes32);
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
}

interface IV2 {
    function version() external view returns (uint256);
    function extra() external view returns (uint256);
    function setExtra(uint256 v) external;
}

/// @notice UUPS behaviour of the four Tawf contracts that moved behind proxies: locked
///         implementations, one initialisation, upgrades gated to the timelock, state kept across an
///         upgrade, and the new storage field working. Initialisation only needs non-zero addresses
///         and a ledger that answers ledgerChainId, so no T-REX suite is set up here.
contract OurContractsUpgradeTest is Test, ProxyDeployer {
    bytes32 internal constant IMPL_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes4 internal constant INVALID_INIT = 0xf92ee8a9; // Initializable.InvalidInitialization()

    address internal timelock = makeAddr("timelock");
    address internal operator = makeAddr("operator");
    address internal stranger = makeAddr("stranger");
    address internal dummy = makeAddr("dummy");

    address internal anchor;
    address internal ledger;
    address internal series;
    address internal dist;
    address internal usdc;

    bytes internal anchorInit;
    bytes internal ledgerInit;
    bytes internal seriesInit;
    bytes internal distInit;

    function setUp() public {
        anchorInit = abi.encodeWithSignature("initialize(uint256,address,address)", 42, operator, timelock);
        anchor = _deployProxy("LedgerAnchor.sol:LedgerAnchor", anchorInit);

        ledgerInit = abi.encodeWithSignature(
            "initialize(uint256,bytes32,address,address)", 42, keccak256("series"), operator, timelock
        );
        ledger = _deployProxy("DepositoPoolLedger.sol:DepositoPoolLedger", ledgerInit);

        seriesInit = abi.encodePacked(
            bytes4(keccak256("initialize(address,address,address,address,address,(bytes32,uint8,uint16),address,address,address,uint64,address)")),
            abi.encode(
                anchor, dummy, dummy, dummy, dummy, keccak256("series"), uint8(3), uint16(6000), operator, operator, operator,
                uint64(1 days), timelock
            )
        );
        series = _deployProxy("TawfDepositoSeries.sol:TawfDepositoSeries", seriesInit);

        usdc = vm.deployCode("MockUSDC.sol:MockUSDC");
        address[] memory coins = new address[](1);
        coins[0] = usdc;
        distInit = abi.encodePacked(
            bytes4(keccak256("initialize(address[],address,address,address,address,(bytes32,uint256,uint40,uint256,uint256,uint40,address),address,address)")),
            abi.encode(
                coins, anchor, dummy, dummy, dummy, keccak256("sukuk"), uint256(1_000e6), uint40(block.timestamp + 365 days),
                uint256(100e6), uint256(10e6), uint40(30 days), operator, operator, timelock
            )
        );
        dist = _deployProxy("SukukDistributor.sol:SukukDistributor", distInit);
    }

    function _all() internal view returns (address[4] memory a) {
        a[0] = anchor;
        a[1] = ledger;
        a[2] = series;
        a[3] = dist;
    }

    function _v2(uint256 i) internal returns (address) {
        string[4] memory names = [
            "UpgradeV2Mocks.sol:LedgerAnchorV2",
            "UpgradeV2Mocks.sol:DepositoPoolLedgerV2",
            "UpgradeV2Mocks.sol:TawfDepositoSeriesV2",
            "UpgradeV2Mocks.sol:SukukDistributorV2"
        ];
        return vm.deployCode(names[i]);
    }

    function _implOf(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, IMPL_SLOT))));
    }

    function test_proxiesPointAtAnImplementation() public view {
        address[4] memory all = _all();
        for (uint256 i; i < 4; i++) {
            assertTrue(_implOf(all[i]) != address(0));
            assertTrue(_implOf(all[i]) != all[i]);
        }
    }

    function test_upgraderRole_isHeldByTimelockOnly() public view {
        address[4] memory all = _all();
        for (uint256 i; i < 4; i++) {
            IUpgradeable c = IUpgradeable(all[i]);
            assertTrue(c.hasRole(c.UPGRADER_ROLE(), timelock));
            assertFalse(c.hasRole(c.UPGRADER_ROLE(), operator));
            assertFalse(c.hasRole(c.UPGRADER_ROLE(), address(this)));
        }
    }

    function test_implementation_cannotBeInitialised() public {
        bytes[4] memory inits = [anchorInit, ledgerInit, seriesInit, distInit];
        address[4] memory all = _all();
        for (uint256 i; i < 4; i++) {
            (bool ok, bytes memory err) = _implOf(all[i]).call(inits[i]);
            assertFalse(ok);
            assertEq(bytes4(err), INVALID_INIT);
        }
    }

    function test_initialize_cannotRunTwiceOnProxy() public {
        bytes[4] memory inits = [anchorInit, ledgerInit, seriesInit, distInit];
        address[4] memory all = _all();
        for (uint256 i; i < 4; i++) {
            (bool ok, bytes memory err) = all[i].call(inits[i]);
            assertFalse(ok);
            assertEq(bytes4(err), INVALID_INIT);
        }
    }

    function test_onlyTimelockUpgrades() public {
        address[4] memory all = _all();
        for (uint256 i; i < 4; i++) {
            address v2 = _v2(i);
            address[3] memory attackers = [operator, stranger, address(this)];
            for (uint256 j; j < 3; j++) {
                vm.prank(attackers[j]);
                vm.expectRevert();
                IUpgradeable(all[i]).upgradeToAndCall(v2, "");
            }
            vm.prank(timelock);
            IUpgradeable(all[i]).upgradeToAndCall(v2, "");
            assertEq(IV2(all[i]).version(), 2);
            assertEq(_implOf(all[i]), v2);
        }
    }

    function test_upgrade_keepsStateAndNewFieldWorks() public {
        // State written before the upgrade, per contract.
        vm.prank(operator);
        (bool ok,) = anchor.call(abi.encodeWithSignature("push(bytes32)", bytes32(uint256(7))));
        assertTrue(ok);
        vm.prank(operator);
        (ok,) = ledger.call(abi.encodeWithSignature("addBank(bytes32,string,string)", keccak256("bank"), "Bank", "REF"));
        assertTrue(ok);
        vm.prank(operator);
        (ok,) = series.call(abi.encodeWithSignature("addStablecoin(address)", usdc));
        assertTrue(ok);
        vm.prank(operator);
        (ok,) = dist.call(abi.encodeWithSignature("setTawfShare(uint16,address)", uint16(1000), stranger));
        assertTrue(ok);

        address[4] memory all = _all();
        for (uint256 i; i < 4; i++) {
            vm.prank(timelock);
            IUpgradeable(all[i]).upgradeToAndCall(_v2(i), "");
            IV2(all[i]).setExtra(99);
            assertEq(IV2(all[i]).extra(), 99);
        }

        (, bytes memory r) = anchor.staticcall(abi.encodeWithSignature("epochs()"));
        assertEq(abi.decode(r, (uint256)), 1);
        (, r) = ledger.staticcall(abi.encodeWithSignature("bankCount()"));
        assertEq(abi.decode(r, (uint256)), 1);
        (, r) = series.staticcall(abi.encodeWithSignature("isStablecoin(address)", usdc));
        assertTrue(abi.decode(r, (bool)));
        (, r) = dist.staticcall(abi.encodeWithSignature("tawfNisbahBps()"));
        assertEq(abi.decode(r, (uint16)), 1000);
        (, r) = dist.staticcall(abi.encodeWithSignature("claimWindow()"));
        assertEq(abi.decode(r, (uint256)), 365 days);
        (, r) = dist.staticcall(abi.encodeWithSignature("maxReserveAge()"));
        assertEq(abi.decode(r, (uint64)), 3 days);
    }

    function test_onlyUpgraderCanGrantUpgraderRole() public {
        address[4] memory all = _all();
        for (uint256 i; i < 4; i++) {
            IUpgradeable c = IUpgradeable(all[i]);
            bytes32 role = c.UPGRADER_ROLE();
            // The operator holds the other admin roles but not UPGRADER_ROLE, and its role admin is UPGRADER_ROLE itself.
            vm.prank(operator);
            vm.expectRevert();
            c.grantRole(role, operator);
            vm.prank(timelock);
            c.grantRole(role, stranger);
            assertTrue(c.hasRole(role, stranger));
        }
    }

    function test_upgradeToAnythingButAContractWithProxiableUUID_reverts() public {
        address[4] memory all = _all();
        for (uint256 i; i < 4; i++) {
            vm.prank(timelock);
            vm.expectRevert();
            IUpgradeable(all[i]).upgradeToAndCall(dummy, ""); // an EOA is not an implementation
        }
    }
}
