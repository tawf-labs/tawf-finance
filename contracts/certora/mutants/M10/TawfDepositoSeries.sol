// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
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
 *         wrapped Tawf deposit). Investors subscribe in any allowlisted
 *         settlement stablecoin (USDC or USDT, both 6 decimals); Tawf converts
 *         to IDR off chain and places it in a single dedicated deposito account
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
 *      DEPOSITO_PROFIT proof and accrues exactly the anchored profit sen, pro
 *      rata. settleMaturity requires a DEPOSITO_MATURITY proof. There is no
 *      promised return: profit is whatever the bank credited and anchored.
 *
 *      Internal accounting is IDR sen everywhere (tokens, pending, profit,
 *      principal). There is NO 1:1 peg assumed: each allowlisted stablecoin
 *      (all 6 decimals) carries its own posted FX rate (idr per 1 token,
 *      two-decimal precision: 1 stablecoin = rate / 100 IDR) with its own
 *      timestamp. Actions that use a rate reject it when older than
 *      maxRateAge. Subscriptions escrow a stablecoin and are converted to sen
 *      at that coin's rate at allocation. Profit and principal are accrued in
 *      sen and paid out, per claim/redeem, in the holder's chosen coin at that
 *      coin's current rate, pulled FROM THE TREASURY (which pre-approves this
 *      series per coin).
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
    /// @dev Stablecoin base units per whole token (all settlement coins are 6 decimals).
    uint256 private constant COIN_ONE = 1e6;
    /// @dev Required decimals for every settlement stablecoin.
    uint8 private constant COIN_DECIMALS = 6;
    /// @notice Highest Tawf nisbah accepted (50% of profit).
    uint16 public constant MAX_TAWF_NISBAH_BPS = 5000;

    struct Terms {
        /// @dev Series id on the Tawf Network ReserveLedger (subject of the
        ///      DEPOSITO_RESERVE / DEPOSITO_PROFIT / DEPOSITO_MATURITY leaves).
        bytes32 seriesId;
        uint8 tenorMonths;
        uint16 nisbahBps;
    }

    /// @dev Per-stablecoin posted FX rate (idr per 1 token, two-decimal precision).
    struct Rate {
        uint256 idrPerToken;
        uint64 updatedAt;
    }

    ILedgerAnchor public immutable anchor;
    ITrexToken public immutable token;
    /// @dev The DistributionCheckpointModule bound to the token's compliance.
    address public immutable module;
    /// @dev The SandboxModule eligibility gate and the compliance it guards.
    ISandboxEligibility public immutable sandbox;
    address public immutable compliance;
    uint256 public immutable ledgerChainId;
    /// @dev Where escrowed stablecoins go on allocation, and the source of
    ///      stablecoins for profit and principal funding: the Tawf treasury.
    address public treasury;

    Terms public terms;

    // --- Settlement stablecoin allowlist ---
    /// @notice Whether a stablecoin is currently an allowed settlement coin.
    mapping(address => bool) public isStablecoin;
    /// @notice The allowed settlement stablecoins (append-only addresses; the
    ///         `isStablecoin` flag is the source of truth for membership).
    address[] private _stablecoins;

    // --- FX rate (posted per stablecoin by FX_ROLE) ---
    mapping(address => Rate) private _rate;
    uint64 public maxRateAge;

    // --- Subscription escrow (per investor, per stablecoin, in coin units) ---
    mapping(address => mapping(address => uint256)) public pendingOf;

    // --- Reserve (anchored account balance in sen) ---
    uint64 public reserveSnapshotAt;
    uint256 public reserveBalance;

    // --- Profit / maturity (all sen) ---
    uint32 public lastPeriod;
    bool public redemptionOpen;
    /// @notice Principal sen paid out per token unit at redemption, scaled by 1e18.
    uint256 public principalSenPerToken;

    ProfitAccumulator.State private _profit;

    error InvalidAddress();
    error InvalidTerms();
    error ZeroAmount();
    error NotEligible(address investor);
    error NoPending();
    error RedemptionAlreadyOpen();
    error ProfitAfterMaturity();
    error ProfitPeriodsOutstanding(uint32 distributed, uint32 finalPeriod);
    error RedemptionNotOpen();
    error RateUnset();
    error RateStale(uint64 updatedAt, uint64 maxAge);
    error ProofInvalid();
    error ReserveNotNewer(uint64 stored, uint64 got);
    error ReserveInsufficient(uint256 supplyAfter, uint256 balance);
    error ProfitPeriodNotSequential(uint32 expected, uint32 got);
    error NothingToClaim();
    error OnlyModule();
    error NotStablecoin(address token);
    error StablecoinAlreadyAdded(address token);
    error BadDecimals(uint8 got);
    error ConversionZero();
    error TawfShareLocked();

    event StablecoinAdded(address indexed token);
    event StablecoinRemoved(address indexed token);
    event RatePosted(address indexed token, uint256 idrPerToken, uint64 updatedAt);
    event MaxRateAgeSet(uint64 maxRateAge);
    event TreasurySet(address treasury);
    event Subscribed(address indexed investor, address indexed token, uint256 coinAmount, uint256 pending);
    event SubscriptionCancelled(address indexed investor, address indexed token, uint256 coinRefunded);
    event Allocated(address indexed investor, address indexed token, uint256 coinUsed, uint256 senMinted);
    event ReserveUpdated(uint64 snapshotAt, uint256 balance);
    event ProfitDistributed(uint32 indexed period, uint256 profitSen);
    event ProfitClaimed(address indexed investor, address indexed token, uint256 senClaimed, uint256 coinPaid);
    event MaturitySettled(uint64 at, uint256 principalSen);
    event Redeemed(address indexed investor, address indexed token, uint256 units, uint256 coinPaid, uint256 profitCoinPaid);
    event TawfShareSet(uint16 nisbahBps, address feeRecipient);
    event TawfShareAccrued(uint32 indexed period, uint256 shareSen);
    event TawfShareClaimed(address indexed token, uint256 shareSen, uint256 coinPaid);

    // --- Tawf's mudharabah share ----------------------------------------
    // Investors place their money with Tawf (mudharib), which places it at the
    // BPRS with their permission (two-tier mudharabah). Of each period's bank
    // profit, Tawf keeps `tawfNisbahBps` and holders get the rest. The ratio
    // is fixed before the first subscription and disclosed upfront; with no
    // profit there is no share, and principal is never charged.

    /// @notice Tawf's share of each period's profit, in basis points.
    uint16 public tawfNisbahBps;
    /// @notice Where Tawf's share is paid.
    address public feeRecipient;
    /// @notice True once the first subscription arrives: the share is fixed.
    bool public tawfShareLocked;
    /// @notice Tawf's share accrued from distributed profit, in sen.
    uint256 public tawfShareAccruedSen;
    /// @notice Tawf's share already paid out, in sen.
    uint256 public tawfSharePaidSen;

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
    /// @param maxRateAge_ Maximum age of an FX rate for rate-using actions.
    constructor(
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
            address(anchor_) == address(0) || address(token_) == address(0) || module_ == address(0)
                || address(sandbox_) == address(0) || compliance_ == address(0) || treasury_ == address(0)
                || admin == address(0) || operator == address(0)
        ) revert InvalidAddress();
        if (terms_.seriesId == bytes32(0) || terms_.nisbahBps > 10_000) revert InvalidTerms();

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
    // Settlement stablecoin allowlist
    // ---------------------------------------------------------------

    /// @notice Add `token_` as an allowed settlement stablecoin. Requires the
    ///         coin to expose 6 decimals, so sen conversion holds for every
    ///         allowed coin.
    function addStablecoin(address token_) external onlyRole(ADMIN_ROLE) {
        if (token_ == address(0)) revert InvalidAddress();
        if (isStablecoin[token_]) revert StablecoinAlreadyAdded(token_);
        uint8 d = IERC20Metadata(token_).decimals();
        if (d != COIN_DECIMALS) revert BadDecimals(d);
        isStablecoin[token_] = true;
        _stablecoins.push(token_);
        emit StablecoinAdded(token_);
    }

    /// @notice Remove `token_` from the allowlist. New subscriptions in it are
    ///         blocked, but existing pending escrow can still be cancelled and
    ///         holders can still claim/redeem in another allowed coin. The
    ///         address stays in `_stablecoins` (membership is `isStablecoin`),
    ///         so allocation still converts any pending escrow already taken.
    function removeStablecoin(address token_) external onlyRole(ADMIN_ROLE) {
        if (!isStablecoin[token_]) revert NotStablecoin(token_);
        isStablecoin[token_] = false;
        emit StablecoinRemoved(token_);
    }

    /// @notice The configured settlement stablecoins (addresses ever added;
    ///         call `isStablecoin` for current membership).
    function allowedStablecoins() external view returns (address[] memory) {
        return _stablecoins;
    }

    // ---------------------------------------------------------------
    // FX rate (posted per stablecoin by FX_ROLE)
    // ---------------------------------------------------------------

    /// @notice Post the IDR rate for `token_`: IDR per 1 stablecoin,
    ///         two-decimal precision. No 1:1 peg is assumed; each coin has its
    ///         own rate and timestamp.
    function postRate(address token_, uint256 idrPerToken_) external onlyRole(FX_ROLE) {
        if (!isStablecoin[token_]) revert NotStablecoin(token_);
        if (idrPerToken_ == 0) revert ZeroAmount();
        _rate[token_] = Rate({ idrPerToken: idrPerToken_, updatedAt: uint64(block.timestamp) });
        emit RatePosted(token_, idrPerToken_, uint64(block.timestamp));
    }

    /// @notice Set the maximum age an FX rate may have for a rate-using action
    ///         (allocate, claim, redeem).
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

    function _freshRate(address token_) private view returns (uint256) {
        Rate memory r = _rate[token_];
        if (r.idrPerToken == 0 || r.updatedAt == 0) revert RateUnset();
        if (block.timestamp > uint256(r.updatedAt) + maxRateAge) revert RateStale(r.updatedAt, maxRateAge);
        return r.idrPerToken;
    }

    /// @notice Convert stablecoin base units (6dp) to sen (2dp) at `rate`.
    function _coinToSen(uint256 coinAmount, uint256 rate) private pure returns (uint256) {
        return (coinAmount * rate) / COIN_ONE;
    }

    /// @notice Convert sen (2dp) to stablecoin base units (6dp) at `rate`.
    function _senToCoin(uint256 sen, uint256 rate) private pure returns (uint256) {
        return (sen * COIN_ONE) / rate;
    }

    // ---------------------------------------------------------------
    // Subscription
    // ---------------------------------------------------------------

    /// @notice Escrow `coinAmount` of `token_` toward an allocation. The coin
    ///         must be allowlisted and the caller must be eligible under the
    ///         SandboxModule's current mode, so cash never escrows for a wallet
    ///         that could not be allocated or in a coin Tawf does not accept.
    function subscribe(address token_, uint256 coinAmount) external nonReentrant {
        if (!isStablecoin[token_]) revert NotStablecoin(token_);
        if (coinAmount == 0) revert ZeroAmount();
        if (!sandbox.isEligible(compliance, msg.sender)) revert NotEligible(msg.sender);
        // The profit-sharing terms are fixed from the first subscription on.
        if (!tawfShareLocked) tawfShareLocked = true;
        IERC20(token_).safeTransferFrom(msg.sender, address(this), coinAmount);
        pendingOf[msg.sender][token_] += coinAmount;
        emit Subscribed(msg.sender, token_, coinAmount, pendingOf[msg.sender][token_]);
    }

    /// @notice Cancel a pending subscription in `token_` before allocation;
    ///         refunds the caller's full escrow in that coin at par. Allowed
    ///         even after the coin is removed from the allowlist.
    function cancelSubscription(address token_) external nonReentrant {
        uint256 amount = pendingOf[msg.sender][token_];
        if (amount == 0) revert NoPending();
        pendingOf[msg.sender][token_] = 0;
        IERC20(token_).safeTransfer(msg.sender, amount);
        emit SubscriptionCancelled(msg.sender, token_, amount);
    }

    // ---------------------------------------------------------------
    // Allocation (mint against an anchored account balance)
    // ---------------------------------------------------------------

    /// @notice Allocate the pending subscriptions of `investors`: for each one,
    ///         convert its escrowed balance in every settlement stablecoin to
    ///         sen at that coin's current rate, mint the total sen, and forward
    ///         the escrowed coins to the treasury (the money Tawf converts and
    ///         places at the bank). Requires a fresh DEPOSITO_RESERVE proof for
    ///         the series' dedicated account at or after the stored snapshot,
    ///         and enforces total supply never exceeds the anchored balance.
    /// @param investors Subscribers to allocate (each must have pending escrow).
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

        uint256 coinCount = _stablecoins.length;

        for (uint256 i = 0; i < investors.length; i++) {
            address investor = investors[i];
            uint256 senForInvestor;

            for (uint256 j = 0; j < coinCount; j++) {
                address coin = _stablecoins[j];
                uint256 pendingCoin = pendingOf[investor][coin];
                if (pendingCoin == 0) continue;
                // Effects before external mint/transfer.
                pendingOf[investor][coin] = 0;

                uint256 rate = _freshRate(coin);
                uint256 sen = _coinToSen(pendingCoin, rate);
                senForInvestor += sen;

                // Forward the escrowed coin to the treasury.
                IERC20(coin).safeTransfer(treasury, pendingCoin);
                emit Allocated(investor, coin, pendingCoin, sen);
            }

            if (senForInvestor != 0) {
                token.mint(investor, senForInvestor); // SandboxModule gates eligibility + caps
            }
        }

        // Supply must stay within the anchored account balance.
        if (token.totalSupply() > balance) revert ReserveInsufficient(token.totalSupply(), balance);
    }

    // ---------------------------------------------------------------
    // Profit distribution
    // ---------------------------------------------------------------

    /// @notice Distribute the profit the bank credited for `period`. Requires a
    ///         DEPOSITO_PROFIT proof (a = period, b = profit sen) and accrues
    ///         `profitSen` pro rata in sen. No stablecoin is pulled up front:
    ///         holders are paid, in their chosen coin, when they claim.
    function distributeProfit(uint32 period, uint256 profitSen, uint256 epoch, bytes32[] calldata proof)
        external
        nonReentrant
        onlyRole(OPERATOR_ROLE)
    {
        // Every profit period is paid out before maturity opens redemption, so
        // no holder who redeems early can miss a period.
        if (redemptionOpen) revert ProfitAfterMaturity();
        if (period != lastPeriod + 1) revert ProfitPeriodNotSequential(lastPeriod + 1, period);
        _requireFact(LedgerLeaf.DEPOSITO_PROFIT, period, profitSen, epoch, proof);
        lastPeriod = period;
        uint256 share = (profitSen * tawfNisbahBps) / 10_000;
        uint256 holdersSen = profitSen - share;
        if (holdersSen != 0) {
            _profit.fund(profitSen, token.totalSupply()); // MUTANT M10: holders credited the gross profit as well as Tawf
        }
        if (share != 0) {
            tawfShareAccruedSen += share;
            emit TawfShareAccrued(period, share);
        }
        emit ProfitDistributed(period, profitSen);
    }

    /// @notice Withdraw the caller's distributed profit, paid in `token_` at
    ///         that coin's current rate and pulled from the treasury (which
    ///         pre-approves this series per coin). The sen entitlement is the
    ///         anchored profit pro rata, so the payout can never exceed it.
    function claim(address token_) external nonReentrant {
        if (!isStablecoin[token_]) revert NotStablecoin(token_);
        _profit.settle(msg.sender, token.balanceOf(msg.sender));
        uint256 sen = _profit.take(msg.sender);
        if (sen == 0) revert NothingToClaim();

        uint256 rate = _freshRate(token_);
        uint256 coinAmount = _senToCoin(sen, rate);
        if (coinAmount == 0) revert ConversionZero();
        IERC20(token_).safeTransferFrom(treasury, msg.sender, coinAmount);
        emit ProfitClaimed(msg.sender, token_, sen, coinAmount);
    }

    /// @notice Set Tawf's nisbah and fee wallet. Only before the first
    ///         subscription: investors commit under the disclosed ratio.
    function setTawfShare(uint16 nisbahBps, address recipient) external onlyRole(ADMIN_ROLE) {
        if (tawfShareLocked) revert TawfShareLocked();
        if (nisbahBps > MAX_TAWF_NISBAH_BPS) revert InvalidTerms();
        if (nisbahBps != 0 && recipient == address(0)) revert InvalidAddress();
        tawfNisbahBps = nisbahBps;
        feeRecipient = recipient;
        emit TawfShareSet(nisbahBps, recipient);
    }

    /// @notice Pay Tawf's accrued share to the fee wallet in `token_`, at that
    ///         coin's current rate, from the treasury (as holder claims are).
    function claimTawfShare(address token_) external nonReentrant {
        if (!isStablecoin[token_]) revert NotStablecoin(token_);
        uint256 sen = tawfShareAccruedSen - tawfSharePaidSen;
        if (sen == 0) revert NothingToClaim();
        tawfSharePaidSen = tawfShareAccruedSen;
        uint256 coinAmount = _senToCoin(sen, _freshRate(token_));
        if (coinAmount == 0) revert ConversionZero();
        IERC20(token_).safeTransferFrom(treasury, feeRecipient, coinAmount);
        emit TawfShareClaimed(token_, sen, coinAmount);
    }

    // ---------------------------------------------------------------
    // Maturity and redemption
    // ---------------------------------------------------------------

    /// @notice Settle the series at maturity. Requires a DEPOSITO_MATURITY
    ///         proof (a = maturity ts packed with the bank's last profit
    ///         period, b = principal sen), and that every one of those profit
    ///         periods has already been distributed here. Opens redemption
    ///         recording the principal sen per token unit, capped at face
    ///         value (one token = IDR 1). No stablecoin is
    ///         pulled up front: holders are paid their pro-rata principal, in
    ///         their chosen coin, when they redeem.
    function settleMaturity(uint64 at, uint32 finalPeriod, uint256 principalSen, uint256 epoch, bytes32[] calldata proof)
        external
        nonReentrant
        onlyRole(OPERATOR_ROLE)
    {
        if (redemptionOpen) revert RedemptionAlreadyOpen();
        if (lastPeriod != finalPeriod) revert ProfitPeriodsOutstanding(lastPeriod, finalPeriod);
        _requireFact(LedgerLeaf.DEPOSITO_MATURITY, LedgerLeaf.packMaturity(at, finalPeriod), principalSen, epoch, proof);
        redemptionOpen = true;

        uint256 supply = token.totalSupply();
        // One token is IDR 1 of face value, so principal is capped at face.
        // Anything the bank returns above face (for example nisbah left in the
        // account) is not principal and must not be paid out twice. Below
        // face, holders share the shortfall pro rata, as mudharabah requires.
        uint256 payable_ = principalSen > supply ? supply : principalSen;
        if (payable_ != 0 && supply != 0) {
            principalSenPerToken = (payable_ * PRECISION) / supply;
        }
        emit MaturitySettled(at, principalSen);
    }

    /// @notice Burn the caller's tokens for their pro-rata share of the funded
    ///         principal plus any unclaimed profit, both converted to `token_`
    ///         at its current rate and pulled from the treasury.
    function redeem(address token_) external nonReentrant {
        if (!isStablecoin[token_]) revert NotStablecoin(token_);
        if (!redemptionOpen) revert RedemptionNotOpen();
        uint256 units = token.balanceOf(msg.sender);
        if (units == 0) revert NothingToClaim();

        // Burning settles profit at the pre-burn balance via the module hook.
        token.burn(msg.sender, units);
        uint256 profitSen = _profit.take(msg.sender);
        uint256 principalSen = (units * principalSenPerToken) / PRECISION;

        uint256 rate = _freshRate(token_);
        uint256 principalCoin = _senToCoin(principalSen, rate);
        uint256 profitCoin = _senToCoin(profitSen, rate);
        uint256 total = principalCoin + profitCoin;
        if (total != 0) {
            IERC20(token_).safeTransferFrom(treasury, msg.sender, total);
        }
        emit Redeemed(msg.sender, token_, units, principalCoin, profitCoin);
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

    /// @notice Stablecoin units a subscriber has escrowed in `token_` and not
    ///         yet had allocated.
    function pending(address investor, address token_) external view returns (uint256) {
        return pendingOf[investor][token_];
    }

    /// @notice The posted rate for `token_` (idr per 1 stablecoin, two-decimal
    ///         precision).
    function rateOf(address token_) external view returns (uint256) {
        return _rate[token_].idrPerToken;
    }

    /// @notice When the rate for `token_` was last posted.
    function rateUpdatedAt(address token_) external view returns (uint64) {
        return _rate[token_].updatedAt;
    }

    /// @notice The posted rate for `token_` and its freshness.
    function rate(address token_)
        external
        view
        returns (uint256 idrPerToken, uint64 updatedAt, uint64 maxAge, bool fresh)
    {
        Rate memory r = _rate[token_];
        idrPerToken = r.idrPerToken;
        updatedAt = r.updatedAt;
        maxAge = maxRateAge;
        fresh = r.idrPerToken != 0 && r.updatedAt != 0 && block.timestamp <= uint256(r.updatedAt) + maxRateAge;
    }

    /// @notice Quote: stablecoin base units `sen` converts to in `token_` at
    ///         its current posted rate. Returns 0 if no rate is posted.
    function quote(address token_, uint256 sen) external view returns (uint256) {
        uint256 r = _rate[token_].idrPerToken;
        if (r == 0) return 0;
        return _senToCoin(sen, r);
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

    /// @notice Profit `investor` could claim right now, in sen.
    function claimableSen(address investor) public view returns (uint256) {
        return _profit.claimable(investor, token.balanceOf(investor));
    }

    /// @notice Cumulative profit per token unit, scaled by 1e18.
    function profitPerToken() public view returns (uint256) {
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
