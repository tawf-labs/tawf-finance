// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { ITawfIdentityRegistry } from "../interfaces/ITawfIdentityRegistry.sol";
import { ITrexToken } from "../interfaces/ITrexToken.sol";
import { ILedgerAnchor } from "./ILedgerAnchor.sol";
import { IBalanceCheckpoint } from "./IBalanceCheckpoint.sol";
import { LedgerLeaf } from "../lib/LedgerLeaf.sol";
import { ProfitAccumulator } from "../lib/ProfitAccumulator.sol";

/**
 * @title SukukDistributor
 * @notice Cash side of one sukuk issuance on Arbitrum: primary subscription,
 *         periodic profit distribution, and redemption at maturity or after a
 *         default. Drives an externally deployed T-REX sukuk series token as
 *         its AGENT (mint on subscription, burn on redemption/refund).
 *
 * @dev Uses OZ v5 (`openzeppelin-contracts/`) and pragma ^0.8.20, with the
 *      sukuk token reached only through ITrexToken, so this contract
 *      interoperates with the 0.8.17-pinned T-REX Token without importing it.
 *      A `DistributionCheckpointModule` (0.8.17) bound to the token's
 *      compliance calls this contract's afterBalanceChange across the pragma
 *      boundary through the IBalanceCheckpoint interface.
 *
 *      Every step that opens the sale or pays holders needs a Merkle proof
 *      that the matching fact is recorded in the SukukLedger on Tawf Network
 *      and anchored on this chain through LedgerAnchor. This contract cannot
 *      be told an amount, it can only be shown one.
 *
 *      Multi-coin: the offering accepts 1 to 4 USD stablecoins with 6 decimals,
 *      each at par with the 6-decimal USD unit the token, the ledger facts and
 *      the limit module are all denominated in. Subscriptions, distributions,
 *      maturity funding and held-profit releases arrive in any accepted coin.
 *      Accounting stays in USD units, and each holder picks the coin to claim
 *      and redeem in. If the contract lacks enough of that coin the call reverts
 *      with InsufficientCoin and the holder picks another one. A cancelled
 *      subscription refunds the coin each investor paid. Total coin balances
 *      always cover what is owed, though a single coin may run short.
 *
 *      Par assumption (mainnet risk): every accepted coin is treated as exactly one USD
 *      unit. If one coin trades below par, informed holders would prefer to be paid in
 *      the others. Payouts therefore start with the requested coin and fall back to the
 *      other coins in list order, and the admin can pause a coin with setCoinPaused so
 *      it is no longer accepted for new money or as a preferred payout coin. A paused
 *      coin is still used to complete a payout when nothing else can cover it.
 *
 *      Shariah / profit-and-loss-sharing constraint, load-bearing: holders
 *      are paid only from stablecoin that has actually arrived here against a
 *      declared, realized amount. There is no rate, no accrual and no promised
 *      return. A period can be declared at zero, and redemption pays whatever
 *      the issuer declared and funded, pro rata, which may be below par.
 *
 *      Profit is tracked per token (ProfitAccumulator: cumulative profit per
 *      unit), so it follows the holder of record across secondary transfers
 *      without snapshots. T-REX calls modules AFTER the balance has changed,
 *      so afterBalanceChange reconstructs the pre-change balances to settle
 *      each side correctly.
 *
 *      Reserve gating (SUKUK_RESERVE): the latest verified `outstanding` from
 *      the ledger caps how much may ever be minted. closeSubscription and
 *      subscription both enforce totalSupply <= latest verified outstanding.
 */
contract SukukDistributor is AccessControl, ReentrancyGuard, IBalanceCheckpoint {
    using SafeERC20 for IERC20;
    using ProfitAccumulator for ProfitAccumulator.State;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    /// @notice Funds distributions, maturity, default recovery and held-profit releases.
    ///         Granted to the admin at construction. Restricting it means a stranger
    ///         holding a ledger proof cannot choose which coin funds a payout.
    bytes32 public constant FUNDER_ROLE = keccak256("FUNDER_ROLE");

    uint256 private constant PRECISION = 1e18;
    /// @notice Highest Tawf nisbah accepted (50% of profit).
    uint16 public constant MAX_TAWF_NISBAH_BPS = 5000;

    enum Status {
        Pending,
        Subscription,
        Active,
        Matured,
        Defaulted,
        Cancelled
    }

    struct Terms {
        /// @dev Sukuk id in the Tawf Network SukukLedger.
        bytes32 sukukId;
        /// @dev Maximum issue size in USD base units (6 decimals), must equal the ledger's.
        uint256 faceValue;
        /// @dev Maturity timestamp, must equal the ledger's.
        uint40 maturity;
        /// @dev Below this the subscription is cancelled and refunded.
        uint256 minRaise;
        uint256 minSubscription;
        /// @dev Length of the subscription window, from openSubscription.
        uint40 subscriptionPeriod;
        /// @dev Where proceeds go when the subscription closes.
        address issuerTreasury;
    }

    /// @dev Accepted settlement coins (1 to 4), fixed at construction.
    address[] internal _coins;
    mapping(address => bool) public isCoin;
    ILedgerAnchor public immutable anchor;
    ITawfIdentityRegistry public immutable identityRegistry;
    ITrexToken public immutable token;
    uint256 public immutable ledgerChainId;

    Terms public terms;
    Status public status;
    uint40 public subscriptionDeadline;
    uint16 public lastPeriod;

    /// @notice Coin an investor paid into the subscription (USD units), used to refund the same coin.
    mapping(address => mapping(address => uint256)) public paidOf;
    /// @notice Total subscribed per coin.
    mapping(address => uint256) public raisedOf;
    /// @notice Total refunded per coin after a cancelled subscription.
    mapping(address => uint256) public refundedOf;
    /// @notice Released held profit still held per coin (the coin each release was funded in).
    mapping(address => uint256) public heldBalanceOf;
    /// @notice Coins the admin has paused: not accepted for new money or as a preferred payout coin.
    mapping(address => bool) public coinPaused;

    /// @notice USD per token unit paid at redemption, scaled by 1e18.
    uint256 public redemptionPerToken;

    // --- Profit held at a Shariah-flagged maturity --------------------
    // Transfers freeze at maturity, so the holders at maturity and their units
    // are fixed. A holder's entitled units are what they redeemed plus what
    // they still hold. Each board release adds to a per-unit accumulator over
    // totalUnitsAtMaturity; holders pull their share with claimProfit.

    /// @notice Token supply when maturity was settled (the entitled units).
    uint256 public totalUnitsAtMaturity;
    /// @notice Units each holder redeemed after maturity (entitlement survives the burn).
    mapping(address => uint256) public redeemedUnits;
    /// @notice Cumulative released profit per entitled unit, scaled by 1e18.
    uint256 public heldProfitPerUnit;
    /// @notice Each holder's accumulator mark at their last claim.
    mapping(address => uint256) public heldProfitPaidPerUnit;
    /// @notice Accumulator mark at the last sweep: profit up to it is no
    ///         longer claimable (it was swept to the approved destination).
    uint256 public sweptPerUnitMark;
    /// @notice Board releases accepted so far (release indexes are sequential).
    uint16 public heldReleases;
    uint256 public totalHeldReleased;
    uint256 public totalHeldClaimed;
    uint256 public totalHeldSwept;
    /// @notice Released profit still held by this contract for claims.
    uint256 public heldBalance;
    uint256 public lastReleaseAt;
    /// @notice How long after the last release holders can claim before the
    ///         remainder may be swept. Admin-configurable.
    uint256 public claimWindow = 365 days;
    /// @notice Shariah-board-approved destination for unclaimed profit.
    address public sweepDestination;

    /// @notice Latest verified reserve snapshot timestamp (SUKUK_RESERVE a).
    uint64 public reserveSnapshotAt;
    /// @notice Latest verified outstanding reserve cap (SUKUK_RESERVE b).
    uint256 public reserveOutstanding;
    /// @notice Oldest reserve snapshot (seconds before now) that subscription
    ///         and close will accept. Admin-configurable.
    uint64 public maxReserveAge = 3 days;

    // --- Tawf's profit share (nisbah) -----------------------------------
    // Of each declared profit distribution, Tawf keeps `tawfNisbahBps` and
    // holders get the rest. Fixed before the subscription opens and disclosed
    // upfront. Never applied to principal, to profit held at a flagged
    // maturity, or to anything swept: doubtful income never reaches Tawf.

    /// @notice Tawf's share of each distribution, in basis points.
    uint16 public tawfNisbahBps;
    /// @notice Where Tawf's share is paid.
    address public feeRecipient;
    /// @notice Total profit paid to Tawf.
    uint256 public totalTawfShare;

    ProfitAccumulator.State private _profit;

    error InvalidAddress();
    error InvalidTerms();
    error WrongStatus(Status current);
    error ProofInvalid();
    error NotEligible(address investor);
    error BelowMinimum();
    error ExceedsFaceValue();
    error SubscriptionClosed();
    error SubscriptionStillOpen();
    error PeriodNotSequential(uint16 expected, uint16 got);
    error OnlyModule();
    error NothingToClaim();
    error StaleReserve(uint64 latest, uint64 got);
    error ReserveInsufficient(uint256 supplyAfter, uint256 outstanding);
    error NoReserveSnapshot();
    error ReserveTooOld(uint64 snapshotAt, uint64 maxAge);
    error InvalidMaxAge();
    error TransfersFrozen();
    error ReleaseNotSequential(uint16 expected, uint16 got);
    error ZeroRelease();
    error SweepDestinationNotSet();
    error SweepDestinationAlreadySet();
    error InvalidSweepDestination(address destination);
    error ClaimWindowOpen(uint256 opensAt);
    error InvalidClaimWindow();
    error TawfShareLocked();
    error CoinNotAccepted(address coin);
    error InvalidCoins();
    error InsufficientCoin(address coin, uint256 available, uint256 needed);
    error CoinIsPaused(address coin);
    error RefundShortfall(uint256 missing);

    /// @notice The compliance module authorized to report balance changes.
    address public immutable module;

    event SubscriptionOpened(uint40 deadline);
    event Subscribed(address indexed investor, address indexed coin, uint256 amount);
    event Issued(uint256 amount, address indexed issuerTreasury);
    event SubscriptionCancelled(uint256 raised);
    event Refunded(address indexed investor, address indexed coin, uint256 amount);
    event ProfitDistributed(uint16 indexed period, address indexed coin, uint256 amount);
    event ProfitClaimed(address indexed investor, address indexed coin, uint256 amount);
    event MaturitySettled(address indexed coin, uint256 amount);
    event DefaultSettled(address indexed coin, uint256 recovery);
    event Redeemed(address indexed investor, address indexed coin, uint256 units, uint256 principalPaid, uint256 profitPaid);
    event ReserveUpdated(uint64 snapshotAt, uint256 outstanding, uint16 epoch);
    event MaxReserveAgeSet(uint64 maxAge);
    event HeldProfitReleased(uint16 indexed index, address indexed coin, uint256 amount, uint256 profitPerUnit);
    event HeldProfitClaimed(address indexed holder, address indexed coin, uint256 entitledUnits, uint256 amount);
    event HeldProfitSwept(address indexed destination, address indexed coin, uint256 amount);
    event CoinToppedUp(address indexed from, address indexed coin, uint256 amount);
    event CoinPausedSet(address indexed coin, bool paused);
    /// @dev One per coin used by a payout, so a payout split across coins is fully visible.
    event PayoutPart(address indexed to, address indexed coin, uint256 amount);
    event SweepDestinationSet(address indexed destination);
    event ClaimWindowSet(uint256 window);
    event TawfShareSet(uint16 nisbahBps, address feeRecipient);
    event TawfShareTaken(uint16 indexed period, address indexed coin, uint256 share, address indexed feeRecipient);

    /// @param coins_ Accepted settlement stablecoins (1 to 4, distinct, 6 decimals, USD at par).
    /// @param anchor_ LedgerAnchor the ledger roots are anchored on.
    /// @param identityRegistry_ Shared T-REX IdentityRegistry (isVerified).
    /// @param token_ The externally deployed T-REX sukuk series token; this
    ///        distributor must be one of its AGENTs.
    /// @param module_ The DistributionCheckpointModule bound to the token's
    ///        compliance; the only address allowed to call afterBalanceChange.
    /// @param terms_ Issuance terms; must match the ledger record.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and ADMIN_ROLE.
    constructor(
        address[] memory coins_,
        ILedgerAnchor anchor_,
        ITawfIdentityRegistry identityRegistry_,
        ITrexToken token_,
        address module_,
        Terms memory terms_,
        address admin
    ) {
        if (
            address(anchor_) == address(0)
                || address(identityRegistry_) == address(0) || address(token_) == address(0) || module_ == address(0)
                || terms_.issuerTreasury == address(0) || admin == address(0)
        ) revert InvalidAddress();
        if (
            terms_.sukukId == bytes32(0) || terms_.faceValue == 0 || terms_.minRaise == 0
                || terms_.minRaise > terms_.faceValue || terms_.subscriptionPeriod == 0
                || terms_.minSubscription == 0 || terms_.maturity <= block.timestamp
        ) revert InvalidTerms();

        if (coins_.length == 0 || coins_.length > 4) revert InvalidCoins();
        for (uint256 i; i < coins_.length; ++i) {
            address c = coins_[i];
            if (c == address(0) || c == address(token_) || isCoin[c] || IERC20Metadata(c).decimals() != 6) revert InvalidCoins();
            isCoin[c] = true;
            _coins.push(c);
        }
        anchor = anchor_;
        identityRegistry = identityRegistry_;
        token = token_;
        module = module_;
        ledgerChainId = anchor_.ledgerChainId();
        terms = terms_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(FUNDER_ROLE, admin);
    }

    // ---------------------------------------------------------------
    // Reserve
    // ---------------------------------------------------------------

    /// @notice Record a reserve snapshot proven on the ledger. The snapshot
    ///         timestamp must be strictly newer than the stored one, and the
    ///         `outstanding` figure becomes the mint cap enforced on
    ///         subscription and close.
    function updateReserve(uint64 snapshotAt, uint256 outstanding, uint256 epoch, bytes32[] calldata proof)
        external
    {
        if (snapshotAt == 0 || (reserveSnapshotAt != 0 && snapshotAt <= reserveSnapshotAt)) {
            revert StaleReserve(reserveSnapshotAt, snapshotAt);
        }
        _requireFact(LedgerLeaf.SUKUK_RESERVE, snapshotAt, outstanding, epoch, proof);
        reserveSnapshotAt = snapshotAt;
        reserveOutstanding = outstanding;
        emit ReserveUpdated(snapshotAt, outstanding, uint16(epoch));
    }

    /// @notice Set the oldest reserve snapshot subscription and close accept.
    function setMaxReserveAge(uint64 maxAge) external onlyRole(ADMIN_ROLE) {
        if (maxAge == 0) revert InvalidMaxAge();
        maxReserveAge = maxAge;
        emit MaxReserveAgeSet(maxAge);
    }

    /// @dev A verified reserve snapshot must exist and be recent, and it must
    ///      cover `supply`. Subscriptions never mint beyond what the latest
    ///      snapshot covers, and proceeds are never released against a stale one.
    function _requireReserveCovers(uint256 supply) private view {
        if (reserveSnapshotAt == 0) revert NoReserveSnapshot();
        if (block.timestamp > uint256(reserveSnapshotAt) + maxReserveAge) {
            revert ReserveTooOld(reserveSnapshotAt, maxReserveAge);
        }
        if (supply > reserveOutstanding) revert ReserveInsufficient(supply, reserveOutstanding);
    }

    /// @notice The accepted settlement coins.
    function coins() external view returns (address[] memory) {
        return _coins;
    }

    /// @notice The raw balance of `coin` held by this contract (0 for a coin that is not accepted).
    ///         It includes released held profit, so it is not what the coin can pay holders.
    function coinBalance(address coin) external view returns (uint256) {
        return isCoin[coin] ? IERC20(coin).balanceOf(address(this)) : 0;
    }

    /// @notice The part of `coin` that can pay ordinary profit and redemption (balance less held profit and any subscription escrow).
    function freeBalance(address coin) external view returns (uint256) {
        return isCoin[coin] ? _free(coin) : 0;
    }

    /// @notice Everything ever subscribed, summed over the coins. `raisedOf` is cumulative and is
    ///         not reduced by redemption or refunds. Refunds are tracked in `refundedOf`.
    function totalRaised() public view returns (uint256 sum) {
        for (uint256 i; i < _coins.length; ++i) sum += raisedOf[_coins[i]];
    }

    /// @notice Everything refunded after a cancelled subscription, summed over the coins.
    function totalRefunded() public view returns (uint256 sum) {
        for (uint256 i; i < _coins.length; ++i) sum += refundedOf[_coins[i]];
    }

    /// @notice The raise net of refunds: totalRaised() - totalRefunded().
    function netRaised() external view returns (uint256) {
        return totalRaised() - totalRefunded();
    }

    /// @notice Latest verified outstanding reserve figure (the mint cap).
    function reserveOf() external view returns (uint256) {
        return reserveOutstanding;
    }

    /// @notice Whether the live supply is within the latest verified reserve.
    function isFullyBacked() external view returns (bool) {
        return token.totalSupply() <= reserveOutstanding;
    }

    // ---------------------------------------------------------------
    // Subscription
    // ---------------------------------------------------------------

    /// @notice Open the primary sale. Requires proof that the bank's DPS
    ///         approved this issuance, with these exact terms, on the ledger.
    function openSubscription(uint256 epoch, bytes32[] calldata proof) external onlyRole(ADMIN_ROLE) {
        if (status != Status.Pending) revert WrongStatus(status);
        _requireFact(LedgerLeaf.SUKUK_APPROVED, terms.faceValue, terms.maturity, epoch, proof);
        status = Status.Subscription; // also fixes the nisbah (setTawfShare needs Pending)
        subscriptionDeadline = uint40(block.timestamp) + terms.subscriptionPeriod;
        emit SubscriptionOpened(subscriptionDeadline);
    }

    /// @notice Set Tawf's nisbah and fee wallet. Only while Pending, before
    ///         the subscription opens: investors commit under the disclosed ratio.
    function setTawfShare(uint16 nisbahBps, address recipient) external onlyRole(ADMIN_ROLE) {
        if (status != Status.Pending) revert TawfShareLocked();
        if (nisbahBps > MAX_TAWF_NISBAH_BPS) revert InvalidTerms();
        if (nisbahBps != 0 && (recipient == address(0) || recipient == address(this))) revert InvalidAddress();
        tawfNisbahBps = nisbahBps;
        feeRecipient = recipient;
        emit TawfShareSet(nisbahBps, recipient);
    }

    /// @notice Subscribe `amount` of `coin` (USD units) for the same number of token units.
    /// @dev The T-REX token enforces holder verification on mint; the explicit
    ///      isVerified check here fails fast with a clear error before cash
    ///      moves. A recent verified reserve snapshot must cover supply after mint.
    function subscribe(address coin, uint256 amount) external nonReentrant {
        if (status != Status.Subscription) revert WrongStatus(status);
        _requireActiveCoin(coin);
        if (block.timestamp >= subscriptionDeadline) revert SubscriptionClosed();
        if (!identityRegistry.isVerified(msg.sender)) revert NotEligible(msg.sender);
        if (amount < terms.minSubscription) revert BelowMinimum();
        uint256 supplyAfter = token.totalSupply() + amount;
        if (supplyAfter > terms.faceValue) revert ExceedsFaceValue();
        _requireReserveCovers(supplyAfter);

        IERC20(coin).safeTransferFrom(msg.sender, address(this), amount);
        paidOf[msg.sender][coin] += amount;
        raisedOf[coin] += amount;
        token.mint(msg.sender, amount);
        emit Subscribed(msg.sender, coin, amount);
    }

    /// @notice Close the sale once the window has ended or the issue is fully
    ///         subscribed. Releases proceeds to the issuer, or cancels for
    ///         refund if the minimum raise was missed.
    function closeSubscription() external onlyRole(ADMIN_ROLE) nonReentrant {
        if (status != Status.Subscription) revert WrongStatus(status);
        uint256 raised = token.totalSupply();
        if (block.timestamp < subscriptionDeadline && raised < terms.faceValue) revert SubscriptionStillOpen();

        if (raised < terms.minRaise) {
            status = Status.Cancelled;
            emit SubscriptionCancelled(raised);
            return;
        }
        _requireReserveCovers(raised);
        status = Status.Active;
        for (uint256 i; i < _coins.length; ++i) {
            uint256 part = raisedOf[_coins[i]];
            if (part != 0) IERC20(_coins[i]).safeTransfer(terms.issuerTreasury, part);
        }
        emit Issued(raised, terms.issuerTreasury);
    }

    /// @notice Return a cancelled subscription to the caller, at par. The coins
    ///         the caller paid come back first. If the caller holds more units than
    ///         they paid for (they bought tokens from another holder), the rest is
    ///         refunded from whatever escrow is left.
    function refund() external nonReentrant {
        if (status != Status.Cancelled) revert WrongStatus(status);
        uint256 units = token.balanceOf(msg.sender);
        if (units == 0) revert NothingToClaim();
        token.burn(msg.sender, units);
        uint256 remaining = units;
        for (uint256 i; i < _coins.length && remaining != 0; ++i) {
            address c = _coins[i];
            uint256 part = _min(_min(remaining, paidOf[msg.sender][c]), raisedOf[c] - refundedOf[c]);
            remaining -= _refundCoin(c, part);
        }
        for (uint256 i; i < _coins.length && remaining != 0; ++i) {
            address c = _coins[i];
            remaining -= _refundCoin(c, _min(remaining, raisedOf[c] - refundedOf[c]));
        }
        if (remaining != 0) revert RefundShortfall(remaining);
    }

    function _refundCoin(address c, uint256 part) private returns (uint256) {
        if (part == 0) return 0;
        uint256 paid = paidOf[msg.sender][c];
        paidOf[msg.sender][c] = paid > part ? paid - part : 0;
        refundedOf[c] += part;
        IERC20(c).safeTransfer(msg.sender, part);
        emit Refunded(msg.sender, c, part);
        return part;
    }

    // ---------------------------------------------------------------
    // Profit distribution
    // ---------------------------------------------------------------

    /// @notice Fund the distribution for the next period. The caller pays
    ///         exactly the amount the bank declared on the ledger.
    function distribute(uint16 period, address coin, uint256 amount, uint256 epoch, bytes32[] calldata proof)
        external
        onlyRole(FUNDER_ROLE)
        nonReentrant
    {
        if (status != Status.Active) revert WrongStatus(status);
        _requireActiveCoin(coin);
        if (period != lastPeriod + 1) revert PeriodNotSequential(lastPeriod + 1, period);
        _requireFact(LedgerLeaf.SUKUK_DISTRIBUTION, period, amount, epoch, proof);

        lastPeriod = period;
        if (amount != 0) {
            IERC20(coin).safeTransferFrom(msg.sender, address(this), amount);
            uint256 share = (amount * tawfNisbahBps) / 10_000;
            if (amount - share != 0) _profit.fund(amount - share, token.totalSupply());
            if (share != 0) {
                totalTawfShare += share;
                IERC20(coin).safeTransfer(feeRecipient, share);
                emit TawfShareTaken(period, coin, share, feeRecipient);
            }
        }
        emit ProfitDistributed(period, coin, amount);
    }

    /// @notice Withdraw the caller's distributed profit, paid in `coin`.
    function claim(address coin) external nonReentrant {
        _profit.settle(msg.sender, token.balanceOf(msg.sender));
        uint256 amount = _profit.take(msg.sender);
        if (amount == 0) revert NothingToClaim();
        _payFree(coin, msg.sender, amount);
        emit ProfitClaimed(msg.sender, coin, amount);
    }

    /// @notice Profit `investor` could claim right now.
    function claimable(address investor) external view returns (uint256) {
        return _profit.claimable(investor, token.balanceOf(investor));
    }

    /// @notice Cumulative profit per token unit, scaled by 1e18 (for parity
    ///         with the previous public view).
    function profitPerToken() external view returns (uint256) {
        return _profit.profitPerToken;
    }

    /// @notice `account`'s accumulator marker at its last settlement.
    function perTokenPaidOf(address account) external view returns (uint256) {
        return _profit.perTokenPaid[account];
    }

    /// @notice Profit settled to `account` but not yet withdrawn.
    function owedOf(address account) external view returns (uint256) {
        return _profit.owed[account];
    }

    // ---------------------------------------------------------------
    // Maturity and default
    // ---------------------------------------------------------------

    /// @notice Fund redemption at maturity with the amount declared on the ledger.
    function settleMaturity(address coin, uint256 amount, uint256 epoch, bytes32[] calldata proof)
        external
        onlyRole(FUNDER_ROLE)
        nonReentrant
    {
        if (status != Status.Active) revert WrongStatus(status);
        _requireActiveCoin(coin);
        _requireFact(LedgerLeaf.SUKUK_REDEMPTION, amount, 0, epoch, proof);
        status = Status.Matured;
        // Freeze the entitled set: transfers stop from here (afterBalanceChange).
        totalUnitsAtMaturity = token.totalSupply();
        _fundRedemption(coin, amount);
        emit MaturitySettled(coin, amount);
    }

    /// @notice Fund the recovery after a default declared on the ledger.
    function settleDefault(address coin, uint256 recovery, uint256 epoch, bytes32[] calldata proof)
        external
        onlyRole(FUNDER_ROLE)
        nonReentrant
    {
        if (status != Status.Active) revert WrongStatus(status);
        _requireActiveCoin(coin);
        _requireFact(LedgerLeaf.SUKUK_DEFAULT, recovery, 0, epoch, proof);
        status = Status.Defaulted;
        _fundRedemption(coin, recovery);
        emit DefaultSettled(coin, recovery);
    }

    /// @notice Pause or unpause a coin. A paused coin is not accepted for new money (subscribe, funding,
    ///         topUp) or as a preferred payout coin, but payouts still draw on it when the other
    ///         coins cannot cover them, so no holder is stranded.
    function setCoinPaused(address coin, bool paused) external onlyRole(ADMIN_ROLE) {
        if (!isCoin[coin]) revert CoinNotAccepted(coin);
        coinPaused[coin] = paused;
        emit CoinPausedSet(coin, paused);
    }

    /// @notice Add liquidity in an accepted coin. Anyone may call it, for
    ///         example the issuer topping up a coin a redemption was not funded in,
    ///         so holders can redeem and claim in the coin they prefer. It changes
    ///         no accounting, the coin is simply available to pay out.
    function topUp(address coin, uint256 amount) external nonReentrant {
        _requireActiveCoin(coin);
        IERC20(coin).safeTransferFrom(msg.sender, address(this), amount);
        emit CoinToppedUp(msg.sender, coin, amount);
    }

    /// @notice Burn the caller's tokens for their share of the redemption (or
    ///         recovery) amount, plus any unclaimed profit, paid in `coin`.
    function redeem(address coin) external nonReentrant {
        if (status != Status.Matured && status != Status.Defaulted) revert WrongStatus(status);
        uint256 units = token.balanceOf(msg.sender);
        if (units == 0) revert NothingToClaim();

        // Entitlement to profit held at maturity survives the burn.
        redeemedUnits[msg.sender] += units;
        // Burning settles profit at the pre-burn balance through the module hook.
        token.burn(msg.sender, units);
        uint256 profit = _profit.take(msg.sender);
        uint256 principal = (units * redemptionPerToken) / PRECISION;

        _payFree(coin, msg.sender, principal + profit);
        emit Redeemed(msg.sender, coin, units, principal, profit);
    }

    // ---------------------------------------------------------------
    // Profit held at a Shariah-flagged maturity
    // ---------------------------------------------------------------

    /// @notice Fund one Shariah-board release of held profit, proven on the
    ///         ledger (a = amount, b = release index). The caller (the issuer)
    ///         pays exactly that amount; holders at maturity claim it pro rata.
    function releaseHeldProfit(uint16 index, address coin, uint256 amount, uint256 epoch, bytes32[] calldata proof)
        external
        onlyRole(FUNDER_ROLE)
        nonReentrant
    {
        if (status != Status.Matured) revert WrongStatus(status);
        _requireActiveCoin(coin);
        if (index != heldReleases + 1) revert ReleaseNotSequential(heldReleases + 1, index);
        if (amount == 0) revert ZeroRelease();
        _requireFact(LedgerLeaf.SUKUK_PROFIT_RESOLUTION, amount, index, epoch, proof);

        heldReleases = index;
        IERC20(coin).safeTransferFrom(msg.sender, address(this), amount);
        heldProfitPerUnit += (amount * PRECISION) / totalUnitsAtMaturity;
        totalHeldReleased += amount;
        heldBalance += amount;
        heldBalanceOf[coin] += amount;
        lastReleaseAt = block.timestamp;
        emit HeldProfitReleased(index, coin, amount, heldProfitPerUnit);
    }

    /// @notice Units `holder` is entitled to: what they redeemed after
    ///         maturity plus what they still hold (transfers are frozen).
    function entitledUnits(address holder) public view returns (uint256) {
        return redeemedUnits[holder] + token.balanceOf(holder);
    }

    /// @notice Released profit `holder` can claim now.
    function claimableHeldProfit(address holder) public view returns (uint256) {
        uint256 mark = heldProfitPaidPerUnit[holder];
        if (sweptPerUnitMark > mark) mark = sweptPerUnitMark;
        return (entitledUnits(holder) * (heldProfitPerUnit - mark)) / PRECISION;
    }

    /// @notice Pull the caller's share of released profit, paid in `coin`.
    function claimProfit(address coin) external nonReentrant {
        if (status != Status.Matured) revert WrongStatus(status);
        uint256 amount = claimableHeldProfit(msg.sender);
        heldProfitPaidPerUnit[msg.sender] = heldProfitPerUnit;
        if (amount == 0) revert NothingToClaim();
        heldBalance -= amount;
        totalHeldClaimed += amount;
        _payHeld(coin, msg.sender, amount);
        emit HeldProfitClaimed(msg.sender, coin, entitledUnits(msg.sender), amount);
    }

    /// @notice Record the Shariah board's approved sweep destination, proven on
    ///         the ledger. Never the issuer, an admin, or this contract.
    function setSweepDestination(address destination, uint256 epoch, bytes32[] calldata proof) external {
        if (sweepDestination != address(0)) revert SweepDestinationAlreadySet();
        if (
            destination == address(0) || destination == address(this) || destination == address(token) || isCoin[destination]
                || destination == terms.issuerTreasury
                || destination == feeRecipient
                || hasRole(ADMIN_ROLE, destination) || hasRole(DEFAULT_ADMIN_ROLE, destination)
        ) revert InvalidSweepDestination(destination);
        _requireFact(LedgerLeaf.SUKUK_SWEEP_DESTINATION, uint256(uint160(destination)), 0, epoch, proof);
        sweepDestination = destination;
        emit SweepDestinationSet(destination);
    }

    /// @notice After the claim window (from the last release), send unclaimed
    ///         released profit to the board-approved destination. Profit swept
    ///         is no longer claimable.
    function sweepUnclaimed() external nonReentrant {
        if (sweepDestination == address(0)) revert SweepDestinationNotSet();
        if (lastReleaseAt == 0 || block.timestamp < lastReleaseAt + claimWindow) {
            revert ClaimWindowOpen(lastReleaseAt + claimWindow);
        }
        uint256 amount = heldBalance;
        heldBalance = 0;
        sweptPerUnitMark = heldProfitPerUnit;
        totalHeldSwept += amount;
        // Each coin's released profit goes out in the coin it was funded in.
        for (uint256 i; i < _coins.length; ++i) {
            address c = _coins[i];
            uint256 part = heldBalanceOf[c];
            if (part == 0) continue;
            heldBalanceOf[c] = 0;
            IERC20(c).safeTransfer(sweepDestination, part);
            emit HeldProfitSwept(sweepDestination, c, part);
        }
    }

    /// @notice Set how long holders can claim after the last release.
    function setClaimWindow(uint256 window) external onlyRole(ADMIN_ROLE) {
        if (window == 0) revert InvalidClaimWindow();
        claimWindow = window;
        emit ClaimWindowSet(window);
    }

    // ---------------------------------------------------------------
    // Module hook
    // ---------------------------------------------------------------

    /// @inheritdoc IBalanceCheckpoint
    /// @dev Called by the bound DistributionCheckpointModule AFTER balances
    ///      moved. Reconstruct pre-change balances and settle each side there:
    ///      the sender held `current + amount`, the receiver held
    ///      `current - amount`. Mint has from == 0, burn has to == 0.
    function afterBalanceChange(address from, address to, uint256 amount) external {
        if (msg.sender != module) revert OnlyModule();
        // Holder-to-holder transfers are frozen once matured, so the holders at
        // maturity and their units stay fixed. Burns (redemption) still work.
        if (status == Status.Matured && from != address(0) && to != address(0)) revert TransfersFrozen();
        if (from != address(0)) {
            _profit.settle(from, token.balanceOf(from) + amount);
        }
        if (to != address(0)) {
            uint256 current = token.balanceOf(to);
            _profit.settle(to, current >= amount ? current - amount : 0);
        }
    }

    // ---------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------

    /// @dev Pay `amount` USD units out of the balances that are not held profit or subscription escrow.
    function _payFree(address preferred, address to, uint256 amount) private {
        _payOrdered(preferred, to, amount, false);
    }

    /// @dev Same split, but drawing only from released held profit, coin by coin.
    function _payHeld(address preferred, address to, uint256 amount) private {
        _payOrdered(preferred, to, amount, true);
    }

    /// @dev The preferred coin goes first, unless it is paused (then it counts as no preference). Then the
    ///      active coins in list order, and the paused coins last. A pause blocks new money and the choice
    ///      of coin, it never stops a payout. One PayoutPart is emitted per coin used, and it reverts only
    ///      when the total available balance cannot cover the payout.
    function _payOrdered(address preferred, address to, uint256 amount, bool held) private {
        if (!isCoin[preferred]) revert CoinNotAccepted(preferred);
        uint256 remaining = amount;
        if (!coinPaused[preferred]) remaining -= _payPart(preferred, to, remaining, held);
        for (uint256 i; i < _coins.length && remaining != 0; ++i) {
            address c = _coins[i];
            if (c != preferred && !coinPaused[c]) remaining -= _payPart(c, to, remaining, held);
        }
        for (uint256 i; i < _coins.length && remaining != 0; ++i) {
            address c = _coins[i];
            if (coinPaused[c]) remaining -= _payPart(c, to, remaining, held);
        }
        if (remaining != 0) revert InsufficientCoin(preferred, amount - remaining, amount);
    }

    function _payPart(address coin, address to, uint256 want, bool held) private returns (uint256 part) {
        if (held) {
            part = _min(want, heldBalanceOf[coin]);
            if (part != 0) heldBalanceOf[coin] -= part;
        } else {
            part = _min(want, _free(coin));
        }
        if (part == 0) return 0;
        IERC20(coin).safeTransfer(to, part);
        emit PayoutPart(to, coin, part);
    }

    /// @dev The balance of `coin` that can pay ordinary profit and redemption: what the contract holds
    ///      less released held profit and, while a sale is open or cancelled, the subscription escrow.
    function _free(address coin) private view returns (uint256) {
        uint256 bal = IERC20(coin).balanceOf(address(this));
        uint256 reserved = heldBalanceOf[coin];
        if (status == Status.Subscription || status == Status.Cancelled) reserved += raisedOf[coin] - refundedOf[coin];
        return bal > reserved ? bal - reserved : 0;
    }

    /// @dev A coin that may receive new money or be named as the preferred payout coin.
    function _requireActiveCoin(address coin) private view {
        if (!isCoin[coin]) revert CoinNotAccepted(coin);
        if (coinPaused[coin]) revert CoinIsPaused(coin);
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    function _fundRedemption(address coin, uint256 amount) private {
        if (amount != 0) {
            IERC20(coin).safeTransferFrom(msg.sender, address(this), amount);
            redemptionPerToken = (amount * PRECISION) / token.totalSupply();
        }
    }

    function _requireFact(bytes32 kind, uint256 a, uint256 b, uint256 epoch, bytes32[] calldata proof) private view {
        if (!anchor.verify(epoch, LedgerLeaf.hash(ledgerChainId, kind, terms.sukukId, a, b), proof)) {
            revert ProofInvalid();
        }
    }

    /// @notice Ledger leaf encoding, identical to tawf-network's LedgerLeaf.hash.
    /// @dev Thin wrapper over the LedgerLeaf library so tests can assert the
    ///      golden vector against this contract exactly as before.
    function leafHash(uint256 ledgerChainId_, bytes32 kind, bytes32 subjectId, uint256 a, uint256 b)
        public
        pure
        returns (bytes32)
    {
        return LedgerLeaf.hash(ledgerChainId_, kind, subjectId, a, b);
    }
}
