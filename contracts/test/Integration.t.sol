// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { BaseSetup } from "./Base.t.sol";
import { DealRegistry } from "../src/DealRegistry.sol";

/**
 * @notice End-to-end lifecycle tests: the exact flow a judge runs on the
 *         testnet demo — create → approve → mintable → invest (multiple
 *         investors) → repay → redeem all → completed.
 */
contract IntegrationTest is BaseSetup {
    function test_FullLifecycle_threeInvestors() public {
        // 1. Deal: $500 target, 30 days, 12% APY, $10 min.
        uint96 target = 500 * 10 ** 6;
        uint256 id = _createAndMintable(1200, 30, MIN_INVEST, target);

        // 2. Three investors fund: $100 + $150 + $250 = $500 → Active.
        _fund(id, alice, 100 * 10 ** 6);
        _fund(id, bob, 150 * 10 ** 6);
        _fund(id, carol, 250 * 10 ** 6);

        DealRegistry.Deal memory deal = registry.getDeal(id);
        assertEq(uint8(deal.status), uint8(DealRegistry.DealStatus.Active));
        assertEq(deal.totalFunded, target);
        assertEq(deal.investorCount, 3);
        assertEq(usdc.balanceOf(address(vault)), target);

        // 3. Repayment: $560 total on $500 principal → $60 profit pool.
        _repay(id, 560 * 10 ** 6);
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Matured));

        // Pro-rata payouts: alice 112, bob 168, carol 280.
        assertEq(vault.payoutFor(id, alice), 112 * 10 ** 6);
        assertEq(vault.payoutFor(id, bob), 168 * 10 ** 6);
        assertEq(vault.payoutFor(id, carol), 280 * 10 ** 6);

        // 4. Everyone redeems → receipts burned → deal completed → vault empty.
        vm.prank(alice);
        vault.redeem(id);
        vm.prank(bob);
        vault.redeem(id);
        vm.prank(carol);
        vault.redeem(id);

        assertEq(usdc.balanceOf(alice), 112 * 10 ** 6);
        assertEq(usdc.balanceOf(bob), 168 * 10 ** 6);
        assertEq(usdc.balanceOf(carol), 280 * 10 ** 6);
        assertEq(nft.balanceOf(alice, id), 0);
        assertEq(nft.balanceOf(bob, id), 0);
        assertEq(nft.balanceOf(carol, id), 0);
        assertTrue(nft.isFullyRedeemed(id));
        assertEq(usdc.balanceOf(address(vault)), 0, "vault fully drained");
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Completed));
    }

    function test_DefaultLifecycle_principalReturned() public {
        uint96 target = 300 * 10 ** 6;
        uint256 id = _createAndMintable(1200, 30, MIN_INVEST, target);
        _fund(id, alice, 100 * 10 ** 6);
        _fund(id, bob, 200 * 10 ** 6);

        vm.prank(owner);
        registry.defaultDeal(id);

        vm.prank(alice);
        vault.claimDefault(id);
        vm.prank(bob);
        vault.claimDefault(id);

        assertEq(usdc.balanceOf(alice), 100 * 10 ** 6, "principal returned");
        assertEq(usdc.balanceOf(bob), 200 * 10 ** 6);
        assertTrue(nft.isFullyRedeemed(id));
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Completed));
    }

    function test_SecondDeal_afterFirstCompletes() public {
        // Independence: completing one deal must not affect a second deal.
        uint256 id1 = _createAndMintable(1200, 30, MIN_INVEST, TARGET);
        _fund(id1, alice, TARGET);
        _repay(id1, 2_800 * 10 ** 6);
        vm.prank(alice);
        vault.redeem(id1);

        uint256 id2 = _createAndMintable(1500, 45, MIN_INVEST, 100 * 10 ** 6);
        _fund(id2, bob, 100 * 10 ** 6);
        _repay(id2, 115 * 10 ** 6);
        vm.prank(bob);
        vault.redeem(id2);

        assertEq(uint8(registry.getDeal(id1).status), uint8(DealRegistry.DealStatus.Completed));
        assertEq(uint8(registry.getDeal(id2).status), uint8(DealRegistry.DealStatus.Completed));
        assertEq(usdc.balanceOf(alice), 2_800 * 10 ** 6);
        assertEq(usdc.balanceOf(bob), 115 * 10 ** 6);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }
}
