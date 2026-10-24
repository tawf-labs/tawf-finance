// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { DealRegistry } from "./DealRegistry.sol";
import { BondReceiptNFT } from "./BondReceiptNFT.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

/**
 * @title RedemptionVault
 * @notice Holds investor stablecoins. Accepts USDC, USDT, and USDG; swaps
 *         USDC/USDT to USDG via a router to leverage USDG yield.
 */
contract RedemptionVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPS_ROLE = keccak256("OPS_ROLE");
    bytes32 public constant SERVICER_ROLE = keccak256("SERVICER_ROLE");
    bytes32 public constant NEGLIGENCE_ROLE = keccak256("NEGLIGENCE_ROLE");

    IERC20 public usdc;
    IERC20 public usdt;
    IERC20 public usdg;
    ISwapRouter public swapRouter;
    uint24 public swapFee;
    uint256 public slippageBps;

    DealRegistry public registry;
    BondReceiptNFT public nft;

    uint16 public constant MAX_TAWF_NISBAH_BPS = 5000;
    address public feeRecipient;
    mapping(uint256 => uint16) public dealNisbahBps;

    mapping(uint256 => uint96) public disbursedPrincipal;
    mapping(uint256 => uint96) public defaultRecovery;
    mapping(uint256 => bool) public defaultSettled;
    mapping(uint256 => uint96) public negligenceLiability;
    mapping(uint256 => uint96) public negligencePaid;
    mapping(uint256 => bool) public defaultClaimsOpen;
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
    error NisbahLocked(uint256 dealId);
    error InvalidNisbah();
    error NotDisbursable(uint256 dealId);
    error AlreadyDisbursed(uint256 dealId);
    error NotServicer(address to);
    error DefaultAlreadySettled(uint256 dealId);
    error DefaultNotSettled(uint256 dealId);
    error DefaultClaimsOpen(uint256 dealId);
    error DefaultClaimsNotOpen(uint256 dealId);
    error RecoveryExceedsPrincipal();
    error NoEvidence();
    error NothingOwed();
    error NegligenceUnpaid(uint256 dealId);
    error NegligenceAlreadyPaid(uint256 dealId);
    error UnsupportedToken(address token);
    error SwapFailed();

    event Invested(uint256 indexed dealId, address indexed investor, address indexed tokenIn, uint96 amountIn, uint96 amountUsdG);
    event Repaid(uint256 indexed dealId, uint96 totalRepayment, uint96 yieldPool);
    event Redeemed(uint256 indexed dealId, address indexed investor, uint256 payout);
    event DefaultClaimed(uint256 indexed dealId, address indexed investor, uint256 payout);
    event FeeRecipientSet(address feeRecipient);
    event DealNisbahSet(uint256 indexed dealId, uint16 nisbahBps);
    event TawfShareTaken(uint256 indexed dealId, uint96 share, address indexed feeRecipient);
    event Disbursed(uint256 indexed dealId, address indexed servicer, uint96 principal);
    event DefaultRecovered(uint256 indexed dealId, address indexed servicer, uint96 recovery);
    event NegligenceRecorded(uint256 indexed dealId, uint96 liability, bytes32 evidenceHash, address indexed by);
    event NegligencePaid(uint256 indexed dealId, address indexed payer, uint96 amount);
    event DefaultClaimsOpened(uint256 indexed dealId, uint96 recovered, uint96 negligencePaid);
    event SwapRouterSet(address router, uint24 fee, uint256 slippageBps);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        slippageBps = 50; // 0.5%
        swapFee = 3000;
    }

    function configure(
        IERC20 usdc_,
        IERC20 usdt_,
        IERC20 usdg_,
        DealRegistry registry_,
        BondReceiptNFT nft_
    ) external onlyRole(ADMIN_ROLE) {
        if (_configured) revert AlreadyConfigured();
        if (
            address(usdc_) == address(0) ||
            address(usdt_) == address(0) ||
            address(usdg_) == address(0) ||
            address(registry_) == address(0) ||
            address(nft_) == address(0)
        ) {
            revert InvalidAddress();
        }
        usdc = usdc_;
        usdt = usdt_;
        usdg = usdg_;
        registry = registry_;
        nft = nft_;
        _configured = true;
    }

    function setSwapRouter(ISwapRouter router_, uint24 fee_, uint256 slippageBps_) external onlyRole(ADMIN_ROLE) {
        if (address(router_) == address(0)) revert InvalidAddress();
        swapRouter = router_;
        swapFee = fee_;
        slippageBps = slippageBps_;
        emit SwapRouterSet(address(router_), fee_, slippageBps_);
    }

    function invest(uint256 dealId, uint96 amount) external nonReentrant {
        invest(dealId, address(usdc), amount);
    }

    function invest(uint256 dealId, address tokenIn, uint96 amount) public nonReentrant {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);

        if (deal.status != DealRegistry.DealStatus.Mintable) revert FundingClosed(dealId);
        if (amount < deal.minInvestment) revert AmountBelowMinimum();
        if (amount > deal.fundingTarget - deal.totalFunded) revert FundingClosed(dealId);

        if (tokenIn == address(usdc) || tokenIn == address(usdt)) {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amount);
            IERC20(tokenIn).forceApprove(address(swapRouter), amount);
            uint256 amountOutMin = (amount * (10000 - slippageBps)) / 10000;
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: address(usdg),
                fee: swapFee,
                recipient: address(this),
                deadline: block.timestamp + 300,
                amountIn: amount,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            });
            uint256 amountOut = swapRouter.exactInputSingle(params);
            if (amountOut == 0) revert SwapFailed();
            registry.fundDeal(dealId, msg.sender, uint96(amountOut));
            nft.mint(msg.sender, dealId, uint96(amountOut), deal.apyBps, deal.durationDays, deal.supplierName, deal.anchorBuyer);
            emit Invested(dealId, msg.sender, tokenIn, amount, uint96(amountOut));
        } else if (tokenIn == address(usdg)) {
            usdg.safeTransferFrom(msg.sender, address(this), amount);
            registry.fundDeal(dealId, msg.sender, amount);
            nft.mint(msg.sender, dealId, amount, deal.apyBps, deal.durationDays, deal.supplierName, deal.anchorBuyer);
            emit Invested(dealId, msg.sender, tokenIn, amount, amount);
        } else {
            revert UnsupportedToken(tokenIn);
        }
    }

    function setFeeRecipient(address recipient) external onlyRole(ADMIN_ROLE) {
        if (recipient == address(0) || recipient == address(this)) revert InvalidAddress();
        feeRecipient = recipient;
        emit FeeRecipientSet(recipient);
    }

    function setDealNisbah(uint256 dealId, uint16 nisbahBps) external onlyRole(OPS_ROLE) {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (deal.status != DealRegistry.DealStatus.Submitted && deal.status != DealRegistry.DealStatus.BmtApproved) {
            revert NisbahLocked(dealId);
        }
        if (nisbahBps > MAX_TAWF_NISBAH_BPS) revert InvalidNisbah();
        if (nisbahBps != 0 && feeRecipient == address(0)) revert InvalidAddress();
        dealNisbahBps[dealId] = nisbahBps;
        emit DealNisbahSet(dealId, nisbahBps);
    }

    function disburse(uint256 dealId, address servicer) external nonReentrant onlyRole(OPS_ROLE) {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (deal.status != DealRegistry.DealStatus.Active) revert NotDisbursable(dealId);
        if (disbursedPrincipal[dealId] != 0) revert AlreadyDisbursed(dealId);
        if (!hasRole(SERVICER_ROLE, servicer)) revert NotServicer(servicer);
        disbursedPrincipal[dealId] = deal.totalFunded;
        usdg.safeTransfer(servicer, deal.totalFunded);
        emit Disbursed(dealId, servicer, deal.totalFunded);
    }

    function settleDefault(uint256 dealId, uint96 recovery) external nonReentrant onlyRole(SERVICER_ROLE) {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (deal.status != DealRegistry.DealStatus.Defaulted) revert NotDefaulted(dealId);
        if (disbursedPrincipal[dealId] == 0) revert NotDisbursable(dealId);
        if (defaultSettled[dealId]) revert DefaultAlreadySettled(dealId);
        if (recovery > disbursedPrincipal[dealId]) revert RecoveryExceedsPrincipal();
        defaultSettled[dealId] = true;
        defaultRecovery[dealId] = recovery;
        if (recovery > 0) usdg.safeTransferFrom(msg.sender, address(this), recovery);
        emit DefaultRecovered(dealId, msg.sender, recovery);
    }

    function recordNegligence(uint256 dealId, uint96 liability, bytes32 evidenceHash)
        external
        onlyRole(NEGLIGENCE_ROLE)
    {
        if (!defaultSettled[dealId]) revert DefaultNotSettled(dealId);
        if (defaultClaimsOpen[dealId]) revert DefaultClaimsOpen(dealId);
        if (evidenceHash == bytes32(0)) revert NoEvidence();
        if (negligencePaid[dealId] != 0) revert NegligenceAlreadyPaid(dealId);
        if (uint256(defaultRecovery[dealId]) + liability > disbursedPrincipal[dealId]) revert RecoveryExceedsPrincipal();
        negligenceLiability[dealId] = liability;
        emit NegligenceRecorded(dealId, liability, evidenceHash, msg.sender);
    }

    function payNegligence(uint256 dealId) external nonReentrant {
        if (defaultClaimsOpen[dealId]) revert DefaultClaimsOpen(dealId);
        uint96 owed = negligenceLiability[dealId] - negligencePaid[dealId];
        if (owed == 0) revert NothingOwed();
        negligencePaid[dealId] += owed;
        usdg.safeTransferFrom(msg.sender, address(this), owed);
        emit NegligencePaid(dealId, msg.sender, owed);
    }

    function openDefaultClaims(uint256 dealId) external onlyRole(OPS_ROLE) {
        if (!defaultSettled[dealId]) revert DefaultNotSettled(dealId);
        if (defaultClaimsOpen[dealId]) revert DefaultClaimsOpen(dealId);
        if (negligencePaid[dealId] != negligenceLiability[dealId]) revert NegligenceUnpaid(dealId);
        defaultClaimsOpen[dealId] = true;
        emit DefaultClaimsOpened(dealId, defaultRecovery[dealId], negligencePaid[dealId]);
    }

    function defaultPayoutFor(uint256 dealId, address investor) public view returns (uint256) {
        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(dealId, investor);
        uint96 disbursed = disbursedPrincipal[dealId];
        if (disbursed == 0) return meta.principal;
        uint256 pool = uint256(defaultRecovery[dealId]) + negligencePaid[dealId];
        return (uint256(meta.principal) * pool) / disbursed;
    }

    function repay(uint256 dealId, uint96 totalRepayment) external nonReentrant onlyRole(OPS_ROLE) {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);

        if (deal.totalFunded == 0) revert FundingClosed(dealId);
        if (deal.status != DealRegistry.DealStatus.Mintable && deal.status != DealRegistry.DealStatus.Active) {
            revert FundingClosed(dealId);
        }
        if (totalRepayment < deal.totalFunded) revert RepaymentBelowPrincipal();

        uint96 yieldPool = totalRepayment - deal.totalFunded;
        uint96 share = uint96((uint256(yieldPool) * dealNisbahBps[dealId]) / 10000);

        uint256 pull = uint256(yieldPool) + disbursedPrincipal[dealId];
        if (pull > 0) {
            usdg.safeTransferFrom(msg.sender, address(this), pull);
        }
        if (share > 0) {
            usdg.safeTransfer(feeRecipient, share);
            emit TawfShareTaken(dealId, share, feeRecipient);
        }

        nft.markDealMatured(dealId, yieldPool - share, deal.totalFunded);
        registry.markMatured(dealId);

        emit Repaid(dealId, totalRepayment, yieldPool);
    }

    function redeem(uint256 dealId) external nonReentrant {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (deal.status != DealRegistry.DealStatus.Matured) revert NotMatured(dealId);

        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(dealId, msg.sender);
        if (meta.principal == 0) revert NotInvestor(dealId, msg.sender);
        if (meta.status == BondReceiptNFT.ReceiptStatus.Redeemed) {
            revert AlreadyRedeemed(dealId, msg.sender);
        }

        uint256 payout = payoutFor(dealId, msg.sender);
        if (usdg.balanceOf(address(this)) < payout) revert InsufficientVaultBalance();

        usdg.safeTransfer(msg.sender, payout);
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

        if (disbursedPrincipal[dealId] != 0 && !defaultClaimsOpen[dealId]) revert DefaultClaimsNotOpen(dealId);
        uint256 payout = defaultPayoutFor(dealId, msg.sender);
        if (usdg.balanceOf(address(this)) < payout) revert InsufficientVaultBalance();

        usdg.safeTransfer(msg.sender, payout);
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
        if (address(registry) == address(0) || address(nft) == address(0) || address(usdg) == address(0)) {
            revert NotConfigured();
        }
        return registry.getDeal(dealId);
    }
}
