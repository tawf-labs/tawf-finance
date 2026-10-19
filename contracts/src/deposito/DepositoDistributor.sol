// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { ITrexToken } from "../interfaces/ITrexToken.sol";
import { IBalanceCheckpoint } from "../sukuk/IBalanceCheckpoint.sol";
import { ProfitAccumulator } from "../lib/ProfitAccumulator.sol";

/**
 * @title DepositoDistributor
 * @notice Profit distribution and maturity redemption for one tokenized BPRS
 *         deposito product. The product token is an externally deployed T-REX
 *         token (2 decimals, rupiah sen) that this distributor burns as an
 *         AGENT on redemption. Profit and principal are both paid in the
 *         settlement token (MockIDRX).
 *
 * @dev Pragma ^0.8.24 and OZ v5, talking to the T-REX token only through
 *      ITrexToken. A DistributionCheckpointModule (0.8.17) bound to the
 *      token's compliance calls afterBalanceChange across the pragma boundary
 *      so profit follows the holder of record across transfers.
 *
 *      Shariah / profit-and-loss-sharing constraint, load-bearing: holders are
 *      paid only from settlement-token cash that has actually been funded.
 *      fundPeriod adds exactly the profit the funder supplies, pro rata via
 *      ProfitAccumulator; fundPrincipal tops up the principal escrow the bank
 *      is returning at maturity. There is no rate and no promised return here.
 *
 *      Flow: BPRS/admin funds profit per period (fundPeriod) and investors
 *      claim() it any time. At or after maturity the admin opens redemption
 *      (openRedemption) and funds the principal escrow (fundPrincipal); an
 *      investor then redeems(amount), which burns `amount` units and pays
 *      `amount` sen of principal plus any unclaimed profit. Checks-effects-
 *      interactions and ReentrancyGuard guard every cash move.
 */
contract DepositoDistributor is AccessControl, ReentrancyGuard, IBalanceCheckpoint {
    using SafeERC20 for IERC20;
    using ProfitAccumulator for ProfitAccumulator.State;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant FUNDER_ROLE = keccak256("FUNDER_ROLE");

    IERC20 public immutable settlement;
    ITrexToken public immutable token;
    /// @notice The DistributionCheckpointModule allowed to report balances.
    address public immutable module;

    /// @notice Whether redemption is open (set at/after maturity by admin).
    bool public redemptionOpen;
    /// @notice Principal sen funded into escrow and still available.
    uint256 public principalEscrow;
    uint16 public lastPeriod;

    ProfitAccumulator.State private _profit;

    error InvalidAddress();
    error OnlyModule();
    error NothingToClaim();
    error ZeroAmount();
    error RedemptionNotOpen();
    error RedemptionAlreadyOpen();
    error InsufficientBalance();
    error PeriodNotSequential(uint16 expected, uint16 got);
    error PrincipalEscrowShort(uint256 need, uint256 have);

    event PeriodFunded(uint16 indexed period, uint256 amount);
    event ProfitClaimed(address indexed investor, uint256 amount);
    event RedemptionOpened();
    event PrincipalFunded(address indexed from, uint256 amount);
    event Redeemed(address indexed investor, uint256 units, uint256 principalPaid, uint256 profitPaid);

    /// @param settlement_ Settlement token (MockIDRX, 2 decimals).
    /// @param token_ The deposito product T-REX token; this distributor must
    ///        be one of its AGENTs.
    /// @param module_ The DistributionCheckpointModule bound to the token's
    ///        compliance; the only address allowed to call afterBalanceChange.
    /// @param admin DEFAULT_ADMIN_ROLE + ADMIN_ROLE holder.
    /// @param funder FUNDER_ROLE holder (BPRS/ops) that funds profit/principal.
    constructor(IERC20 settlement_, ITrexToken token_, address module_, address admin, address funder) {
        if (
            address(settlement_) == address(0) || address(token_) == address(0) || module_ == address(0)
                || admin == address(0) || funder == address(0)
        ) revert InvalidAddress();
        settlement = settlement_;
        token = token_;
        module = module_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(FUNDER_ROLE, funder);
    }

    // ---------------------------------------------------------------
    // Profit distribution
    // ---------------------------------------------------------------

    /// @notice Fund profit for the next sequential period, shared pro rata.
    ///         Caller must have approved this distributor for `amount`.
    function fundPeriod(uint16 period, uint256 amount) external nonReentrant onlyRole(FUNDER_ROLE) {
        if (period != lastPeriod + 1) revert PeriodNotSequential(lastPeriod + 1, period);
        lastPeriod = period;
        if (amount != 0) {
            settlement.safeTransferFrom(msg.sender, address(this), amount);
            _profit.fund(amount, token.totalSupply());
        }
        emit PeriodFunded(period, amount);
    }

    /// @notice Withdraw the caller's distributed profit.
    function claim() external nonReentrant {
        _profit.settle(msg.sender, token.balanceOf(msg.sender));
        uint256 amount = _profit.take(msg.sender);
        if (amount == 0) revert NothingToClaim();
        settlement.safeTransfer(msg.sender, amount);
        emit ProfitClaimed(msg.sender, amount);
    }

    /// @notice Profit `investor` could claim right now.
    function claimable(address investor) external view returns (uint256) {
        return _profit.claimable(investor, token.balanceOf(investor));
    }

    /// @notice Cumulative profit per token unit, scaled by 1e18.
    function profitPerToken() external view returns (uint256) {
        return _profit.profitPerToken;
    }

    // ---------------------------------------------------------------
    // Maturity and redemption
    // ---------------------------------------------------------------

    /// @notice Open redemption at/after maturity. Admin action.
    function openRedemption() external onlyRole(ADMIN_ROLE) {
        if (redemptionOpen) revert RedemptionAlreadyOpen();
        redemptionOpen = true;
        emit RedemptionOpened();
    }

    /// @notice Fund the principal escrow the bank is returning at maturity.
    ///         Caller must have approved this distributor for `amount` sen.
    function fundPrincipal(uint256 amount) external nonReentrant onlyRole(FUNDER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        settlement.safeTransferFrom(msg.sender, address(this), amount);
        principalEscrow += amount;
        emit PrincipalFunded(msg.sender, amount);
    }

    /// @notice Redeem `amount` units at maturity: burn the tokens and pay
    ///         `amount` sen of principal plus any unclaimed profit (settled at
    ///         the pre-burn balance through the module hook).
    /// @dev One deposito sen token redeems for one sen of principal, so
    ///      redemption is at par from the funded escrow.
    function redeem(uint256 amount) external nonReentrant {
        if (!redemptionOpen) revert RedemptionNotOpen();
        if (amount == 0) revert ZeroAmount();
        if (token.balanceOf(msg.sender) < amount) revert InsufficientBalance();
        if (principalEscrow < amount) revert PrincipalEscrowShort(amount, principalEscrow);

        // Effects first: reduce escrow, then burn (burn settles profit at the
        // pre-burn balance via the module hook).
        principalEscrow -= amount;
        token.burn(msg.sender, amount);

        uint256 profit = _profit.take(msg.sender);

        settlement.safeTransfer(msg.sender, amount + profit);
        emit Redeemed(msg.sender, amount, amount, profit);
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
}
