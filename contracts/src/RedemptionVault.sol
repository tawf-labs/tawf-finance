// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Ownable } from "openzeppelin-contracts/contracts/access/Ownable.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { DealRegistry } from "./DealRegistry.sol";
import { BondReceiptNFT } from "./BondReceiptNFT.sol";

/**
 * @title RedemptionVault
 * @notice The only contract that holds and moves investor USDC.
 *
 * @dev Flow:
 *  1. invest()      — pulls USDC from the investor, records the deal funding
 *                     in DealRegistry, mints a soulbound receipt.
 *  2. repay()       — owner (later: SekuritasOracle) adds the profit share;
 *                     deal transitions to Matured.
 *  3. redeem()      — pro-rata payout of principal + yield; receipt burned.
 *  4. claimDefault()— principal-only return on a defaulted deal.
 *
 *      Checks-effects-interactions and ReentrancyGuard everywhere money
 *      moves. The vault never holds more than what deals owe + pending yield.
 */
contract RedemptionVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public usdc;
    DealRegistry public registry;
    BondReceiptNFT public nft;

    error NotConfigured();
    error AmountBelowMinimum();
    error FundingClosed(uint256 dealId);
    error RepaymentBelowPrincipal();
    error NotMatured(uint256 dealId);
    error NotDefaulted(uint256 dealId);
    error NotInvestor(uint256 dealId, address investor);
    error AlreadyRedeemed(uint256 dealId, address investor);
    error InsufficientVaultBalance();
    error InvalidAddress();

    event Invested(uint256 indexed dealId, address indexed investor, uint96 amount);
    event Repaid(uint256 indexed dealId, uint96 totalRepayment, uint96 yieldPool);
    event Redeemed(uint256 indexed dealId, address indexed investor, uint256 payout);
    event DefaultClaimed(uint256 indexed dealId, address indexed investor, uint256 payout);

    constructor() Ownable(msg.sender) {}

    // ---------------------------------------------------------------------
    // Owner configuration
    // ---------------------------------------------------------------------

    function configure(IERC20 usdc_, DealRegistry registry_, BondReceiptNFT nft_) external onlyOwner {
        if (
            address(usdc_) == address(0) ||
            address(registry_) == address(0) ||
            address(nft_) == address(0)
        ) {
            revert InvalidAddress();
        }
        usdc = usdc_;
        registry = registry_;
        nft = nft_;
    }

    // ---------------------------------------------------------------------
    // Investing
    // ---------------------------------------------------------------------

    /**
     * @notice Invest USDC into a Mintable deal and receive a soulbound
     *         receipt. Caller must have approved this vault for `amount`.
     */
    function invest(uint256 dealId, uint96 amount) external nonReentrant {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);

        if (deal.status != DealRegistry.DealStatus.Mintable) revert FundingClosed(dealId);
        if (amount < deal.minInvestment) revert AmountBelowMinimum();
        if (amount > deal.fundingTarget - deal.totalFunded) revert FundingClosed(dealId);

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        registry.fundDeal(dealId, msg.sender, amount);
        nft.mint(
            msg.sender,
            dealId,
            amount,
            deal.apyBps,
            deal.durationDays,
            deal.supplierName,
            deal.anchorBuyer
        );

        emit Invested(dealId, msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Repayment (owner / future SekuritasOracle)
    // ---------------------------------------------------------------------

    /**
     * @notice Record repayment of a deal.
     *
     * @dev A deal repays from Mintable (partial funding) or Active (fully
     *      funded); it just needs outstanding principal. The vault already
     *      holds the principal from investments; this function pulls in only
     *      the profit share (`totalRepayment` minus principal) from the
     *      caller, then marks the deal Matured. Caller must have approved
     *      this vault for the yield portion.
     *
     * @param totalRepayment Total repaid by the anchor buyer: principal + profit.
     */
    function repay(uint256 dealId, uint96 totalRepayment) external nonReentrant onlyOwner {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);

        if (deal.totalFunded == 0) revert FundingClosed(dealId);
        if (
            deal.status != DealRegistry.DealStatus.Mintable &&
            deal.status != DealRegistry.DealStatus.Active
        ) {
            revert FundingClosed(dealId);
        }
        if (totalRepayment < deal.totalFunded) revert RepaymentBelowPrincipal();

        uint96 yieldPool = totalRepayment - deal.totalFunded;

        if (yieldPool > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), yieldPool);
        }

        nft.markDealMatured(dealId, yieldPool, deal.totalFunded);
        registry.markMatured(dealId);

        emit Repaid(dealId, totalRepayment, yieldPool);
    }

    // ---------------------------------------------------------------------
    // Redemption
    // ---------------------------------------------------------------------

    /**
     * @notice Redeem a matured receipt: pro-rata principal + yield, then burn.
     */
    function redeem(uint256 dealId) external nonReentrant {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (deal.status != DealRegistry.DealStatus.Matured) revert NotMatured(dealId);

        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(dealId, msg.sender);
        if (meta.principal == 0) revert NotInvestor(dealId, msg.sender);
        if (meta.status == BondReceiptNFT.ReceiptStatus.Redeemed) {
            revert AlreadyRedeemed(dealId, msg.sender);
        }

        uint256 payout = payoutFor(dealId, msg.sender);
        if (usdc.balanceOf(address(this)) < payout) revert InsufficientVaultBalance();

        usdc.safeTransfer(msg.sender, payout);
        nft.burnOnRedemption(dealId, msg.sender);

        if (nft.isFullyRedeemed(dealId)) {
            registry.completeDeal(dealId);
        }

        emit Redeemed(dealId, msg.sender, payout);
    }

    /**
     * @notice Principal-only return on a defaulted deal.
     */
    function claimDefault(uint256 dealId) external nonReentrant {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (deal.status != DealRegistry.DealStatus.Defaulted) revert NotDefaulted(dealId);

        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(dealId, msg.sender);
        if (meta.principal == 0) revert NotInvestor(dealId, msg.sender);
        // Double-claims are blocked: any completed claim burns the receipt
        // and flags it Redeemed. (A derived "Defaulted" status merely means
        // the deal defaulted, not that this investor already claimed.)
        if (meta.status == BondReceiptNFT.ReceiptStatus.Redeemed) {
            revert AlreadyRedeemed(dealId, msg.sender);
        }

        uint256 payout = uint256(meta.principal);
        if (usdc.balanceOf(address(this)) < payout) revert InsufficientVaultBalance();

        usdc.safeTransfer(msg.sender, payout);
        nft.markDealDefaulted(dealId);
        nft.markReceiptDefaulted(dealId, msg.sender);
        nft.burnOnRedemption(dealId, msg.sender);

        if (nft.isFullyRedeemed(dealId)) {
            registry.completeDeal(dealId);
        }

        emit DefaultClaimed(dealId, msg.sender, payout);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Yield accrued for one investor against a matured deal.
    function accruedYield(uint256 dealId, address investor) public view returns (uint256) {
        DealRegistry.Deal memory deal = registry.getDeal(dealId);
        BondReceiptNFT.DealSnapshot memory snap = nft.getDealSnapshot(dealId);
        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(dealId, investor);

        if (meta.principal == 0 || !snap.matured || deal.totalFunded == 0) return 0;
        return (uint256(meta.principal) * uint256(snap.yieldPool)) / uint256(snap.totalFunded);
    }

    /// @notice Total payout (principal + yield) for one investor.
    function payoutFor(uint256 dealId, address investor) public view returns (uint256) {
        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(dealId, investor);
        if (meta.principal == 0) return 0;
        return uint256(meta.principal) + accruedYield(dealId, investor);
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _requireConfigured(uint256 dealId) internal view returns (DealRegistry.Deal memory) {
        if (address(registry) == address(0) || address(nft) == address(0)) revert NotConfigured();
        return registry.getDeal(dealId);
    }
}
