// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { BaseSetup } from "./Base.t.sol";
import { Ownable } from "openzeppelin-contracts/contracts/access/Ownable.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { BondReceiptNFT } from "../src/BondReceiptNFT.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";

contract RedemptionVaultTest is BaseSetup {
    uint96 public constant HUNDRED = 100 * 10 ** 6;

    // ------------------------------------------------------------------
    // Investing
    // ------------------------------------------------------------------

    function test_Invest_pullsUsdcAndMints() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);

        assertEq(usdc.balanceOf(alice), 0, "USDC moved out of investor");
        assertEq(usdc.balanceOf(address(vault)), HUNDRED, "USDC held by vault");
        assertEq(nft.balanceOf(alice, id), 1, "receipt minted");
        assertEq(registry.getDeal(id).totalFunded, HUNDRED);
        assertEq(registry.getDeal(id).investorCount, 1);
    }

    function test_Invest_requiresApproval() public {
        uint256 id = _mintableDeal();

        vm.startPrank(alice);
        usdc.faucet(HUNDRED);
        // no approve
        vm.expectRevert(); // ERC20InsufficientAllowance
        vault.invest(id, HUNDRED);
        vm.stopPrank();
    }

    function test_Invest_belowMinimum_reverts() public {
        uint256 id = _mintableDeal();

        vm.startPrank(alice);
        usdc.faucet(10 * 10 ** 6);
        usdc.approve(address(vault), 10 * 10 ** 6);
        vm.expectRevert(RedemptionVault.AmountBelowMinimum.selector);
        vault.invest(id, 5 * 10 ** 6); // $5 < $10 min
        vm.stopPrank();
    }

    function test_Invest_overflow_reverts() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, TARGET - HUNDRED); // leaves $100 of capacity

        vm.startPrank(bob);
        usdc.faucet(200 * 10 ** 6);
        usdc.approve(address(vault), 200 * 10 ** 6);
        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.FundingClosed.selector, id));
        vault.invest(id, 200 * 10 ** 6);
        vm.stopPrank();
    }

    function test_Invest_transitionsDealToActiveWhenFull() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, TARGET);
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Active));

        // No further investments once Active.
        vm.startPrank(bob);
        usdc.faucet(HUNDRED);
        usdc.approve(address(vault), HUNDRED);
        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.FundingClosed.selector, id));
        vault.invest(id, HUNDRED);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Repayment
    // ------------------------------------------------------------------

    function test_Repay_marksDealMaturedAndPullsYield() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);

        uint256 vaultBefore = usdc.balanceOf(address(vault));
        _repay(id, 110 * 10 ** 6); // $100 principal + $10 profit

        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Matured));
        assertEq(usdc.balanceOf(address(vault)), vaultBefore + 10 * 10 ** 6, "yield pulled into vault");

        BondReceiptNFT.DealSnapshot memory snap = nft.getDealSnapshot(id);
        assertTrue(snap.matured);
        assertEq(snap.yieldPool, 10 * 10 ** 6);
    }

    function test_Repay_onlyOwner() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        vault.repay(id, HUNDRED);
    }

    function test_Repay_belowPrincipal_reverts() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);

        vm.startPrank(owner);
        usdc.faucet(HUNDRED);
        usdc.approve(address(vault), HUNDRED);
        vm.expectRevert(RedemptionVault.RepaymentBelowPrincipal.selector);
        vault.repay(id, HUNDRED - 1);
        vm.stopPrank();
    }

    function test_Repay_whenNotActive_reverts() public {
        uint256 id = _mintableDeal(); // still Mintable
        vm.startPrank(owner);
        usdc.faucet(HUNDRED);
        usdc.approve(address(vault), HUNDRED);
        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.FundingClosed.selector, id));
        vault.repay(id, HUNDRED);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Redemption
    // ------------------------------------------------------------------

    function test_Redeem_paysProRata() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, 100 * 10 ** 6);
        _fund(id, bob, 50 * 10 ** 6);

        // $180 total repayment on $150 principal → $30 profit pool.
        _repay(id, 180 * 10 ** 6);

        vm.prank(alice);
        vault.redeem(id);
        vm.prank(bob);
        vault.redeem(id);

        assertEq(usdc.balanceOf(alice), 120 * 10 ** 6, "alice: principal + 20% pro-rata");
        assertEq(usdc.balanceOf(bob), 60 * 10 ** 6, "bob: principal + 20% pro-rata");
        assertEq(nft.balanceOf(alice, id), 0, "receipt burned");
        assertEq(nft.balanceOf(bob, id), 0, "receipt burned");
        assertTrue(nft.isFullyRedeemed(id));
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Completed));
        assertEq(usdc.balanceOf(address(vault)), 0, "vault drained");
    }

    function test_Redeem_notMatured_reverts() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);

        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.NotMatured.selector, id));
        vm.prank(alice);
        vault.redeem(id);
    }

    function test_Redeem_nonInvestor_reverts() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);
        _repay(id, HUNDRED);

        vm.expectRevert(
            abi.encodeWithSelector(RedemptionVault.NotInvestor.selector, id, stranger)
        );
        vm.prank(stranger);
        vault.redeem(id);
    }

    function test_Redeem_twice_reverts() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);
        _fund(id, bob, 50 * 10 ** 6);
        _repay(id, 165 * 10 ** 6);

        vm.startPrank(alice);
        vault.redeem(id); // deal stays Matured while bob is outstanding
        vm.expectRevert(
            abi.encodeWithSelector(RedemptionVault.AlreadyRedeemed.selector, id, alice)
        );
        vault.redeem(id);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Default
    // ------------------------------------------------------------------

    function test_ClaimDefault_returnsPrincipal() public {
        // Deal with a $300 target so partial + full funding reaches Active.
        uint96 target = 300 * 10 ** 6;
        uint256 id = _createAndMintable(1200, 30, MIN_INVEST, target);
        _fund(id, alice, HUNDRED);
        _fund(id, bob, 200 * 10 ** 6);
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Active));

        vm.prank(owner);
        registry.defaultDeal(id);

        vm.prank(alice);
        vault.claimDefault(id);
        vm.prank(bob);
        vault.claimDefault(id);

        assertEq(usdc.balanceOf(alice), HUNDRED, "principal returned");
        assertEq(usdc.balanceOf(bob), 200 * 10 ** 6);
        assertTrue(nft.isFullyRedeemed(id));
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Completed));
    }

    function test_ClaimDefault_requiresDefaulted() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);

        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.NotDefaulted.selector, id));
        vm.prank(alice);
        vault.claimDefault(id);
    }

    // ------------------------------------------------------------------
    // Configuration
    // ------------------------------------------------------------------

    function test_Configure_zeroAddress_reverts() public {
        vm.expectRevert(RedemptionVault.InvalidAddress.selector);
        vm.prank(owner);
        vault.configure(IERC20(address(0)), registry, nft);
    }

    function test_Configure_onlyOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        vault.configure(IERC20(address(usdc)), registry, nft);
    }

    // ------------------------------------------------------------------
    // Payout views
    // ------------------------------------------------------------------

    function test_PayoutFor_and_AccruedYield() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, 100 * 10 ** 6);
        _fund(id, bob, 50 * 10 ** 6);
        _repay(id, 180 * 10 ** 6);

        assertEq(vault.accruedYield(id, alice), 20 * 10 ** 6);
        assertEq(vault.payoutFor(id, alice), 120 * 10 ** 6);
        assertEq(vault.accruedYield(id, bob), 10 * 10 ** 6);
        assertEq(vault.payoutFor(id, bob), 60 * 10 ** 6);
    }
}
