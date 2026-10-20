// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { DealRegistry } from "../../../src/DealRegistry.sol";
import { BondReceiptNFT } from "../../../src/BondReceiptNFT.sol";

/**
 * @title RedemptionVault
 * @notice The only contract that holds and moves investor USDC.
 * @dev Mutated copy of src/RedemptionVault.sol. See that file for full docs.
 */
contract RedemptionVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPS_ROLE = keccak256("OPS_ROLE");

    IERC20 public usdc;
    DealRegistry public registry;
    BondReceiptNFT public nft;
    bool private _configured;

    error NotConfigured();
    error AlreadyConfigured();
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

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    function configure(IERC20 usdc_, DealRegistry registry_, BondReceiptNFT nft_) external onlyRole(ADMIN_ROLE) {
        if (_configured) revert AlreadyConfigured();
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
        _configured = true;
    }

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

    function repay(uint256 dealId, uint96 totalRepayment) external nonReentrant onlyRole(OPS_ROLE) {
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

    function redeem(uint256 dealId) external nonReentrant {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (deal.status != DealRegistry.DealStatus.Matured) revert NotMatured(dealId);

        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(dealId, msg.sender);
        if (meta.principal == 0) revert NotInvestor(dealId, msg.sender);
        // MUTANT M8: dropped the `AlreadyRedeemed` guard, so a receipt can be
        // redeemed more than once.

        uint256 payout = payoutFor(dealId, msg.sender);
        if (usdc.balanceOf(address(this)) < payout) revert InsufficientVaultBalance();

        usdc.safeTransfer(msg.sender, payout);
        nft.burnOnRedemption(dealId, msg.sender);

        if (nft.isFullyRedeemed(dealId)) {
            registry.completeDeal(dealId);
        }

        emit Redeemed(dealId, msg.sender, payout);
    }

    function claimDefault(uint256 dealId) external nonReentrant {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (deal.status != DealRegistry.DealStatus.Defaulted) revert NotDefaulted(dealId);

        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(dealId, msg.sender);
        if (meta.principal == 0) revert NotInvestor(dealId, msg.sender);
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

    function accruedYield(uint256 dealId, address investor) public view returns (uint256) {
        DealRegistry.Deal memory deal = registry.getDeal(dealId);
        BondReceiptNFT.DealSnapshot memory snap = nft.getDealSnapshot(dealId);
        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(dealId, investor);

        if (meta.principal == 0 || !snap.matured || deal.totalFunded == 0) return 0;
        return (uint256(meta.principal) * uint256(snap.yieldPool)) / uint256(snap.totalFunded);
    }

    function payoutFor(uint256 dealId, address investor) public view returns (uint256) {
        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(dealId, investor);
        if (meta.principal == 0) return 0;
        return uint256(meta.principal) + accruedYield(dealId, investor);
    }

    function _requireConfigured(uint256 dealId) internal view returns (DealRegistry.Deal memory) {
        if (address(registry) == address(0) || address(nft) == address(0)) revert NotConfigured();
        return registry.getDeal(dealId);
    }
}
