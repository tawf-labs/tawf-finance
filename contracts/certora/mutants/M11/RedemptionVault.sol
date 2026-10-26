// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Initializable } from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import { AccessControlUpgradeable } from "openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { DealRegistry } from "../../../src/DealRegistry.sol";
import { BondReceiptNFT } from "../../../src/BondReceiptNFT.sol";

/// @dev Uniswap-V3-style single-hop router, the shape most Arbitrum DEX routers expose.
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

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/**
 * @title RedemptionVault
 * @notice The only contract that holds and moves investor USDC.
 *
 * @dev Flow:
 *  1. invest()      — pulls USDC from the investor, records the deal funding
 *                     in DealRegistry, mints a soulbound receipt.
 *  2. disburse()    — once fully funded, the principal goes to the BPRS
 *                     servicer, which deploys it in the financing pool.
 *  3. repay()       — the deal's return comes back (principal + profit if
 *                     disbursed, profit only if not); Tawf's nisbah is taken
 *                     from the profit; deal transitions to Matured.
 *  4. redeem()      — pro-rata payout of principal + yield; receipt burned.
 *  5. default       — the servicer remits what was recovered
 *                     (settleDefault). Holders share it pro rata
 *                     (claimDefault): musyarakah losses fall on the capital,
 *                     not on Tawf. Tawf's own money covers a loss ONLY after
 *                     the DPS/auditor records negligence or misconduct
 *                     (recordNegligence + payNegligence). A deal never
 *                     disbursed returns its undeployed funds at par.
 *
 *      Settlement token: `usdc` (kept under its original name so the ABI and
 *      scripts stay stable) is the token every deal is denominated and paid in.
 *      Production sets it to USDG (Global Dollar). Investors may also pay in
 *      other allow-listed stablecoins (USDC, USDT); those are swapped to the
 *      settlement token on the way in, and the deal is credited with what the
 *      swap actually returned. USDG yield/rewards that reach the vault are not
 *      owed to anyone: `sweepYield` forwards exactly that surplus (balance
 *      above tracked liabilities) to the fixed `yieldRecipient` (Tawf
 *      Foundation partners), and can never touch investor funds.
 *
 *      Checks-effects-interactions and ReentrancyGuard everywhere money
 *      moves. The vault never holds more than what deals owe + pending yield.
 */
contract RedemptionVault is Initializable, AccessControlUpgradeable, ReentrancyGuard, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPS_ROLE = keccak256("OPS_ROLE");
    /// @notice The BPRS servicer: receives disbursements, remits recoveries.
    bytes32 public constant SERVICER_ROLE = keccak256("SERVICER_ROLE");
    /// @notice DPS / independent auditor: the only role that can find Tawf
    ///         liable for negligence or misconduct on a defaulted deal.
    bytes32 public constant NEGLIGENCE_ROLE = keccak256("NEGLIGENCE_ROLE");

    /// @notice Settlement token (USDG in production). Name kept for ABI stability.
    IERC20 public usdc;
    /// @notice Other stablecoins investors may pay in; swapped to `usdc` on invest.
    mapping(address => bool) public acceptedInput;
    ISwapRouter public swapRouter;
    uint24 public swapFee;
    /// @notice Max tolerated shortfall of a swap vs 1:1, in bps (stable-to-stable).
    uint256 public slippageBps;
    /// @notice Where swept USDG yield goes (Tawf Foundation partners wallet).
    address public yieldRecipient;
    /// @notice Settlement-token amount the vault owes investors, the servicer
    ///         flow and open default claims. Anything above it is surplus.
    uint256 public liabilities;
    DealRegistry public registry;
    BondReceiptNFT public nft;

    /// @notice Highest Tawf nisbah accepted (50% of a deal's profit).
    uint16 public constant MAX_TAWF_NISBAH_BPS = 5000;
    /// @notice Where Tawf's profit share is paid.
    address public feeRecipient;
    /// @notice Tawf's share of each deal's profit (musyarakah / wakalah bil
    ///         istithmar sell-down), in basis points. Fixed before the deal
    ///         opens to investors; a default pays no share.
    mapping(uint256 => uint16) public dealNisbahBps;

    /// @notice Principal sent to the servicer (0 = still held, undeployed).
    mapping(uint256 => uint96) public disbursedPrincipal;
    /// @notice Recovery the servicer remitted after a default.
    mapping(uint256 => uint96) public defaultRecovery;
    mapping(uint256 => bool) public defaultSettled;
    /// @notice Tawf's liability for negligence/misconduct, as found by the
    ///         NEGLIGENCE_ROLE, and how much of it has been paid in.
    mapping(uint256 => uint96) public negligenceLiability;
    mapping(uint256 => uint96) public negligencePaid;
    /// @notice Holders can claim once recovery (and any negligence cover) is in.
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
    error SwapNotConfigured();
    error InvalidSlippage();
    error NothingToSweep();

    event Invested(uint256 indexed dealId, address indexed investor, uint96 amount);
    event InvestedWithSwap(
        uint256 indexed dealId, address indexed investor, address indexed tokenIn, uint256 amountIn, uint96 credited
    );
    event InputTokenSet(address indexed token, bool accepted);
    event SwapRouterSet(address indexed router, uint24 fee, uint256 slippageBps);
    event YieldRecipientSet(address indexed recipient);
    event YieldSwept(address indexed to, uint256 amount);
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _lockImplementation();
    }

    /// @dev Locks the bare implementation so only proxies can be initialised.
    ///      Virtual so a verification harness can skip it.
    function _lockImplementation() internal virtual {
        _disableInitializers();
    }

    /// @notice One-time proxy setup. `admin` receives DEFAULT_ADMIN_ROLE,
    ///         ADMIN_ROLE and UPGRADER_ROLE. Move UPGRADER_ROLE to a Safe or
    ///         timelock later with grantRole / revokeRole, no redeploy needed.
    function initialize(address admin) public initializer {
        __AccessControl_init();
        swapFee = 3000;
        slippageBps = 50;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    /// @dev UUPS: only UPGRADER_ROLE may point the proxy at a new implementation.
    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}

    // ---------------------------------------------------------------------
    // Admin configuration
    // ---------------------------------------------------------------------

    /// @notice One-time wiring of the token, registry, and receipt contracts.
    /// @dev Callable exactly once. The original version could be re-called
    ///      at any time by the owner, silently repointing custody-adjacent
    ///      state post go-live; that gap is closed here.
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

    /// @notice Allow (or stop allowing) a stablecoin as an investment input.
    ///         The settlement token itself is always accepted.
    function setInputToken(address token, bool accepted) external onlyRole(ADMIN_ROLE) {
        if (token == address(0) || token == address(usdc)) revert InvalidAddress();
        acceptedInput[token] = accepted;
        emit InputTokenSet(token, accepted);
    }

    function setSwapRouter(ISwapRouter router_, uint24 fee_, uint256 slippageBps_) external onlyRole(ADMIN_ROLE) {
        if (address(router_) == address(0)) revert InvalidAddress();
        if (slippageBps_ > 300) revert InvalidSlippage();
        swapRouter = router_;
        swapFee = fee_;
        slippageBps = slippageBps_;
        emit SwapRouterSet(address(router_), fee_, slippageBps_);
    }

    /// @notice Where swept yield is paid. Fixed here so `sweepYield` can be public.
    function setYieldRecipient(address recipient) external onlyRole(ADMIN_ROLE) {
        if (recipient == address(0) || recipient == address(this)) revert InvalidAddress();
        yieldRecipient = recipient;
        emit YieldRecipientSet(recipient);
    }

    /// @notice The token deals are denominated and paid in (USDG in production).
    function settlementToken() external view returns (address) {
        return address(usdc);
    }

    /// @notice Settlement tokens held above what the vault owes.
    function surplus() public view returns (uint256) {
        uint256 bal = usdc.balanceOf(address(this));
        return bal > liabilities ? bal - liabilities : 0;
    }

    /// @notice Forward the surplus (USDG yield / rewards / dust) to `yieldRecipient`.
    ///         Callable by anyone; it can only ever move tokens that nothing is owed.
    function sweepYield() external nonReentrant returns (uint256 amount) {
        address to = yieldRecipient;
        if (to == address(0)) revert InvalidAddress();
        amount = surplus();
        if (amount == 0) revert NothingToSweep();
        usdc.safeTransfer(to, amount);
        emit YieldSwept(to, amount);
    }

    // ---------------------------------------------------------------------
    // Investing
    // ---------------------------------------------------------------------

    /**
     * @notice Invest the settlement token into a Mintable deal and receive a
     *         soulbound receipt. Caller must have approved this vault for `amount`.
     */
    function invest(uint256 dealId, uint96 amount) external nonReentrant {
        _invest(dealId, address(usdc), amount);
    }

    /**
     * @notice Invest with `tokenIn`: the settlement token directly, or an
     *         allow-listed stablecoin (USDC/USDT) that is swapped to it first.
     *         The deal is credited with the swap's actual output.
     */
    function investWithToken(uint256 dealId, address tokenIn, uint96 amount) external nonReentrant {
        _invest(dealId, tokenIn, amount);
    }

    function _invest(uint256 dealId, address tokenIn, uint96 amount) internal {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (deal.status != DealRegistry.DealStatus.Mintable) revert FundingClosed(dealId);

        uint96 credited = amount;
        if (tokenIn == address(usdc)) {
            usdc.safeTransferFrom(msg.sender, address(this), amount);
        } else if (acceptedInput[tokenIn]) {
            credited = _swapIn(tokenIn, amount);
        } else {
            revert UnsupportedToken(tokenIn);
        }

        // Bounds apply to what the deal is credited, not what was paid in.
        if (credited < deal.minInvestment) revert AmountBelowMinimum();
        if (credited > deal.fundingTarget - deal.totalFunded) revert FundingClosed(dealId);

        liabilities += credited;
        registry.fundDeal(dealId, msg.sender, credited);
        nft.mint(
            msg.sender,
            dealId,
            credited,
            deal.apyBps,
            deal.durationDays,
            deal.supplierName,
            deal.anchorBuyer
        );

        emit Invested(dealId, msg.sender, credited);
        if (tokenIn != address(usdc)) emit InvestedWithSwap(dealId, msg.sender, tokenIn, amount, credited);
    }

    function _swapIn(address tokenIn, uint96 amount) internal returns (uint96 credited) {
        if (address(swapRouter) == address(0)) revert SwapNotConfigured();
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(tokenIn).forceApprove(address(swapRouter), amount);

        uint256 balBefore = usdc.balanceOf(address(this));
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: address(usdc),
                fee: swapFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amount,
                amountOutMinimum: (uint256(amount) * (10_000 - slippageBps)) / 10_000,
                sqrtPriceLimitX96: 0
            })
        );
        IERC20(tokenIn).forceApprove(address(swapRouter), 0);

        // Trust the balance delta, not the router's return value.
        uint256 received = usdc.balanceOf(address(this)) - balBefore;
        if (received == 0 || received > type(uint96).max) revert InvalidAddress();
        credited = uint96(received);
    }

    // ---------------------------------------------------------------------
    // Tawf's profit share
    // ---------------------------------------------------------------------

    /// @notice Set where Tawf's profit share is paid.
    function setFeeRecipient(address recipient) external onlyRole(ADMIN_ROLE) {
        if (recipient == address(0) || recipient == address(this)) revert InvalidAddress();
        feeRecipient = recipient;
        emit FeeRecipientSet(recipient);
    }

    /// @notice Set Tawf's nisbah for `dealId`. Only before the deal is
    ///         Mintable: investors fund it under the disclosed ratio.
    function setDealNisbah(uint256 dealId, uint16 nisbahBps) external onlyRole(OPS_ROLE) {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (
            false // MUTANT M11: nisbah editable after the deal opens
        ) revert NisbahLocked(dealId);
        if (nisbahBps > MAX_TAWF_NISBAH_BPS) revert InvalidNisbah();
        if (nisbahBps != 0 && feeRecipient == address(0)) revert InvalidAddress();
        dealNisbahBps[dealId] = nisbahBps;
        emit DealNisbahSet(dealId, nisbahBps);
    }

    // ---------------------------------------------------------------------
    // Disbursement and default settlement
    // ---------------------------------------------------------------------

    /// @notice Send a fully funded deal's principal to the BPRS servicer.
    function disburse(uint256 dealId, address servicer) external nonReentrant onlyRole(OPS_ROLE) {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (deal.status != DealRegistry.DealStatus.Active) revert NotDisbursable(dealId);
        if (disbursedPrincipal[dealId] != 0) revert AlreadyDisbursed(dealId);
        if (!hasRole(SERVICER_ROLE, servicer)) revert NotServicer(servicer);
        disbursedPrincipal[dealId] = deal.totalFunded;
        liabilities -= deal.totalFunded;
        usdc.safeTransfer(servicer, deal.totalFunded);
        emit Disbursed(dealId, servicer, deal.totalFunded);
    }

    /// @notice The servicer remits what it recovered on a defaulted, disbursed
    ///         deal (at most the principal disbursed).
    function settleDefault(uint256 dealId, uint96 recovery) external nonReentrant onlyRole(SERVICER_ROLE) {
        DealRegistry.Deal memory deal = _requireConfigured(dealId);
        if (deal.status != DealRegistry.DealStatus.Defaulted) revert NotDefaulted(dealId);
        if (disbursedPrincipal[dealId] == 0) revert NotDisbursable(dealId);
        if (defaultSettled[dealId]) revert DefaultAlreadySettled(dealId);
        if (recovery > disbursedPrincipal[dealId]) revert RecoveryExceedsPrincipal();
        defaultSettled[dealId] = true;
        defaultRecovery[dealId] = recovery;
        liabilities += recovery;
        if (recovery > 0) usdc.safeTransferFrom(msg.sender, address(this), recovery);
        emit DefaultRecovered(dealId, msg.sender, recovery);
    }

    /// @notice The DPS / independent auditor finds Tawf liable for negligence
    ///         or misconduct on a defaulted deal, up to the unrecovered loss.
    ///         The only way Tawf's own money can cover a principal loss.
    function recordNegligence(uint256 dealId, uint96 liability, bytes32 evidenceHash)
        external
        onlyRole(NEGLIGENCE_ROLE)
    {
        if (!defaultSettled[dealId]) revert DefaultNotSettled(dealId);
        if (defaultClaimsOpen[dealId]) revert DefaultClaimsOpen(dealId);
        if (evidenceHash == bytes32(0)) revert NoEvidence();
        // Revisable until Tawf starts paying it in; then it is final.
        if (negligencePaid[dealId] != 0) revert NegligenceAlreadyPaid(dealId);
        if (uint256(defaultRecovery[dealId]) + liability > disbursedPrincipal[dealId]) revert RecoveryExceedsPrincipal();
        negligenceLiability[dealId] = liability;
        emit NegligenceRecorded(dealId, liability, evidenceHash, msg.sender);
    }

    /// @notice Tawf pays in the negligence liability found for `dealId`.
    function payNegligence(uint256 dealId) external nonReentrant {
        if (defaultClaimsOpen[dealId]) revert DefaultClaimsOpen(dealId);
        uint96 owed = negligenceLiability[dealId] - negligencePaid[dealId];
        if (owed == 0) revert NothingOwed();
        negligencePaid[dealId] += owed;
        liabilities += owed;
        usdc.safeTransferFrom(msg.sender, address(this), owed);
        emit NegligencePaid(dealId, msg.sender, owed);
    }

    /// @notice Open holder claims on a defaulted, disbursed deal once the
    ///         recovery and any negligence liability are in.
    function openDefaultClaims(uint256 dealId) external onlyRole(OPS_ROLE) {
        if (!defaultSettled[dealId]) revert DefaultNotSettled(dealId);
        if (defaultClaimsOpen[dealId]) revert DefaultClaimsOpen(dealId);
        if (negligencePaid[dealId] != negligenceLiability[dealId]) revert NegligenceUnpaid(dealId);
        defaultClaimsOpen[dealId] = true;
        emit DefaultClaimsOpened(dealId, defaultRecovery[dealId], negligencePaid[dealId]);
    }

    /// @notice What `investor` receives from a defaulted deal: par if the
    ///         principal was never deployed, otherwise their pro-rata share of
    ///         the recovery plus any negligence cover.
    function defaultPayoutFor(uint256 dealId, address investor) public view returns (uint256) {
        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(dealId, investor);
        uint96 disbursed = disbursedPrincipal[dealId];
        if (disbursed == 0) return meta.principal;
        uint256 pool = uint256(defaultRecovery[dealId]) + negligencePaid[dealId];
        return (uint256(meta.principal) * pool) / disbursed;
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
     *
     * @dev Gated by OPS_ROLE rather than a single owner, held by a multisig
     *      requiring at least two of BPRS finance, Tawf ops, and an
     *      independent auditor (regulation.md, disbursement-integrity
     *      staged path, stage 1). This is the single highest-risk function
     *      in the system, the amount is currently supplied by the caller
     *      with no on-chain check against real collections.
     */
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
        // Tawf's nisbah of the profit; investors share the rest pro rata.
        uint96 share = uint96((uint256(yieldPool) * dealNisbahBps[dealId]) / 10_000);

        // A disbursed deal returns its principal too; otherwise the vault
        // still holds it.
        uint256 pull = uint256(yieldPool) + disbursedPrincipal[dealId];
        liabilities += pull - share;
        if (pull > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), pull);
        }
        if (share > 0) {
            usdc.safeTransfer(feeRecipient, share);
            emit TawfShareTaken(dealId, share, feeRecipient);
        }

        nft.markDealMatured(dealId, yieldPool - share, deal.totalFunded);
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

        liabilities -= payout;
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

        // Deployed capital bears the loss pro rata; Tawf covers it only via a
        // recorded negligence finding (see recordNegligence).
        if (disbursedPrincipal[dealId] != 0 && !defaultClaimsOpen[dealId]) revert DefaultClaimsNotOpen(dealId);
        uint256 payout = defaultPayoutFor(dealId, msg.sender);
        if (usdc.balanceOf(address(this)) < payout) revert InsufficientVaultBalance();

        liabilities -= payout;
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

    /// @dev Reserved storage so later versions can add state without shifting the layout.
    uint256[50] private __gap;
}
