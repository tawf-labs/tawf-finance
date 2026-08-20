// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { BaseSetup } from "./Base.t.sol";
import { Ownable } from "openzeppelin-contracts/contracts/access/Ownable.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";

contract DealRegistryTest is BaseSetup {

    // ------------------------------------------------------------------
    // Creation
    // ------------------------------------------------------------------

    function test_CreateDeal_setsFieldsAndStatus() public {
        vm.startPrank(owner);
        uint256 id = registry.createDeal(
            keccak256("invoice-001"),
            "Warung Sari Rejeki",
            "Indomaret",
            bmt,
            1200,
            30,
            MIN_INVEST,
            TARGET
        );
        vm.stopPrank();

        DealRegistry.Deal memory deal = registry.getDeal(id);

        assertEq(id, 1, "first deal id should be 1");
        assertEq(deal.supplierName, "Warung Sari Rejeki");
        assertEq(deal.anchorBuyer, "Indomaret");
        assertEq(deal.bmtOriginator, bmt);
        assertEq(deal.apyBps, 1200);
        assertEq(deal.durationDays, 30);
        assertEq(deal.minInvestment, MIN_INVEST);
        assertEq(deal.fundingTarget, TARGET);
        assertEq(deal.totalFunded, 0);
        assertEq(deal.investorCount, 0);
        assertEq(uint8(deal.status), uint8(DealRegistry.DealStatus.Submitted));
        assertGt(deal.createdAt, 0);
        assertEq(deal.maturesAt, deal.createdAt + 30 days);
        assertEq(registry.dealCount(), 1);
    }

    function test_CreateDeal_incrementsIds() public {
        _mintableDeal();
        uint256 id2 = _mintableDeal();
        assertEq(id2, 2);
    }

    function test_CreateDeal_revertsEmptySupplier() public {
        vm.expectRevert(DealRegistry.InvalidDealParams.selector);
        vm.prank(owner);
        registry.createDeal(keccak256("x"), "", "Indomaret", bmt, 1200, 30, MIN_INVEST, TARGET);
    }

    function test_CreateDeal_revertsEmptyAnchorBuyer() public {
        vm.expectRevert(DealRegistry.InvalidDealParams.selector);
        vm.prank(owner);
        registry.createDeal(keccak256("x"), "Warung", "", bmt, 1200, 30, MIN_INVEST, TARGET);
    }

    function test_CreateDeal_revertsZeroBmt() public {
        vm.expectRevert(DealRegistry.InvalidDealParams.selector);
        vm.prank(owner);
        registry.createDeal(keccak256("x"), "Warung", "Indomaret", address(0), 1200, 30, MIN_INVEST, TARGET);
    }

    function test_CreateDeal_revertsZeroMinInvestment() public {
        vm.expectRevert(DealRegistry.InvalidDealParams.selector);
        vm.prank(owner);
        registry.createDeal(keccak256("x"), "Warung", "Indomaret", bmt, 1200, 30, 0, TARGET);
    }

    function test_CreateDeal_revertsZeroTarget() public {
        vm.expectRevert(DealRegistry.InvalidDealParams.selector);
        vm.prank(owner);
        registry.createDeal(keccak256("x"), "Warung", "Indomaret", bmt, 1200, 30, MIN_INVEST, 0);
    }

    function test_CreateDeal_revertsZeroDuration() public {
        vm.expectRevert(DealRegistry.InvalidDealParams.selector);
        vm.prank(owner);
        registry.createDeal(keccak256("x"), "Warung", "Indomaret", bmt, 1200, 0, MIN_INVEST, TARGET);
    }

    function test_CreateDeal_onlyOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        registry.createDeal(keccak256("x"), "Warung", "Indomaret", bmt, 1200, 30, MIN_INVEST, TARGET);
    }

    // ------------------------------------------------------------------
    // Transitions
    // ------------------------------------------------------------------

    function test_Lifecycle_submittedToMintable() public {
        uint256 id = _createAndMintable(1200, 30, MIN_INVEST, TARGET);
        DealRegistry.Deal memory deal = registry.getDeal(id);
        assertEq(uint8(deal.status), uint8(DealRegistry.DealStatus.Mintable));
    }

    function test_Lifecycle_fullCycle_toCompleted() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, TARGET); // full funding → Active
        _repay(id, 2_800 * 10 ** 6); // principal + $300 profit

        DealRegistry.Deal memory matured = registry.getDeal(id);
        assertEq(uint8(matured.status), uint8(DealRegistry.DealStatus.Matured));

        vm.prank(owner);
        registry.completeDeal(id);
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Completed));
    }

    function test_InvalidTransition_approveTwice() public {
        uint256 id = _mintableDeal(); // status is Mintable now
        vm.expectRevert(
            abi.encodeWithSelector(
                DealRegistry.InvalidTransition.selector,
                DealRegistry.DealStatus.Mintable,
                DealRegistry.DealStatus.Submitted
            )
        );
        vm.prank(owner);
        registry.approveDeal(id);
    }

    function test_InvalidTransition_mintableBeforeApproval() public {
        vm.startPrank(owner);
        uint256 id = registry.createDeal(keccak256("x"), "Warung", "Indomaret", bmt, 1200, 30, MIN_INVEST, TARGET);
        vm.stopPrank();

        vm.expectRevert(
            abi.encodeWithSelector(
                DealRegistry.InvalidTransition.selector,
                DealRegistry.DealStatus.Submitted,
                DealRegistry.DealStatus.BmtApproved
            )
        );
        vm.prank(owner);
        registry.markMintable(id);
    }

    function test_DealDoesNotExist() public {
        vm.expectRevert(abi.encodeWithSelector(DealRegistry.DealDoesNotExist.selector, 99));
        registry.getDeal(99);
    }

    // ------------------------------------------------------------------
    // Funding
    // ------------------------------------------------------------------

    function test_FundDeal_onlyVault() public {
        uint256 id = _mintableDeal();
        vm.expectRevert(DealRegistry.NotVault.selector);
        vm.prank(stranger);
        registry.fundDeal(id, alice, 100 * 10 ** 6);
    }

    function test_FundDeal_recordsInvestorPrincipal() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, 100 * 10 ** 6);
        _fund(id, alice, 50 * 10 ** 6); // same investor, second ticket

        DealRegistry.Deal memory deal = registry.getDeal(id);
        assertEq(deal.totalFunded, 150 * 10 ** 6);
        assertEq(deal.investorCount, 1, "investor counted once");
        assertEq(registry.investorPrincipal(id, alice), 150 * 10 ** 6);
    }

    function test_FundDeal_transitionsToActiveWhenFull() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, TARGET);

        DealRegistry.Deal memory deal = registry.getDeal(id);
        assertEq(uint8(deal.status), uint8(DealRegistry.DealStatus.Active));
    }

    function test_FundDeal_revertsWhenOverTarget() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, TARGET - 100 * 10 ** 6);

        vm.expectRevert(abi.encodeWithSelector(DealRegistry.FundingExceedsTarget.selector, id));
        vm.prank(address(vault));
        registry.fundDeal(id, bob, 200 * 10 ** 6);
    }

    function test_Invest_whenNotMintable_revertsAtVault() public {
        vm.startPrank(owner);
        uint256 id = registry.createDeal(keccak256("x"), "Warung", "Indomaret", bmt, 1200, 30, MIN_INVEST, TARGET);
        vm.stopPrank();

        vm.startPrank(alice);
        usdc.faucet(MIN_INVEST);
        usdc.approve(address(vault), MIN_INVEST);
        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.FundingClosed.selector, id));
        vault.invest(id, MIN_INVEST);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Maturity
    // ------------------------------------------------------------------

    function test_MarkMatured_ownerCanEarly() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, TARGET);

        vm.prank(owner);
        registry.markMatured(id);
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Matured));
    }

    function test_MarkMatured_strangerBlockedBeforeMaturity() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, TARGET);

        vm.expectRevert(abi.encodeWithSelector(DealRegistry.NotMatured.selector, id));
        vm.prank(stranger);
        registry.markMatured(id);
    }

    function test_MarkMatured_anyoneAfterMaturity() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, TARGET);

        vm.warp(block.timestamp + 31 days);
        vm.prank(stranger);
        registry.markMatured(id);
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Matured));
    }

    function test_CompleteDeal_revertsWhenNotMatured() public {
        uint256 id = _mintableDeal();
        vm.expectRevert(
            abi.encodeWithSelector(
                DealRegistry.InvalidTransition.selector,
                DealRegistry.DealStatus.Mintable,
                DealRegistry.DealStatus.Matured
            )
        );
        vm.prank(owner);
        registry.completeDeal(id);
    }

    function test_DefaultDeal_activeToDefaulted() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, TARGET);

        vm.prank(owner);
        registry.defaultDeal(id);
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Defaulted));
    }

    function test_DefaultDeal_requiresActive() public {
        uint256 id = _mintableDeal();
        vm.expectRevert(
            abi.encodeWithSelector(
                DealRegistry.InvalidTransition.selector,
                DealRegistry.DealStatus.Mintable,
                DealRegistry.DealStatus.Active
            )
        );
        vm.prank(owner);
        registry.defaultDeal(id);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function test_GetDealsByStatus_filters() public {
        uint256 id1 = _mintableDeal();
        _fund(id1, alice, TARGET); // → Active

        _mintableDeal(); // stays Mintable

        DealRegistry.Deal[] memory active = registry.getDealsByStatus(DealRegistry.DealStatus.Active);
        DealRegistry.Deal[] memory mintable = registry.getDealsByStatus(DealRegistry.DealStatus.Mintable);

        assertEq(active.length, 1);
        assertEq(active[0].id, id1);
        assertEq(mintable.length, 1);
    }
}
