// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { BaseSetup } from "./Base.t.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { MockUSDT } from "../src/mocks/MockUSDT.sol";
import { MockSwapRouter } from "../src/mocks/MockSwapRouter.sol";
import { RedemptionVault, ISwapRouter } from "../src/RedemptionVault.sol";

/// @notice Multi-token investing: the vault's settlement token (`usdc` in BaseSetup, standing in
///         for USDG) is paid in directly, while USDC and USDT are swapped to it on the way in.
///         Also covers the liabilities accounting that bounds `sweepYield`.
contract RedemptionVaultSwapTest is BaseSetup {
    MockUSDC internal usdcIn;
    MockUSDT internal usdtIn;
    MockSwapRouter internal router;
    address internal foundation = makeAddr("tawfFoundation");

    function setUp() public override {
        super.setUp();
        usdcIn = new MockUSDC();
        usdtIn = new MockUSDT();
        router = new MockSwapRouter();

        vm.startPrank(owner);
        vault.setInputToken(address(usdcIn), true);
        vault.setInputToken(address(usdtIn), true);
        vault.setSwapRouter(ISwapRouter(address(router)), 100, 50);
        vault.setYieldRecipient(foundation);
        vm.stopPrank();

        // The router pays out settlement tokens from its own inventory.
        usdc.faucet(10_000 * 10 ** 6);
        usdc.transfer(address(router), 10_000 * 10 ** 6);
    }

    function _investIn(address token, address investor, uint256 dealId, uint96 amount) internal {
        vm.startPrank(investor);
        if (token == address(usdcIn)) usdcIn.faucet(amount);
        else if (token == address(usdtIn)) usdtIn.faucet(amount);
        else usdc.faucet(amount);
        IERC20(token).approve(address(vault), amount);
        vault.investWithToken(dealId, token, amount);
        vm.stopPrank();
    }

    function test_investUsdc_swapsAndCreditsDeal() public {
        uint256 id = _mintableDeal();
        _investIn(address(usdcIn), alice, id, 100 * 10 ** 6);

        assertEq(usdc.balanceOf(address(vault)), 100 * 10 ** 6, "vault holds settlement token");
        assertEq(usdcIn.balanceOf(address(vault)), 0, "no input token left behind");
        assertEq(usdcIn.allowance(address(vault), address(router)), 0, "router allowance cleared");
        assertEq(registry.getDeal(id).totalFunded, 100 * 10 ** 6);
        assertEq(nft.getReceiptMeta(id, alice).principal, 100 * 10 ** 6);
        assertEq(vault.liabilities(), 100 * 10 ** 6);
    }

    function test_investUsdt_swapsAndCreditsDeal() public {
        uint256 id = _mintableDeal();
        _investIn(address(usdtIn), bob, id, 50 * 10 ** 6);
        assertEq(nft.getReceiptMeta(id, bob).principal, 50 * 10 ** 6);
        assertEq(vault.liabilities(), 50 * 10 ** 6);
    }

    function test_investSettlementToken_directNoSwap() public {
        uint256 id = _mintableDeal();
        _investIn(address(usdc), alice, id, 25 * 10 ** 6);
        assertEq(nft.getReceiptMeta(id, alice).principal, 25 * 10 ** 6);
        assertEq(usdc.balanceOf(address(router)), 10_000 * 10 ** 6, "router untouched");
    }

    function test_investTwoArgStillUsesSettlementToken() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, 30 * 10 ** 6);
        assertEq(nft.getReceiptMeta(id, alice).principal, 30 * 10 ** 6);
    }

    function test_unsupportedTokenReverts() public {
        uint256 id = _mintableDeal();
        MockUSDC other = new MockUSDC();
        vm.startPrank(alice);
        other.faucet(100 * 10 ** 6);
        other.approve(address(vault), 100 * 10 ** 6);
        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.UnsupportedToken.selector, address(other)));
        vault.investWithToken(id, address(other), 100 * 10 ** 6);
        vm.stopPrank();
    }

    function test_swapNotConfiguredReverts() public {
        RedemptionVault fresh = new RedemptionVault(owner);
        vm.startPrank(owner);
        fresh.configure(IERC20(address(usdc)), registry, nft);
        fresh.setInputToken(address(usdcIn), true);
        vm.stopPrank();
        // `fresh` is not wired as the registry's vault, so only the swap-config check is reachable
        // if the deal lookup and status pass; mint a deal and call it directly.
        uint256 id = _mintableDeal();
        vm.startPrank(alice);
        usdcIn.faucet(100 * 10 ** 6);
        usdcIn.approve(address(fresh), 100 * 10 ** 6);
        vm.expectRevert(RedemptionVault.SwapNotConfigured.selector);
        fresh.investWithToken(id, address(usdcIn), 100 * 10 ** 6);
        vm.stopPrank();
    }

    function test_favourableSwapCannotOverfundDeal() public {
        // Target $2,500; a +1% drift on a $2,500 payment would credit $2,525.
        uint256 id = _mintableDeal();
        router.setRateBps(10_100);
        vm.startPrank(alice);
        usdcIn.faucet(TARGET);
        usdcIn.approve(address(vault), TARGET);
        vm.expectRevert(abi.encodeWithSelector(RedemptionVault.FundingClosed.selector, id));
        vault.investWithToken(id, address(usdcIn), TARGET);
        vm.stopPrank();
    }

    function test_minimumAppliesToCreditedAmountNotPaidIn() public {
        // $10 minimum; paying exactly $10 at a 0.4% worse (still within slippage) rate credits < $10.
        uint256 id = _mintableDeal();
        router.setRateBps(9_960);
        vm.startPrank(alice);
        usdcIn.faucet(MIN_INVEST);
        usdcIn.approve(address(vault), MIN_INVEST);
        vm.expectRevert(RedemptionVault.AmountBelowMinimum.selector);
        vault.investWithToken(id, address(usdcIn), MIN_INVEST);
        vm.stopPrank();
    }

    function test_swapBeyondSlippageReverts() public {
        uint256 id = _mintableDeal();
        router.setRateBps(9_900); // 1% worse than the 0.5% tolerance
        vm.startPrank(alice);
        usdcIn.faucet(100 * 10 ** 6);
        usdcIn.approve(address(vault), 100 * 10 ** 6);
        vm.expectRevert(bytes("Slippage"));
        vault.investWithToken(id, address(usdcIn), 100 * 10 ** 6);
        vm.stopPrank();
    }

    function test_adminConfig_accessControlAndBounds() public {
        vm.startPrank(stranger);
        vm.expectRevert();
        vault.setInputToken(address(usdtIn), false);
        vm.expectRevert();
        vault.setYieldRecipient(stranger);
        vm.stopPrank();

        vm.startPrank(owner);
        vm.expectRevert(RedemptionVault.InvalidSlippage.selector);
        vault.setSwapRouter(ISwapRouter(address(router)), 100, 301);
        vm.expectRevert(RedemptionVault.InvalidAddress.selector);
        vault.setInputToken(address(usdc), true); // settlement token is implicitly accepted
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // Yield sweep
    // ---------------------------------------------------------------------

    function test_sweepYield_revertsWhenNothingSurplus() public {
        uint256 id = _mintableDeal();
        _investIn(address(usdcIn), alice, id, 100 * 10 ** 6);
        assertEq(vault.surplus(), 0);
        vm.expectRevert(RedemptionVault.NothingToSweep.selector);
        vault.sweepYield();
    }

    function test_sweepYield_forwardsRewardsButNeverInvestorFunds() public {
        uint256 id = _mintableDeal();
        _investIn(address(usdcIn), alice, id, 100 * 10 ** 6);

        // Rewards from the stablecoin network arrive as plain transfers to the vault.
        usdc.faucet(7 * 10 ** 6);
        usdc.transfer(address(vault), 7 * 10 ** 6);
        assertEq(vault.surplus(), 7 * 10 ** 6);

        vm.prank(stranger); // anyone may trigger it; destination is fixed
        uint256 swept = vault.sweepYield();
        assertEq(swept, 7 * 10 ** 6);
        assertEq(usdc.balanceOf(foundation), 7 * 10 ** 6);
        assertEq(usdc.balanceOf(address(vault)), vault.liabilities(), "investor funds untouched");

        vm.expectRevert(RedemptionVault.NothingToSweep.selector);
        vault.sweepYield();
    }

    function test_sweepYield_revertsWithoutRecipient() public {
        RedemptionVault fresh = new RedemptionVault(owner);
        vm.expectRevert(RedemptionVault.InvalidAddress.selector);
        fresh.sweepYield();
    }

    function test_liabilitiesTrackFullLifecycle_undisbursed() public {
        uint256 id = _mintableDeal();
        _investIn(address(usdcIn), alice, id, 100 * 10 ** 6);
        _investIn(address(usdtIn), bob, id, 50 * 10 ** 6);
        assertEq(vault.liabilities(), 150 * 10 ** 6);

        _repay(id, 165 * 10 ** 6); // $15 profit
        assertEq(vault.liabilities(), 165 * 10 ** 6, "principal + profit owed to holders");
        assertEq(usdc.balanceOf(address(vault)), 165 * 10 ** 6);
        assertEq(vault.surplus(), 0);

        vm.prank(alice);
        vault.redeem(id);
        vm.prank(bob);
        vault.redeem(id);

        assertLe(vault.liabilities(), usdc.balanceOf(address(vault)), "never insolvent");
        // Only rounding dust can remain, and it is the only thing sweepable.
        assertEq(vault.surplus(), usdc.balanceOf(address(vault)) - vault.liabilities());
    }

    function test_liabilitiesTrackFullLifecycle_disbursed() public {
        address servicer = makeAddr("servicer");
        vm.startPrank(owner);
        vault.grantRole(vault.SERVICER_ROLE(), servicer);
        vm.stopPrank();

        uint256 id = _createAndMintable(1200, 30, MIN_INVEST, 100 * 10 ** 6);
        _investIn(address(usdcIn), alice, id, 100 * 10 ** 6); // fully funds -> Active

        vm.prank(owner);
        vault.disburse(id, servicer);
        assertEq(vault.liabilities(), 0, "disbursed principal is no longer held");
        assertEq(usdc.balanceOf(address(vault)), 0);

        // Servicer remits principal + $10 profit; OPS pulls it in via repay.
        vm.startPrank(owner);
        usdc.faucet(110 * 10 ** 6);
        usdc.approve(address(vault), 110 * 10 ** 6);
        vault.repay(id, 110 * 10 ** 6);
        vm.stopPrank();
        assertEq(vault.liabilities(), 110 * 10 ** 6);

        vm.prank(alice);
        vault.redeem(id);
        assertEq(vault.liabilities(), 0);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    function test_liabilitiesTrackDefaultWithNegligenceCover() public {
        address servicer = makeAddr("servicer");
        address dps = makeAddr("dps");
        vm.startPrank(owner);
        vault.grantRole(vault.SERVICER_ROLE(), servicer);
        vault.grantRole(vault.NEGLIGENCE_ROLE(), dps);
        vm.stopPrank();

        uint256 id = _createAndMintable(1200, 30, MIN_INVEST, 100 * 10 ** 6);
        _investIn(address(usdtIn), alice, id, 100 * 10 ** 6);
        vm.startPrank(owner);
        vault.disburse(id, servicer);
        registry.defaultDeal(id);
        vm.stopPrank();
        assertEq(vault.liabilities(), 0);

        // Servicer recovers $40; DPS finds Tawf liable for another $20, paid in by Tawf.
        vm.startPrank(servicer);
        usdc.faucet(40 * 10 ** 6);
        usdc.approve(address(vault), 40 * 10 ** 6);
        vault.settleDefault(id, 40 * 10 ** 6);
        vm.stopPrank();
        vm.prank(dps);
        vault.recordNegligence(id, 20 * 10 ** 6, keccak256("finding"));
        usdc.faucet(20 * 10 ** 6);
        usdc.approve(address(vault), 20 * 10 ** 6);
        vault.payNegligence(id);
        assertEq(vault.liabilities(), 60 * 10 ** 6);
        assertEq(vault.surplus(), 0);

        vm.prank(owner);
        vault.openDefaultClaims(id);
        vm.prank(alice);
        vault.claimDefault(id);
        assertEq(usdc.balanceOf(alice), 60 * 10 ** 6);
        assertEq(vault.liabilities(), 0);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }
}
