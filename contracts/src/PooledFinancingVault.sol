// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { ERC4626 } from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { Compliance } from "./Compliance.sol";

/**
 * @title PooledFinancingVault
 * @notice A second, complementary investor product alongside the existing
 *         per-deal RedemptionVault/BondReceiptNFT pair, not a replacement
 *         for it. Where a BondReceiptNFT position is a fixed-term note
 *         against one specific DealRegistry deal, this is an ERC-4626 vault
 *         giving fungible, pooled exposure across however many deals the
 *         pool has allocated into, closer to how wakalah bil istithmar
 *         pooling already works conceptually (regulation.md §3.1).
 *
 * @dev Shariah / profit-and-loss-sharing constraint, load-bearing, do not
 *      relax it casually: totalAssets() is left at ERC4626's own default
 *      (the vault's own USDC balance). Share price therefore only ever
 *      moves with USDC that has actually landed in this contract, either
 *      an investor's deposit or a realized repayment recorded via
 *      recordRepayment. Nothing here ever assumes or promises a return
 *      ahead of that cash arriving. That is what keeps this consistent with
 *      the profit-and-loss-sharing principle the existing akad structure
 *      relies on, a guaranteed-return vault would not be.
 *
 *      Explicit open item, intentionally out of scope for this pass: how
 *      the vault decides which DealRegistry deals to allocate its pooled
 *      USDC into, and how it reconciles that allocation against
 *      recordRepayment's inflows, is not implemented here. See the plan
 *      this contract was built against; that allocation design needs its
 *      own follow-up spec, improvising it here was explicitly out of scope.
 *
 *      Shares are non-transferable via the same Compliance module
 *      BondReceiptNFT uses (shared IdentityRegistry, one whitelist across
 *      both products), for the same reason BondReceiptNFT is soulbound,
 *      not because ERC-4626 requires fungible shares to be transferable.
 */
contract PooledFinancingVault is ERC4626, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPS_ROLE = keccak256("OPS_ROLE");

    /// @notice Fixed instrument id this vault's shares are checked against
    ///         in Compliance, a vault has one share class, unlike
    ///         BondReceiptNFT's per-dealId instruments.
    uint256 public constant INSTRUMENT_ID = 0;

    Compliance public compliance;

    error InvalidAddress();
    error ZeroAmount();
    error TransferBlocked();

    event ComplianceSet(address compliance);
    event RepaymentRecorded(address indexed from, uint256 amount);

    /// @param asset_ The pooled underlying, USDC in production.
    /// @param admin Address (an EOA for local dev, a Safe multisig in
    ///        production) granted DEFAULT_ADMIN_ROLE and ADMIN_ROLE.
    constructor(
        IERC20 asset_,
        address admin
    ) ERC4626(asset_) ERC20("Tawf Pooled Financing Shares", "tPFS") {
        if (address(asset_) == address(0) || admin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Admin configuration
    // ---------------------------------------------------------------------

    /// @notice Wire (or unwire, via address(0)) the compliance module that
    ///         gates share transfers. Unset means every transfer reverts,
    ///         the same soulbound-by-default posture as BondReceiptNFT.
    function setCompliance(Compliance compliance_) external onlyRole(ADMIN_ROLE) {
        compliance = compliance_;
        emit ComplianceSet(address(compliance_));
    }

    // ---------------------------------------------------------------------
    // Realized repayment income
    // ---------------------------------------------------------------------

    /**
     * @notice Deposit realized repayment income into the pool, increasing
     *         totalAssets (and therefore share price) by exactly the amount
     *         of real USDC pulled in. Caller must have approved this vault.
     *
     * @dev Gated by OPS_ROLE, the same role that gates RedemptionVault's
     *      repay() for the per-deal product, for the same disbursement-
     *      integrity reason: this is where real (or claimed-to-be-real)
     *      cash enters the pool, and should sit behind the same multisig
     *      discipline as the equivalent per-deal action, not a lighter one.
     */
    function recordRepayment(uint256 amount) external nonReentrant onlyRole(OPS_ROLE) {
        if (amount == 0) revert ZeroAmount();
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        emit RepaymentRecorded(msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Transfer policy
    // ---------------------------------------------------------------------

    /// @dev Routes every non-mint/burn ERC20 transfer of shares through the
    ///      same Compliance check BondReceiptNFT uses, keyed on this
    ///      vault's address and the fixed INSTRUMENT_ID. ERC4626's own
    ///      deposit/mint/withdraw/redeem all call _update with from or to
    ///      == address(0) internally, so normal vault operations are never
    ///      blocked by this, only a direct share-to-share transfer is.
    function _update(address from, address to, uint256 value) internal virtual override(ERC20) {
        if (from != address(0) && to != address(0)) {
            if (address(compliance) == address(0)) revert TransferBlocked();
            if (!compliance.canTransfer(address(this), INSTRUMENT_ID, from, to)) {
                revert TransferBlocked();
            }
        }
        super._update(from, to, value);
    }

    /// @dev AccessControl and ERC20/IERC4626 do not otherwise collide, but
    ///      ERC4626/ERC20 both implement IERC20Metadata's decimals(); no
    ///      override needed there, ERC4626 already resolves it. Only ERC165
    ///      needs resolving here, AccessControl provides it, ERC4626 does
    ///      not implement it, so no override conflict exists in practice,
    ///      this function is included for future-proofing if that changes.
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
