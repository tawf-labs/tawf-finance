// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { IAccessControl } from "openzeppelin-contracts/contracts/access/IAccessControl.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { Initializable } from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import { ERC1967Utils } from "openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Utils.sol";
import { BaseSetup } from "./Base.t.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { BondReceiptNFT } from "../src/BondReceiptNFT.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";
import { PooledFinancingVault } from "../src/PooledFinancingVault.sol";

/// @dev Stand-in for a future vault release: same storage, one new function.
contract RedemptionVaultV2 is RedemptionVault {
    function version() external pure returns (uint256) {
        return 2;
    }
}

contract DealRegistryV2 is DealRegistry {
    function version() external pure returns (uint256) {
        return 2;
    }
}

interface IVersioned {
    function version() external pure returns (uint256);
}

/// @notice UUPS behaviour of the pool contracts: initialise once, locked
///         implementations, upgrades gated by UPGRADER_ROLE, state kept across an upgrade.
contract UpgradeabilityTest is BaseSetup {
    bytes32 internal constant IMPL_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    function _impl(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, IMPL_SLOT))));
    }

    // ------------------------------------------------------------------
    // Initialisation
    // ------------------------------------------------------------------

    function test_Initialize_setsRolesAndDefaults() public view {
        assertTrue(vault.hasRole(vault.UPGRADER_ROLE(), owner));
        assertTrue(vault.hasRole(vault.ADMIN_ROLE(), owner));
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(registry.hasRole(registry.UPGRADER_ROLE(), owner));
        assertTrue(nft.hasRole(nft.UPGRADER_ROLE(), owner));
        assertTrue(pooledVault.hasRole(pooledVault.UPGRADER_ROLE(), owner));
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
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        RedemptionVault(_impl(address(vault))).initialize(stranger);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        DealRegistry(_impl(address(registry))).initialize(stranger);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        BondReceiptNFT(_impl(address(nft))).initialize(stranger);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        PooledFinancingVault(_impl(address(pooledVault))).initialize(IERC20(address(usdc)), stranger);
    }

    // ------------------------------------------------------------------
    // Upgrade authorisation
    // ------------------------------------------------------------------

    function test_Upgrade_byStranger_reverts() public {
        address v2 = address(new RedemptionVaultV2());
        bytes32 role = vault.UPGRADER_ROLE();
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, role));
        vm.prank(stranger);
        vault.upgradeToAndCall(v2, "");
    }

    function test_Upgrade_byAdminWithoutUpgraderRole_reverts() public {
        // ADMIN_ROLE alone (ops configuration) must not be enough to swap the code.
        address admin2 = makeAddr("admin2");
        bytes32 adminRole = vault.ADMIN_ROLE();
        bytes32 role = vault.UPGRADER_ROLE();
        vm.prank(owner);
        vault.grantRole(adminRole, admin2);
        address v2 = address(new RedemptionVaultV2());
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, admin2, role));
        vm.prank(admin2);
        vault.upgradeToAndCall(v2, "");
    }

    function test_Upgrade_toNonUupsContract_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(ERC1967Utils.ERC1967InvalidImplementation.selector, address(usdc)));
        vm.prank(owner);
        vault.upgradeToAndCall(address(usdc), "");
    }

    function test_UpgraderRole_canMoveToMultisig() public {
        address safe = makeAddr("safe");
        bytes32 role = vault.UPGRADER_ROLE();
        vm.startPrank(owner);
        vault.grantRole(role, safe);
        vault.revokeRole(role, owner);
        vm.stopPrank();

        address v2 = address(new RedemptionVaultV2());
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, owner, role));
        vm.prank(owner);
        vault.upgradeToAndCall(v2, "");

        vm.prank(safe);
        vault.upgradeToAndCall(v2, "");
        assertEq(IVersioned(address(vault)).version(), 2);
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
        vault.upgradeToAndCall(address(new RedemptionVaultV2()), "");
        registry.upgradeToAndCall(address(new DealRegistryV2()), "");
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
