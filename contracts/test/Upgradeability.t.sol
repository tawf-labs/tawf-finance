// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { IAccessControl } from "openzeppelin-contracts/contracts/access/IAccessControl.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { Initializable } from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import { UpgradeableBeacon } from "openzeppelin-contracts/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { BaseSetup } from "./Base.t.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { BondReceiptNFT } from "../src/BondReceiptNFT.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";
import { PooledFinancingVault } from "../src/PooledFinancingVault.sol";
import { RedemptionVaultV2, DealRegistryV2 } from "../src/mocks/UpgradeV2Mocks.sol";

interface IVersioned {
    function version() external pure returns (uint256);
}

/// @notice Beacon behaviour of the pool contracts: initialise once, locked implementations, the
///         beacon owner is the only upgrader, state kept across an upgrade.
contract UpgradeabilityTest is BaseSetup {
    // EIP-1967 beacon slot.
    bytes32 internal constant BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    function _beacon(address proxy) internal view returns (UpgradeableBeacon) {
        return UpgradeableBeacon(address(uint160(uint256(vm.load(proxy, BEACON_SLOT)))));
    }

    function _impl(address proxy) internal view returns (address) {
        return _beacon(proxy).implementation();
    }

    // ------------------------------------------------------------------
    // Initialisation
    // ------------------------------------------------------------------

    function test_Initialize_setsRolesAndDefaults() public view {
        assertTrue(vault.hasRole(vault.ADMIN_ROLE(), owner));
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), owner));
        // Values that used to be set at declaration must be set by initialize.
        assertEq(vault.swapFee(), 3000);
        assertEq(vault.slippageBps(), 50);
    }

    function test_Initialize_firstDealIdIsOne() public {
        assertEq(_mintableDeal(), 1);
    }

    function test_Initialize_cannotRunTwiceOnProxy() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        vault.initialize(stranger);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        registry.initialize(stranger);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        nft.initialize(stranger);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        pooledVault.initialize(IERC20(address(usdc)), stranger);
    }

    function test_Implementation_isLocked() public {
        address vImpl = _impl(address(vault));
        address rImpl = _impl(address(registry));
        address nImpl = _impl(address(nft));
        address pImpl = _impl(address(pooledVault));
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        RedemptionVault(vImpl).initialize(stranger);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        DealRegistry(rImpl).initialize(stranger);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        BondReceiptNFT(nImpl).initialize(stranger);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        PooledFinancingVault(pImpl).initialize(IERC20(address(usdc)), stranger);
    }

    // ------------------------------------------------------------------
    // Upgrade authorisation
    // ------------------------------------------------------------------

    function test_Upgrade_onlyBeaconOwner() public {
        address v2 = address(new RedemptionVaultV2());
        UpgradeableBeacon b = _beacon(address(vault));
        assertEq(b.owner(), owner);
        vm.prank(stranger);
        vm.expectRevert();
        b.upgradeTo(v2);
        vm.prank(owner);
        b.upgradeTo(v2);
        assertEq(IVersioned(address(vault)).version(), 2);
    }

    function test_Upgrade_toNonContract_reverts() public {
        vm.prank(owner);
        vm.expectRevert();
        _beacon(address(vault)).upgradeTo(address(0xdead));
    }

    // ------------------------------------------------------------------
    // State survives an upgrade
    // ------------------------------------------------------------------

    function test_Upgrade_keepsVaultAndRegistryState() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, 100 * 10 ** 6);
        uint256 liabilitiesBefore = vault.liabilities();
        uint256 balanceBefore = usdc.balanceOf(address(vault));
        DealRegistry.Deal memory dealBefore = registry.getDeal(id);

        address oldVaultImpl = _impl(address(vault));
        vm.startPrank(owner);
        _beacon(address(vault)).upgradeTo(address(new RedemptionVaultV2()));
        _beacon(address(registry)).upgradeTo(address(new DealRegistryV2()));
        vm.stopPrank();

        assertTrue(_impl(address(vault)) != oldVaultImpl);
        assertEq(IVersioned(address(vault)).version(), 2);
        assertEq(IVersioned(address(registry)).version(), 2);

        // Vault wiring, accounting, defaults and roles are unchanged.
        assertEq(vault.liabilities(), liabilitiesBefore);
        assertEq(usdc.balanceOf(address(vault)), balanceBefore);
        assertEq(address(vault.registry()), address(registry));
        assertEq(address(vault.nft()), address(nft));
        assertEq(vault.swapFee(), 3000);
        assertTrue(vault.hasRole(vault.OPS_ROLE(), owner));

        // Registry data is unchanged and the id counter continues.
        DealRegistry.Deal memory dealAfter = registry.getDeal(id);
        assertEq(dealAfter.totalFunded, dealBefore.totalFunded);
        assertEq(uint8(dealAfter.status), uint8(dealBefore.status));
        assertEq(registry.investorPrincipal(id, alice), 100 * 10 ** 6);
        assertEq(_mintableDeal(), id + 1);

        // The upgraded vault still runs the lifecycle end to end.
        _fund(id + 1, bob, 50 * 10 ** 6);
        assertEq(registry.getDeal(id + 1).totalFunded, 50 * 10 ** 6);
    }
}
