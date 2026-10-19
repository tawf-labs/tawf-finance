// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { ITrexToken } from "../interfaces/ITrexToken.sol";
import { ILedgerAnchor } from "../sukuk/ILedgerAnchor.sol";
import { IBalanceCheckpoint } from "../sukuk/IBalanceCheckpoint.sol";
import { LedgerLeaf } from "../lib/LedgerLeaf.sol";
import { ProfitAccumulator } from "../lib/ProfitAccumulator.sol";

/// @dev Minimal view of the SandboxModule's eligibility gate.
interface ISandboxEligibility {
    function isEligible(address compliance, address who) external view returns (bool);
}

/**
 * @title TawfDepositoSeries
 * @notice The cash and supply side of one Tawf deposito series (Model B: a
 *         wrapped Tawf deposit). Investors subscribe in USDC; Tawf converts to
 *         IDR off chain and places it in a single dedicated deposito account
 *         at the BPRS. One token (ERC-3643, 2 decimals, sen) is a claim ON
 *         TAWF for IDR 1 per unit, backed by that account. The token is an
 *         externally deployed T-REX token that this contract drives as its
 *         AGENT (mint on allocate, burn on redeem).
 *
 * @dev Pragma ^0.8.24 and OZ v5, with the token reached only through
 *      ITrexToken, so this contract interoperates with the 0.8.17-pinned
 *      T-REX Token without importing it. A DistributionCheckpointModule
 *      (0.8.17) bound to the token's compliance calls afterBalanceChange so
 *      profit follows the holder of record across transfers. A SandboxModule
 *      on the same compliance is the eligibility and caps gate; this contract
 *      only reads its isEligible view to fail fast before cash moves.
 *
 *      Shown, never told. allocate requires a DEPOSITO_RESERVE proof for the
 *      series' dedicated account (subject = seriesId) and never lets supply
 *      exceed that anchored balance. distributeProfit requires a
 *      DEPOSITO_PROFIT proof and pays exactly the anchored amount, pro rata.
 *      settleMaturity requires a DEPOSITO_MATURITY proof. There is no promised
 *      return: profit is whatever the bank credited and Tawf funded.
 *
 *      FX: USDC (6 decimals) converts to sen (2 decimals) at a rate an
 *      FX_ROLE posts on chain (idrPerUsdc, two-decimal precision: 1 USDC =
 *      idrPerUsdc / 100 IDR), with a timestamp. Actions that use the rate
 *      reject it when older than maxRateAge.
 *
 *      Checks-effects-interactions and ReentrancyGuard guard every cash move.
 */
contract TawfDepositoSeries is AccessControl, ReentrancyGuard, IBalanceCheckpoint {
    using SafeERC20 for IERC20;
    using ProfitAccumulator for ProfitAccumulator.State;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant FX_ROLE = keccak256("FX_ROLE");

    uint256 private constant PRECISION = 1e18;
    /// @dev USDC base units per whole USDC (6 decimals).
    uint256 private constant USDC_ONE = 1e6;

    struct Terms {
        /// @dev Series id on the Tawf Network ReserveLedger (subject of the
        ///      DEPOSITO_RESERVE / DEPOSITO_PROFIT / DEPOSITO_MATURITY leaves).
        bytes32 seriesId;
        uint8 tenorMonths;
        uint16 nisbahBps;
    }

    IERC20 public immutable usdc;
    ILedgerAnchor public immutable anchor;
    ITrexToken public immutable token;
    /// @dev The DistributionCheckpointModule bound to the token's compliance.
    address public immutable module;
    /// @dev The SandboxModule eligibility gate and the compliance it guards.
    ISandboxEligibility public immutable sandbox;
    address public immutable compliance;
    uint256 public immutable ledgerChainId;
    /// @dev Where escrowed USDC goes on allocation, and the source of USDC for
    ///      profit and principal funding: the Tawf treasury.
    address public treasury;

    Terms public terms;

    // --- FX rate (posted by FX_ROLE) ---
    /// @notice IDR per 1 USDC, two-decimal precision (e.g. 16_000.00 -> 1_600_000).
    uint256 public idrPerUsdc;
    uint64 public rateUpdatedAt;
    uint64 public maxRateAge;

    // --- Subscription escrow ---
    /// @notice USDC a subscriber has escrowed and not yet had allocated.
    mapping(address => uint256) public pendingUsdc;

    // --- Reserve (anchored account balance in sen) ---
    uint64 public reserveSnapshotAt;
    uint256 public reserveBalance;

    // --- Profit / maturity ---
    uint32 public lastPeriod;
    bool public redemptionOpen;
    /// @notice USDC per token unit paid at redemption, scaled by 1e18.
    uint256 public redemptionPerToken;

    ProfitAccumulator.State private _profit;

    error InvalidAddress();
    error InvalidTerms();
    error ZeroAmount();
    error NotEligible(address investor);
    error NoPending();
    error RedemptionAlreadyOpen();
    error RedemptionNotOpen();
    error RateUnset();
    error RateStale(uint64 updatedAt, uint64 maxAge);
    error ProofInvalid();
    error ReserveNotNewer(uint64 stored, uint64 got);
    error ReserveInsufficient(uint256 supplyAfter, uint256 balance);
    error ProfitPeriodNotSequential(uint32 expected, uint32 got);
    error NothingToClaim();
    error OnlyModule();

    event RatePosted(uint256 idrPerUsdc, uint64 updatedAt);
    event MaxRateAgeSet(uint64 maxRateAge);
    event TreasurySet(address treasury);
    event Subscribed(address indexed investor, uint256 usdcAmount, uint256 pending);
    event SubscriptionCancelled(address indexed investor, uint256 usdcRefunded);
    event Allocated(address indexed investor, uint256 usdcUsed, uint256 senMinted);
    event ReserveUpdated(uint64 snapshotAt, uint256 balance);
    event ProfitDistributed(uint32 indexed period, uint256 profitSen, uint256 usdcFunded);
    event ProfitClaimed(address indexed investor, uint256 usdcAmount);
    event MaturitySettled(uint64 at, uint256 principalSen, uint256 usdcFunded);
    event Redeemed(address indexed investor, uint256 units, uint256 usdcPaid, uint256 profitPaid);

    /// @param usdc_ Settlement token (USDC/MockUSDC, 6 decimals).
    /// @param anchor_ LedgerAnchor the Tawf Network roots are anchored on.
    /// @param token_ The series T-REX token (2 decimals, sen); this contract
    ///        must be one of its AGENTs.
    /// @param module_ DistributionCheckpointModule bound to the token's
    ///        compliance; the only address allowed to call afterBalanceChange.
    /// @param sandbox_ SandboxModule eligibility gate.
    /// @param compliance_ The ModularCompliance the SandboxModule guards.
    /// @param terms_ Series terms (seriesId, tenor, nisbah).
    /// @param treasury_ The Tawf treasury (escrow sink + funding source).
    /// @param admin DEFAULT_ADMIN_ROLE + ADMIN_ROLE holder.
    /// @param operator OPERATOR_ROLE holder (Tawf ops).
    /// @param maxRateAge_ Maximum age of the FX rate for rate-using actions.
    constructor(
        IERC20 usdc_,
        ILedgerAnchor anchor_,
        ITrexToken token_,
        address module_,
        ISandboxEligibility sandbox_,
        address compliance_,
        Terms memory terms_,
        address treasury_,
        address admin,
        address operator,
        uint64 maxRateAge_
    ) {
        if (
            address(usdc_) == address(0) || address(anchor_) == address(0) || address(token_) == address(0)
                || module_ == address(0) || address(sandbox_) == address(0) || compliance_ == address(0)
                || treasury_ == address(0) || admin == address(0) || operator == address(0)
        ) revert InvalidAddress();
        if (terms_.seriesId == bytes32(0) || terms_.nisbahBps > 10_000) revert InvalidTerms();

        usdc = usdc_;
        anchor = anchor_;
        token = token_;
        module = module_;
        sandbox = sandbox_;
        compliance = compliance_;
        ledgerChainId = anchor_.ledgerChainId();
        terms = terms_;
        treasury = treasury_;
        maxRateAge = maxRateAge_ == 0 ? 1 days : maxRateAge_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
    }

    // ---------------------------------------------------------------
    // FX rate
    // ---------------------------------------------------------------

    /// @notice Post the USDC/IDR rate: IDR per 1 USDC, two-decimal precision.
    ///         In production this comes from an IDRX-style quote; here an
    ///         FX_ROLE posts it with the current timestamp.
    function postRate(uint256 idrPerUsdc_) external onlyRole(FX_ROLE) {
        if (idrPerUsdc_ == 0) revert ZeroAmount();
        idrPerUsdc = idrPerUsdc_;
        rateUpdatedAt = uint64(block.timestamp);
        emit RatePosted(idrPerUsdc_, rateUpdatedAt);
    }

    /// @notice Set the maximum age the posted rate may have for a rate-using
    ///         action (allocate, distributeProfit, settleMaturity).
    function setMaxRateAge(uint64 maxRateAge_) external onlyRole(ADMIN_ROLE) {
        maxRateAge = maxRateAge_;
        emit MaxRateAgeSet(maxRateAge_);
    }

    /// @notice Update the treasury (escrow sink + funding source).
    function setTreasury(address treasury_) external onlyRole(ADMIN_ROLE) {
        if (treasury_ == address(0)) revert InvalidAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function _freshRate() private view returns (uint256) {
        if (idrPerUsdc == 0 || rateUpdatedAt == 0) revert RateUnset();
        if (block.timestamp > uint256(rateUpdatedAt) + maxRateAge) revert RateStale(rateUpdatedAt, maxRateAge);
        return idrPerUsdc;
    }

    /// @notice Convert USDC base units (6dp) to sen (2dp) at `rate`.
    function _usdcToSen(uint256 usdcAmount, uint256 rate) private pure returns (uint256) {
        return (usdcAmount * rate) / USDC_ONE;
    }

    /// @notice Convert sen (2dp) to USDC base units (6dp) at `rate`.
    function _senToUsdc(uint256 sen, uint256 rate) private pure returns (uint256) {
        return (sen * USDC_ONE) / rate;
    }

    // ---------------------------------------------------------------
    // Subscription
    // ---------------------------------------------------------------

    /// @notice Escrow `usdcAmount` USDC toward an allocation. The caller must
    ///         be eligible under the SandboxModule's current mode, so cash
    ///         never escrows for a wallet that could not be allocated.
    function subscribe(uint256 usdcAmount) external nonReentrant {
        if (usdcAmount == 0) revert ZeroAmount();
        if (!sandbox.isEligible(compliance, msg.sender)) revert NotEligible(msg.sender);
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        pendingUsdc[msg.sender] += usdcAmount;
        emit Subscribed(msg.sender, usdcAmount, pendingUsdc[msg.sender]);
    }

    /// @notice Cancel a pending subscription before allocation; refunds the
    ///         caller's full escrow at par.
    function cancelSubscription() external nonReentrant {
        uint256 amount = pendingUsdc[msg.sender];
        if (amount == 0) revert NoPending();
        pendingUsdc[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit SubscriptionCancelled(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Allocation (mint against an anchored account balance)
    // ---------------------------------------------------------------

    /// @notice Allocate the pending subscriptions of `investors`: convert each
    ///         one's escrowed USDC to sen at the posted rate, mint that many
    ///         tokens, and forward the escrowed USDC to the treasury (the money
    ///         Tawf converts and places at the bank). Requires a fresh
    ///         DEPOSITO_RESERVE proof for the series' dedicated account at or
    ///         after the stored snapshot, and enforces total supply never
    ///         exceeds the anchored balance.
    /// @param investors Subscribers to allocate (each must have pending USDC).
    /// @param epoch Anchor epoch the reserve leaf is in.
    /// @param snapshotAt DEPOSITO_RESERVE leaf a (snapshot ts).
    /// @param balance DEPOSITO_RESERVE leaf b (account balance in sen).
    /// @param proof Merkle proof of the reserve leaf.
    function allocate(
        address[] calldata investors,
        uint256 epoch,
        uint64 snapshotAt,
        uint256 balance,
        bytes32[] calldata proof
    ) external nonReentrant onlyRole(OPERATOR_ROLE) {
        // Accept a snapshot newer than or equal to the stored one, so an
        // allocation can reuse the latest anchored balance.
        if (snapshotAt < reserveSnapshotAt) revert ReserveNotNewer(reserveSnapshotAt, snapshotAt);
        _requireFact(LedgerLeaf.DEPOSITO_RESERVE, snapshotAt, balance, epoch, proof);
        reserveSnapshotAt = snapshotAt;
        reserveBalance = balance;
        emit ReserveUpdated(snapshotAt, balance);

        uint256 rate = _freshRate();
        uint256 usdcToTreasury;

        for (uint256 i = 0; i < investors.length; i++) {
            address investor = investors[i];
            uint256 pending = pendingUsdc[investor];
            if (pending == 0) continue;
            // Effects before external mint.
            pendingUsdc[investor] = 0;
            usdcToTreasury += pending;

            uint256 sen = _usdcToSen(pending, rate);
            token.mint(investor, sen); // SandboxModule gates eligibility + caps
            emit Allocated(investor, pending, sen);
        }

        // Supply must stay within the anchored account balance.
        if (token.totalSupply() > balance) revert ReserveInsufficient(token.totalSupply(), balance);

        if (usdcToTreasury != 0) {
            usdc.safeTransfer(treasury, usdcToTreasury);
        }
    }

    // ---------------------------------------------------------------
    // Profit distribution
    // ---------------------------------------------------------------

    /// @notice Distribute the profit the bank credited for `period`. Requires
    ///         a DEPOSITO_PROFIT proof (a = period, b = profit sen), pulls the
    ///         USDC equivalent at the posted rate from the treasury (which
    ///         must have approved this contract), and accrues it pro rata.
    function distributeProfit(uint32 period, uint256 profitSen, uint256 epoch, bytes32[] calldata proof)
        external
        nonReentrant
        onlyRole(OPERATOR_ROLE)
    {
        if (period != lastPeriod + 1) revert ProfitPeriodNotSequential(lastPeriod + 1, period);
        _requireFact(LedgerLeaf.DEPOSITO_PROFIT, period, profitSen, epoch, proof);
        lastPeriod = period;

        uint256 usdcAmount;
        if (profitSen != 0) {
            uint256 rate = _freshRate();
            usdcAmount = _senToUsdc(profitSen, rate);
            if (usdcAmount != 0) {
                usdc.safeTransferFrom(treasury, address(this), usdcAmount);
                _profit.fund(usdcAmount, token.totalSupply());
            }
        }
        emit ProfitDistributed(period, profitSen, usdcAmount);
    }

    /// @notice Withdraw the caller's distributed profit, paid in USDC.
    function claim() external nonReentrant {
        _profit.settle(msg.sender, token.balanceOf(msg.sender));
        uint256 amount = _profit.take(msg.sender);
        if (amount == 0) revert NothingToClaim();
        usdc.safeTransfer(msg.sender, amount);
        emit ProfitClaimed(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Maturity and redemption
    // ---------------------------------------------------------------

    /// @notice Settle the series at maturity. Requires a DEPOSITO_MATURITY
    ///         proof (a = maturity ts, b = principal sen), pulls the USDC
    ///         equivalent of the principal at the posted rate from the
    ///         treasury, and opens redemption pro rata.
    function settleMaturity(uint64 at, uint256 principalSen, uint256 epoch, bytes32[] calldata proof)
        external
        nonReentrant
        onlyRole(OPERATOR_ROLE)
    {
        if (redemptionOpen) revert RedemptionAlreadyOpen();
        _requireFact(LedgerLeaf.DEPOSITO_MATURITY, at, principalSen, epoch, proof);
        redemptionOpen = true;

        uint256 usdcAmount;
        uint256 supply = token.totalSupply();
        if (principalSen != 0 && supply != 0) {
            uint256 rate = _freshRate();
            usdcAmount = _senToUsdc(principalSen, rate);
            if (usdcAmount != 0) {
                usdc.safeTransferFrom(treasury, address(this), usdcAmount);
                redemptionPerToken = (usdcAmount * PRECISION) / supply;
            }
        }
        emit MaturitySettled(at, principalSen, usdcAmount);
    }

    /// @notice Burn the caller's tokens for their pro-rata share of the funded
    ///         principal plus any unclaimed profit, all in USDC.
    function redeem() external nonReentrant {
        if (!redemptionOpen) revert RedemptionNotOpen();
        uint256 units = token.balanceOf(msg.sender);
        if (units == 0) revert NothingToClaim();

        // Burning settles profit at the pre-burn balance via the module hook.
        token.burn(msg.sender, units);
        uint256 profit = _profit.take(msg.sender);
        uint256 principal = (units * redemptionPerToken) / PRECISION;

        usdc.safeTransfer(msg.sender, principal + profit);
        emit Redeemed(msg.sender, units, principal, profit);
    }

    // ---------------------------------------------------------------
    // Module hook
    // ---------------------------------------------------------------

    /// @inheritdoc IBalanceCheckpoint
    /// @dev Called by the bound DistributionCheckpointModule AFTER balances
    ///      moved. Reconstruct pre-change balances and settle each side there.
    function afterBalanceChange(address from, address to, uint256 amount) external {
        if (msg.sender != module) revert OnlyModule();
        if (from != address(0)) {
            _profit.settle(from, token.balanceOf(from) + amount);
        }
        if (to != address(0)) {
            uint256 current = token.balanceOf(to);
            _profit.settle(to, current >= amount ? current - amount : 0);
        }
    }

    // ---------------------------------------------------------------
    // Views for the app
    // ---------------------------------------------------------------

    /// @notice USDC a subscriber has escrowed and not yet had allocated.
    function pending(address investor) external view returns (uint256) {
        return pendingUsdc[investor];
    }

    /// @notice The posted rate and its freshness.
    function rate() external view returns (uint256 idrPerUsdc_, uint64 updatedAt, uint64 maxAge, bool fresh) {
        idrPerUsdc_ = idrPerUsdc;
        updatedAt = rateUpdatedAt;
        maxAge = maxRateAge;
        fresh = idrPerUsdc != 0 && rateUpdatedAt != 0 && block.timestamp <= uint256(rateUpdatedAt) + maxRateAge;
    }

    /// @notice Latest anchored account balance (sen).
    function reserve() external view returns (uint256) {
        return reserveBalance;
    }

    /// @notice Ratio of anchored backing to live supply, in basis points.
    ///         Returns 10000 (100%) when supply is zero.
    function ratioBps() external view returns (uint256) {
        uint256 supply = token.totalSupply();
        if (supply == 0) return 10_000;
        return (reserveBalance * 10_000) / supply;
    }

    /// @notice Whether live supply is within the anchored account balance.
    function isFullyBacked() external view returns (bool) {
        return token.totalSupply() <= reserveBalance;
    }

    /// @notice Profit `investor` could claim right now, in USDC.
    function claimable(address investor) external view returns (uint256) {
        return _profit.claimable(investor, token.balanceOf(investor));
    }

    /// @notice Cumulative profit per token unit, scaled by 1e18.
    function profitPerToken() external view returns (uint256) {
        return _profit.profitPerToken;
    }

    /// @notice Series terms (seriesId, tenor, nisbah).
    function seriesTerms() external view returns (Terms memory) {
        return terms;
    }

    // ---------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------

    function _requireFact(bytes32 kind, uint256 a, uint256 b, uint256 epoch, bytes32[] calldata proof) private view {
        if (!anchor.verify(epoch, LedgerLeaf.hash(ledgerChainId, kind, terms.seriesId, a, b), proof)) {
            revert ProofInvalid();
        }
    }

    /// @notice Ledger leaf encoding, identical to tawf-network's LedgerLeaf.hash.
    function leafHash(uint256 ledgerChainId_, bytes32 kind, bytes32 subjectId, uint256 a, uint256 b)
        public
        pure
        returns (bytes32)
    {
        return LedgerLeaf.hash(ledgerChainId_, kind, subjectId, a, b);
    }
}
