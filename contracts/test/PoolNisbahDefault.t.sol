// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { BaseSetup } from "./Base.t.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";

/// @notice Tawf's nisbah on pool profit, and musyarakah loss-sharing on default:
///         deployed capital bears the loss pro rata, and Tawf's money covers it
///         only through a recorded negligence finding.
contract PoolNisbahDefaultTest is BaseSetup {
    address public tawfFee = makeAddr("tawfFee");
    address public servicer = makeAddr("servicer");
    address public dps = makeAddr("dps");
    address public tawfTreasury = makeAddr("tawfTreasury");

    function setUp() public override {
        super.setUp();
        vm.startPrank(owner);
        vault.setFeeRecipient(tawfFee);
        vault.grantRole(vault.SERVICER_ROLE(), servicer);
        vault.grantRole(vault.NEGLIGENCE_ROLE(), dps);
        vm.stopPrank();
    }

    /// @dev Create + approve a deal, set its nisbah, then open it to investors.
    function _dealWithNisbah(uint16 nisbahBps) internal returns (uint256 id) {
        vm.startPrank(owner);
        id = registry.createDeal(
            keccak256(abi.encode(block.timestamp, nisbahBps)),
            "Warung Sari Rejeki",
            "Indomaret",
            bmt,
            1200,
            30,
            MIN_INVEST,
            TARGET
        );
        registry.approveDeal(id);
        vault.setDealNisbah(id, nisbahBps);
        registry.markMintable(id);
        vm.stopPrank();
    }

    function _fullyFund(uint256 id) internal {
        _fund(id, alice, 1_500 * 10 ** 6);
        _fund(id, bob, 1_000 * 10 ** 6);
    }

    function _pay(address from, uint256 amount) internal {
        vm.startPrank(from);
        usdc.faucet(amount);
        usdc.approve(address(vault), amount);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Nisbah
    // ------------------------------------------------------------------

    function test_Nisbah_splitsProfit() public {
        uint256 id = _dealWithNisbah(1500); // 15%
        _fullyFund(id);
        _repay(id, TARGET + 100 * 10 ** 6); // profit 100

        assertEq(usdc.balanceOf(tawfFee), 15 * 10 ** 6);
        // Investors share the remaining 85 pro rata (60/40).
        assertEq(vault.payoutFor(id, alice), 1_500 * 10 ** 6 + 51 * 10 ** 6);
        assertEq(vault.payoutFor(id, bob), 1_000 * 10 ** 6 + 34 * 10 ** 6);
    }

    function test_Nisbah_zeroProfit_zeroShare() public {
        uint256 id = _dealWithNisbah(1500);
        _fullyFund(id);
        _repay(id, TARGET);
        assertEq(usdc.balanceOf(tawfFee), 0);
        assertEq(vault.payoutFor(id, alice), 1_500 * 10 ** 6);
    }

    function test_Nisbah_lockedOnceMintable() public {
        uint256 id = _dealWithNisbah(1500);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.NisbahLocked.selector, id));
        vault.setDealNisbah(id, 3000);
    }

    function test_Nisbah_capped() public {
        vm.startPrank(owner);
        uint256 id = registry.createDeal(keccak256("x"), "W", "I", bmt, 1200, 30, MIN_INVEST, TARGET);
        vm.expectRevert(RedemptionVault.InvalidNisbah.selector);
        vault.setDealNisbah(id, 5001);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Disbursement and repayment
    // ------------------------------------------------------------------

    function test_Disburse_thenRepayReturnsPrincipalAndProfit() public {
        uint256 id = _dealWithNisbah(1500);
        _fullyFund(id);
        vm.prank(owner);
        vault.disburse(id, servicer);
        assertEq(usdc.balanceOf(servicer), TARGET);
        assertEq(usdc.balanceOf(address(vault)), 0);

        _repay(id, TARGET + 100 * 10 ** 6); // pulls principal + profit
        assertEq(usdc.balanceOf(tawfFee), 15 * 10 ** 6);
        vm.prank(alice);
        vault.redeem(id);
        assertEq(usdc.balanceOf(alice), 1_551 * 10 ** 6);
    }

    function test_Disburse_onlyToServicer() public {
        uint256 id = _dealWithNisbah(0);
        _fullyFund(id);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.NotServicer.selector, stranger));
        vault.disburse(id, stranger);
    }

    // ------------------------------------------------------------------
    // Default: loss shared pro rata, Tawf liable only for negligence
    // ------------------------------------------------------------------

    function _disbursedDefault(uint16 nisbahBps) internal returns (uint256 id) {
        id = _dealWithNisbah(nisbahBps);
        _fullyFund(id);
        vm.startPrank(owner);
        vault.disburse(id, servicer);
        registry.defaultDeal(id);
        vm.stopPrank();
    }

    function test_Default_lossSharedProRata_noTawfMoney() public {
        uint256 id = _disbursedDefault(1500);
        // The servicer recovers 1,000 of 2,500 (40%).
        vm.startPrank(servicer);
        usdc.approve(address(vault), 1_000 * 10 ** 6);
        vault.settleDefault(id, 1_000 * 10 ** 6);
        vm.stopPrank();
        vm.prank(owner);
        vault.openDefaultClaims(id);

        vm.prank(alice);
        vault.claimDefault(id);
        vm.prank(bob);
        vault.claimDefault(id);
        assertEq(usdc.balanceOf(alice), 600 * 10 ** 6); // 40% of 1,500
        assertEq(usdc.balanceOf(bob), 400 * 10 ** 6); // 40% of 1,000
        assertEq(usdc.balanceOf(tawfFee), 0); // no nisbah on a loss
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    function test_Default_claimsWaitForSettlement() public {
        uint256 id = _disbursedDefault(0);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.DefaultClaimsNotOpen.selector, id));
        vault.claimDefault(id);
    }

    function test_Default_negligenceCoversOnlyWhatDpsFound() public {
        uint256 id = _disbursedDefault(0);
        vm.startPrank(servicer);
        usdc.approve(address(vault), 1_000 * 10 ** 6);
        vault.settleDefault(id, 1_000 * 10 ** 6);
        vm.stopPrank();

        // Tawf cannot find itself liable: only the DPS/auditor role can.
        vm.prank(owner);
        vm.expectRevert();
        vault.recordNegligence(id, 500 * 10 ** 6, keccak256("report"));

        vm.prank(dps);
        vm.expectRevert(RedemptionVault.NoEvidence.selector);
        vault.recordNegligence(id, 500 * 10 ** 6, bytes32(0));

        vm.prank(dps);
        vault.recordNegligence(id, 500 * 10 ** 6, keccak256("dps-finding-001"));

        // Claims cannot open until the liability is paid in.
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.NegligenceUnpaid.selector, id));
        vault.openDefaultClaims(id);

        _pay(tawfTreasury, 500 * 10 ** 6);
        vm.prank(tawfTreasury);
        vault.payNegligence(id);
        vm.prank(owner);
        vault.openDefaultClaims(id);

        vm.prank(alice);
        vault.claimDefault(id);
        assertEq(usdc.balanceOf(alice), 900 * 10 ** 6); // (1,000 + 500) * 1,500 / 2,500
    }

    function test_Default_negligenceCappedAtLoss() public {
        uint256 id = _disbursedDefault(0);
        vm.startPrank(servicer);
        usdc.approve(address(vault), 2_000 * 10 ** 6);
        vault.settleDefault(id, 2_000 * 10 ** 6);
        vm.stopPrank();
        vm.prank(dps);
        vm.expectRevert(RedemptionVault.RecoveryExceedsPrincipal.selector);
        vault.recordNegligence(id, 501 * 10 ** 6, keccak256("x"));
    }

    function test_Default_onlyServicerSettles() public {
        uint256 id = _disbursedDefault(0);
        vm.prank(owner);
        vm.expectRevert();
        vault.settleDefault(id, 0);
    }

    function test_Default_undisbursedReturnsUndeployedFundsAtPar() public {
        uint256 id = _dealWithNisbah(0);
        _fullyFund(id);
        vm.prank(owner);
        registry.defaultDeal(id);
        vm.prank(alice);
        vault.claimDefault(id);
        assertEq(usdc.balanceOf(alice), 1_500 * 10 ** 6);
    }
}
