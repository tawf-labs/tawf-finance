// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
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
 *      Shariah / profit-and-loss-sharing constraint, load-bearing: holders
 *      are paid only from USDC that has actually arrived here against a
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

    uint256 private constant PRECISION = 1e18;

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
        /// @dev Maximum issue size in USDC base units, must equal the ledger's.
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

    IERC20 public immutable usdc;
    ILedgerAnchor public immutable anchor;
    ITawfIdentityRegistry public immutable identityRegistry;
    ITrexToken public immutable token;
    uint256 public immutable ledgerChainId;

    Terms public terms;
    Status public status;
    uint40 public subscriptionDeadline;
    uint16 public lastPeriod;

    /// @notice USDC per token unit paid at redemption, scaled by 1e18.
    uint256 public redemptionPerToken;

    /// @notice Latest verified reserve snapshot timestamp (SUKUK_RESERVE a).
    uint64 public reserveSnapshotAt;
    /// @notice Latest verified outstanding reserve cap (SUKUK_RESERVE b).
    uint256 public reserveOutstanding;
    /// @notice Oldest reserve snapshot (seconds before now) that subscription
    ///         and close will accept. Admin-configurable.
    uint64 public maxReserveAge = 3 days;

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

    /// @notice The compliance module authorized to report balance changes.
    address public immutable module;

    event SubscriptionOpened(uint40 deadline);
    event Subscribed(address indexed investor, uint256 amount);
    event Issued(uint256 amount, address indexed issuerTreasury);
    event SubscriptionCancelled(uint256 raised);
    event Refunded(address indexed investor, uint256 amount);
    event ProfitDistributed(uint16 indexed period, uint256 amount);
    event ProfitClaimed(address indexed investor, uint256 amount);
    event MaturitySettled(uint256 amount);
    event DefaultSettled(uint256 recovery);
    event Redeemed(address indexed investor, uint256 units, uint256 principalPaid, uint256 profitPaid);
    event ReserveUpdated(uint64 snapshotAt, uint256 outstanding, uint16 epoch);
    event MaxReserveAgeSet(uint64 maxAge);

    /// @param usdc_ Settlement token (USDC/MockUSDC).
    /// @param anchor_ LedgerAnchor the ledger roots are anchored on.
    /// @param identityRegistry_ Shared T-REX IdentityRegistry (isVerified).
    /// @param token_ The externally deployed T-REX sukuk series token; this
    ///        distributor must be one of its AGENTs.
    /// @param module_ The DistributionCheckpointModule bound to the token's
    ///        compliance; the only address allowed to call afterBalanceChange.
    /// @param terms_ Issuance terms; must match the ledger record.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and ADMIN_ROLE.
    constructor(
        IERC20 usdc_,
        ILedgerAnchor anchor_,
        ITawfIdentityRegistry identityRegistry_,
        ITrexToken token_,
        address module_,
        Terms memory terms_,
        address admin
    ) {
        if (
            address(usdc_) == address(0) || address(anchor_) == address(0)
                || address(identityRegistry_) == address(0) || address(token_) == address(0) || module_ == address(0)
                || terms_.issuerTreasury == address(0) || admin == address(0)
        ) revert InvalidAddress();
        if (
            terms_.sukukId == bytes32(0) || terms_.faceValue == 0 || terms_.minRaise == 0
                || terms_.minRaise > terms_.faceValue || terms_.subscriptionPeriod == 0
                || terms_.minSubscription == 0 || terms_.maturity <= block.timestamp
        ) revert InvalidTerms();

        usdc = usdc_;
        anchor = anchor_;
        identityRegistry = identityRegistry_;
        token = token_;
        module = module_;
        ledgerChainId = anchor_.ledgerChainId();
        terms = terms_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
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
        status = Status.Subscription;
        subscriptionDeadline = uint40(block.timestamp) + terms.subscriptionPeriod;
        emit SubscriptionOpened(subscriptionDeadline);
    }

    /// @notice Subscribe `amount` USDC for the same number of token units.
    /// @dev The T-REX token enforces holder verification on mint; the explicit
    ///      isVerified check here fails fast with a clear error before cash
    ///      moves. A recent verified reserve snapshot must cover supply after mint.
    function subscribe(uint256 amount) external nonReentrant {
        if (status != Status.Subscription) revert WrongStatus(status);
        if (block.timestamp >= subscriptionDeadline) revert SubscriptionClosed();
        if (!identityRegistry.isVerified(msg.sender)) revert NotEligible(msg.sender);
        if (amount < terms.minSubscription) revert BelowMinimum();
        uint256 supplyAfter = token.totalSupply() + amount;
        if (supplyAfter > terms.faceValue) revert ExceedsFaceValue();
        _requireReserveCovers(supplyAfter);

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        token.mint(msg.sender, amount);
        emit Subscribed(msg.sender, amount);
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
        usdc.safeTransfer(terms.issuerTreasury, raised);
        emit Issued(raised, terms.issuerTreasury);
    }

    /// @notice Return a cancelled subscription to the caller, at par.
    function refund() external nonReentrant {
        if (status != Status.Cancelled) revert WrongStatus(status);
        uint256 units = token.balanceOf(msg.sender);
        if (units == 0) revert NothingToClaim();
        token.burn(msg.sender, units);
        usdc.safeTransfer(msg.sender, units);
        emit Refunded(msg.sender, units);
    }

    // ---------------------------------------------------------------
    // Profit distribution
    // ---------------------------------------------------------------

    /// @notice Fund the distribution for the next period. The caller pays
    ///         exactly the amount the bank declared on the ledger.
    function distribute(uint16 period, uint256 amount, uint256 epoch, bytes32[] calldata proof)
        external
        nonReentrant
    {
        if (status != Status.Active) revert WrongStatus(status);
        if (period != lastPeriod + 1) revert PeriodNotSequential(lastPeriod + 1, period);
        _requireFact(LedgerLeaf.SUKUK_DISTRIBUTION, period, amount, epoch, proof);

        lastPeriod = period;
        if (amount != 0) {
            usdc.safeTransferFrom(msg.sender, address(this), amount);
            _profit.fund(amount, token.totalSupply());
        }
        emit ProfitDistributed(period, amount);
    }

    /// @notice Withdraw the caller's distributed profit.
    function claim() external nonReentrant {
        _profit.settle(msg.sender, token.balanceOf(msg.sender));
        uint256 amount = _profit.take(msg.sender);
        if (amount == 0) revert NothingToClaim();
        usdc.safeTransfer(msg.sender, amount);
        emit ProfitClaimed(msg.sender, amount);
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
    function settleMaturity(uint256 amount, uint256 epoch, bytes32[] calldata proof) external nonReentrant {
        if (status != Status.Active) revert WrongStatus(status);
        _requireFact(LedgerLeaf.SUKUK_REDEMPTION, amount, 0, epoch, proof);
        status = Status.Matured;
        _fundRedemption(amount);
        emit MaturitySettled(amount);
    }

    /// @notice Fund the recovery after a default declared on the ledger.
    function settleDefault(uint256 recovery, uint256 epoch, bytes32[] calldata proof) external nonReentrant {
        if (status != Status.Active) revert WrongStatus(status);
        _requireFact(LedgerLeaf.SUKUK_DEFAULT, recovery, 0, epoch, proof);
        status = Status.Defaulted;
        _fundRedemption(recovery);
        emit DefaultSettled(recovery);
    }

    /// @notice Burn the caller's tokens for their share of the redemption (or
    ///         recovery) amount, plus any unclaimed profit.
    function redeem() external nonReentrant {
        if (status != Status.Matured && status != Status.Defaulted) revert WrongStatus(status);
        uint256 units = token.balanceOf(msg.sender);
        if (units == 0) revert NothingToClaim();

        // Burning settles profit at the pre-burn balance through the module hook.
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
    ///      moved. Reconstruct pre-change balances and settle each side there:
    ///      the sender held `current + amount`, the receiver held
    ///      `current - amount`. Mint has from == 0, burn has to == 0.
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
    // Internals
    // ---------------------------------------------------------------

    function _fundRedemption(uint256 amount) private {
        if (amount != 0) {
            usdc.safeTransferFrom(msg.sender, address(this), amount);
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
