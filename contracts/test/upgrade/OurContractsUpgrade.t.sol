// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17 <0.9.0;

import "forge-std/Test.sol";
import { ProxyDeployer } from "../../script/lib/ProxyDeployer.sol";

interface IBeacon {
    function upgradeTo(address newImplementation) external;
    function implementation() external view returns (address);
    function owner() external view returns (address);
}

interface IV2 {
    function version() external view returns (uint256);
    function extra() external view returns (uint256);
    function setExtra(uint256 v) external;
}

/// @notice Beacon behaviour for every Tawf contract that is not a T-REX or ONCHAINID contract: one
///         beacon per type, locked implementations, one initialisation, only the Governance Safe (the
///         beacon owner) can upgrade, every instance follows one upgrade, and state is kept. Initialisation
///         only needs non-zero addresses and a ledger that answers ledgerChainId, so no T-REX suite is
///         set up here.
contract OurContractsUpgradeTest is Test, ProxyDeployer {
    bytes4 internal constant INVALID_INIT = 0xf92ee8a9; // Initializable.InvalidInitialization()
    uint256 internal constant N = 8;

    address internal governance = makeAddr("governance");
    address internal operator = makeAddr("operator");
    address internal stranger = makeAddr("stranger");
    address internal dummy = makeAddr("dummy");

    address internal usdc;
    string[8] internal names;
    string[8] internal v2Names;
    bytes[8] internal inits;
    address[8] internal first; // first instance of each type
    address[8] internal second; // second instance of the same type

    function setUp() public {
        beaconOwner = governance;
        usdc = vm.deployCode("MockUSDC.sol:MockUSDC");

        names = [
            "LedgerAnchor.sol:LedgerAnchor",
            "DepositoPoolLedger.sol:DepositoPoolLedger",
            "TawfDepositoSeries.sol:TawfDepositoSeries",
            "SukukDistributor.sol:SukukDistributor",
            "DealRegistry.sol:DealRegistry",
            "BondReceiptNFT.sol:BondReceiptNFT",
            "RedemptionVault.sol:RedemptionVault",
            "PooledFinancingVault.sol:PooledFinancingVault"
        ];
        v2Names = [
            "UpgradeV2Mocks.sol:LedgerAnchorV2",
            "UpgradeV2Mocks.sol:DepositoPoolLedgerV2",
            "UpgradeV2Mocks.sol:TawfDepositoSeriesV2",
            "UpgradeV2Mocks.sol:SukukDistributorV2",
            "UpgradeV2Mocks.sol:DealRegistryV2",
            "UpgradeV2Mocks.sol:BondReceiptNFTV2",
            "UpgradeV2Mocks.sol:RedemptionVaultV2",
            "UpgradeV2Mocks.sol:PooledFinancingVaultV2"
        ];

        inits[0] = abi.encodeWithSignature("initialize(uint256,address)", 42, operator);
        address anchor = _deployProxy(names[0], inits[0]);
        inits[1] = abi.encodeWithSignature("initialize(uint256,bytes32,address)", 42, keccak256("series"), operator);
        inits[2] = abi.encodePacked(
            bytes4(keccak256("initialize(address,address,address,address,address,(bytes32,uint8,uint16),address,address,address,uint64)")),
            abi.encode(
                anchor, dummy, dummy, dummy, dummy, keccak256("series"), uint8(3), uint16(6000), operator, operator, operator,
                uint64(1 days)
            )
        );
        address[] memory coins = new address[](1);
        coins[0] = usdc;
        inits[3] = abi.encodePacked(
            bytes4(keccak256("initialize(address[],address,address,address,address,(bytes32,uint256,uint40,uint256,uint256,uint40,address),address)")),
            abi.encode(
                coins, anchor, dummy, dummy, dummy, keccak256("sukuk"), uint256(1_000e6), uint40(block.timestamp + 365 days),
                uint256(100e6), uint256(10e6), uint40(30 days), operator, operator
            )
        );
        inits[4] = abi.encodeWithSignature("initialize(address)", operator);
        inits[5] = abi.encodeWithSignature("initialize(address)", operator);
        inits[6] = abi.encodeWithSignature("initialize(address)", operator);
        inits[7] = abi.encodeWithSignature("initialize(address,address)", usdc, operator);

        for (uint256 i; i < N; i++) {
            first[i] = i == 0 ? anchor : _deployProxy(names[i], inits[i]);
            second[i] = _deployProxy(names[i], inits[i]);
        }
    }

    function _beacon(uint256 i) internal returns (IBeacon) {
        return IBeacon(_beaconFor(names[i]));
    }

    function test_oneBeaconPerType_ownedByGovernance() public {
        for (uint256 i; i < N; i++) {
            IBeacon b = _beacon(i);
            assertEq(b.owner(), governance);
            // Two instances share the beacon's implementation.
            assertTrue(b.implementation() != address(0));
            assertTrue(first[i] != second[i]);
        }
        // Different types have different beacons.
        assertTrue(address(_beacon(0)) != address(_beacon(1)));
    }

    function test_implementation_cannotBeInitialised() public {
        for (uint256 i; i < N; i++) {
            (bool ok, bytes memory err) = _beacon(i).implementation().call(inits[i]);
            assertFalse(ok);
            assertEq(bytes4(err), INVALID_INIT);
        }
    }

    function test_initialize_cannotRunTwiceOnAProxy() public {
        for (uint256 i; i < N; i++) {
            (bool ok, bytes memory err) = first[i].call(inits[i]);
            assertFalse(ok);
            assertEq(bytes4(err), INVALID_INIT);
        }
    }

    function test_onlyBeaconOwnerUpgrades_andEveryInstanceFollows() public {
        for (uint256 i; i < N; i++) {
            IBeacon b = _beacon(i);
            address v2 = vm.deployCode(v2Names[i]);
            address[3] memory attackers = [operator, stranger, address(this)];
            for (uint256 j; j < 3; j++) {
                vm.prank(attackers[j]);
                vm.expectRevert();
                b.upgradeTo(v2);
            }
            vm.prank(governance);
            b.upgradeTo(v2);
            assertEq(b.implementation(), v2);
            assertEq(IV2(first[i]).version(), 2);
            assertEq(IV2(second[i]).version(), 2); // one upgrade covers every instance
            IV2(first[i]).setExtra(99);
            assertEq(IV2(first[i]).extra(), 99);
            assertEq(IV2(second[i]).extra(), 0);
        }
    }

    function test_upgradeKeepsState() public {
        vm.prank(operator);
        (bool ok,) = first[0].call(abi.encodeWithSignature("push(bytes32)", bytes32(uint256(7))));
        assertTrue(ok);
        vm.prank(operator);
        (ok,) = first[1].call(abi.encodeWithSignature("addBank(bytes32,string,string)", keccak256("bank"), "Bank", "REF"));
        assertTrue(ok);
        vm.prank(operator);
        (ok,) = first[2].call(abi.encodeWithSignature("addStablecoin(address)", usdc));
        assertTrue(ok);
        vm.prank(operator);
        (ok,) = first[3].call(abi.encodeWithSignature("setTawfShare(uint16,address)", uint16(1000), stranger));
        assertTrue(ok);

        for (uint256 i; i < N; i++) {
            vm.prank(governance);
            _beacon(i).upgradeTo(vm.deployCode(v2Names[i]));
        }

        (, bytes memory r) = first[0].staticcall(abi.encodeWithSignature("epochs()"));
        assertEq(abi.decode(r, (uint256)), 1);
        (, r) = first[1].staticcall(abi.encodeWithSignature("bankCount()"));
        assertEq(abi.decode(r, (uint256)), 1);
        (, r) = first[2].staticcall(abi.encodeWithSignature("isStablecoin(address)", usdc));
        assertTrue(abi.decode(r, (bool)));
        (, r) = first[3].staticcall(abi.encodeWithSignature("tawfNisbahBps()"));
        assertEq(abi.decode(r, (uint16)), 1000);
        (, r) = first[3].staticcall(abi.encodeWithSignature("claimWindow()"));
        assertEq(abi.decode(r, (uint256)), 365 days);
        (, r) = first[3].staticcall(abi.encodeWithSignature("maxReserveAge()"));
        assertEq(abi.decode(r, (uint64)), 3 days);
    }

    function test_beaconRejectsANonContractImplementation() public {
        for (uint256 i; i < N; i++) {
            vm.prank(governance);
            vm.expectRevert();
            _beacon(i).upgradeTo(dummy); // an EOA is not an implementation
        }
    }

    function test_noContractCarriesUpgradeCode() public {
        // A beacon-proxied implementation has no upgradeToAndCall, so it cannot brick or hijack its own upgrade path.
        for (uint256 i; i < N; i++) {
            (bool ok,) = first[i].call(abi.encodeWithSignature("upgradeToAndCall(address,bytes)", dummy, bytes("")));
            assertFalse(ok);
            (ok,) = first[i].staticcall(abi.encodeWithSignature("proxiableUUID()"));
            assertFalse(ok);
        }
    }
}
