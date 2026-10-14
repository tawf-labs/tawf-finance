// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { Compliance } from "../Compliance.sol";
import { IdentityRegistry } from "../IdentityRegistry.sol";
import { ILedgerAnchor } from "./ILedgerAnchor.sol";
import { SukukToken, ISukukBalanceHook } from "./SukukToken.sol";

/**
 * @title SukukDistributor
 * @notice Cash side of one sukuk issuance on Arbitrum: primary
 *         subscription, periodic profit distribution, and redemption at
 *         maturity or after a default. Deploys the issuance's SukukToken.
 *
 * @dev Every step that opens the sale or pays holders needs a Merkle proof
 *      that the matching fact is recorded in the SukukLedger on Tawf
 *      Network (the private ledger) and anchored on this chain through
 *      LedgerAnchor. This contract cannot be told an amount, it can only be
 *      shown one.
 *
 *      Shariah / profit-and-loss-sharing constraint, load-bearing, the same
 *      one PooledFinancingVault documents: holders are paid only from USDC
 *      that has actually arrived here against a declared, realized amount.
 *      There is no rate, no accrual and no promised return in this
 *      contract. A period can be declared at zero, and redemption pays
 *      whatever the issuer declared and funded, pro rata, which may be
 *      below par.
 *
 *      Profit is tracked per token (cumulative profit per unit), so it
 *      follows the holder of record across secondary transfers without
 *      snapshots: SukukToken calls beforeBalanceChange on every mint, burn
 *      and transfer.
 */
contract SukukDistributor is AccessControl, ReentrancyGuard, ISukukBalanceHook {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // Leaf kinds. Copied from tawf-network/contracts/src/common/LedgerLeaf.sol,
    // both repos assert the same golden vector in their tests.
    bytes32 internal constant SUKUK_APPROVED = keccak256("tawf.sukuk.approved");
    bytes32 internal constant SUKUK_DISTRIBUTION = keccak256("tawf.sukuk.distribution");
    bytes32 internal constant SUKUK_REDEMPTION = keccak256("tawf.sukuk.redemption");
    bytes32 internal constant SUKUK_DEFAULT = keccak256("tawf.sukuk.default");

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
    IdentityRegistry public immutable identityRegistry;
    SukukToken public immutable token;
    uint256 public immutable ledgerChainId;

    Terms public terms;
    Status public status;
    uint40 public subscriptionDeadline;
    uint16 public lastPeriod;

    /// @notice Cumulative profit per token unit, scaled by 1e18.
    uint256 public profitPerToken;
    /// @notice USDC per token unit paid at redemption, scaled by 1e18.
    uint256 public redemptionPerToken;

    mapping(address => uint256) private _profitPerTokenPaid;
    mapping(address => uint256) private _owed;

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
    error OnlyToken();
    error NothingToClaim();

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

    /// @param admin Address (an EOA for local dev, a Safe multisig in
    ///        production) granted DEFAULT_ADMIN_ROLE and ADMIN_ROLE.
    constructor(
        IERC20 usdc_,
        ILedgerAnchor anchor_,
        Compliance compliance_,
        Terms memory terms_,
        string memory name_,
        string memory symbol_,
        address admin
    ) {
        if (
            address(usdc_) == address(0) || address(anchor_) == address(0) || address(compliance_) == address(0)
                || terms_.issuerTreasury == address(0) || admin == address(0)
        ) revert InvalidAddress();
        if (
            terms_.sukukId == bytes32(0) || terms_.faceValue == 0 || terms_.minRaise == 0
                || terms_.minRaise > terms_.faceValue || terms_.subscriptionPeriod == 0
                || terms_.minSubscription == 0 || terms_.maturity <= block.timestamp
        ) revert InvalidTerms();

        usdc = usdc_;
        anchor = anchor_;
        identityRegistry = compliance_.identityRegistry();
        ledgerChainId = anchor_.ledgerChainId();
        terms = terms_;
        token = new SukukToken(name_, symbol_, compliance_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------
    // Subscription
    // ---------------------------------------------------------------

    /// @notice Open the primary sale. Requires proof that the bank's DPS
    ///         approved this issuance, with these exact terms, on the ledger.
    function openSubscription(uint256 epoch, bytes32[] calldata proof) external onlyRole(ADMIN_ROLE) {
        if (status != Status.Pending) revert WrongStatus(status);
        _requireFact(SUKUK_APPROVED, terms.faceValue, terms.maturity, epoch, proof);
        status = Status.Subscription;
        subscriptionDeadline = uint40(block.timestamp) + terms.subscriptionPeriod;
        emit SubscriptionOpened(subscriptionDeadline);
    }

    /// @notice Subscribe `amount` USDC for the same number of token units.
    function subscribe(uint256 amount) external nonReentrant {
        if (status != Status.Subscription) revert WrongStatus(status);
        if (block.timestamp >= subscriptionDeadline) revert SubscriptionClosed();
        if (!identityRegistry.isEligible(msg.sender)) revert NotEligible(msg.sender);
        if (amount < terms.minSubscription) revert BelowMinimum();
        if (token.totalSupply() + amount > terms.faceValue) revert ExceedsFaceValue();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        token.mint(msg.sender, amount);
        emit Subscribed(msg.sender, amount);
    }

    /// @notice Close the sale once the window has ended or the issue is
    ///         fully subscribed. Releases proceeds to the issuer, or cancels
    ///         the issuance for refund if the minimum raise was missed.
    function closeSubscription() external onlyRole(ADMIN_ROLE) nonReentrant {
        if (status != Status.Subscription) revert WrongStatus(status);
        uint256 raised = token.totalSupply();
        if (block.timestamp < subscriptionDeadline && raised < terms.faceValue) revert SubscriptionStillOpen();

        if (raised < terms.minRaise) {
            status = Status.Cancelled;
            emit SubscriptionCancelled(raised);
            return;
        }
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
        _requireFact(SUKUK_DISTRIBUTION, period, amount, epoch, proof);

        lastPeriod = period;
        if (amount != 0) {
            usdc.safeTransferFrom(msg.sender, address(this), amount);
            profitPerToken += (amount * PRECISION) / token.totalSupply();
        }
        emit ProfitDistributed(period, amount);
    }

    /// @notice Withdraw the caller's distributed profit.
    function claim() external nonReentrant {
        _settle(msg.sender);
        uint256 amount = _owed[msg.sender];
        if (amount == 0) revert NothingToClaim();
        _owed[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit ProfitClaimed(msg.sender, amount);
    }

    /// @notice Profit `investor` could claim right now.
    function claimable(address investor) external view returns (uint256) {
        return _owed[investor]
            + (token.balanceOf(investor) * (profitPerToken - _profitPerTokenPaid[investor])) / PRECISION;
    }

    // ---------------------------------------------------------------
    // Maturity and default
    // ---------------------------------------------------------------

    /// @notice Fund redemption at maturity with the amount declared on the ledger.
    function settleMaturity(uint256 amount, uint256 epoch, bytes32[] calldata proof) external nonReentrant {
        if (status != Status.Active) revert WrongStatus(status);
        _requireFact(SUKUK_REDEMPTION, amount, 0, epoch, proof);
        status = Status.Matured;
        _fundRedemption(amount);
        emit MaturitySettled(amount);
    }

    /// @notice Fund the recovery after a default declared on the ledger.
    function settleDefault(uint256 recovery, uint256 epoch, bytes32[] calldata proof) external nonReentrant {
        if (status != Status.Active) revert WrongStatus(status);
        _requireFact(SUKUK_DEFAULT, recovery, 0, epoch, proof);
        status = Status.Defaulted;
        _fundRedemption(recovery);
        emit DefaultSettled(recovery);
    }

    /// @notice Burn the caller's tokens for their share of the redemption
    ///         (or recovery) amount, plus any unclaimed profit.
    function redeem() external nonReentrant {
        if (status != Status.Matured && status != Status.Defaulted) revert WrongStatus(status);
        uint256 units = token.balanceOf(msg.sender);
        if (units == 0) revert NothingToClaim();

        // Burning settles profit at the pre-burn balance through the hook.
        token.burn(msg.sender, units);
        uint256 profit = _owed[msg.sender];
        _owed[msg.sender] = 0;
        uint256 principal = (units * redemptionPerToken) / PRECISION;

        usdc.safeTransfer(msg.sender, principal + profit);
        emit Redeemed(msg.sender, units, principal, profit);
    }

    // ---------------------------------------------------------------
    // Token hook
    // ---------------------------------------------------------------

    /// @inheritdoc ISukukBalanceHook
    function beforeBalanceChange(address from, address to) external {
        if (msg.sender != address(token)) revert OnlyToken();
        if (from != address(0)) _settle(from);
        if (to != address(0)) _settle(to);
    }

    // ---------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------

    function _settle(address account) private {
        uint256 delta = profitPerToken - _profitPerTokenPaid[account];
        if (delta != 0) {
            _owed[account] += (token.balanceOf(account) * delta) / PRECISION;
            _profitPerTokenPaid[account] = profitPerToken;
        }
    }

    function _fundRedemption(uint256 amount) private {
        if (amount != 0) {
            usdc.safeTransferFrom(msg.sender, address(this), amount);
            redemptionPerToken = (amount * PRECISION) / token.totalSupply();
        }
    }

    function _requireFact(bytes32 kind, uint256 a, uint256 b, uint256 epoch, bytes32[] calldata proof) private view {
        if (!anchor.verify(epoch, leafHash(ledgerChainId, kind, terms.sukukId, a, b), proof)) revert ProofInvalid();
    }

    /// @notice Ledger leaf encoding, identical to tawf-network's LedgerLeaf.hash.
    function leafHash(uint256 ledgerChainId_, bytes32 kind, bytes32 subjectId, uint256 a, uint256 b)
        public
        pure
        returns (bytes32)
    {
        return keccak256(bytes.concat(keccak256(abi.encode(ledgerChainId_, kind, subjectId, a, b))));
    }
}
