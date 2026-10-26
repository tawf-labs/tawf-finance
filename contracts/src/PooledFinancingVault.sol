// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Initializable } from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import { ERC4626Upgradeable } from "openzeppelin-contracts-upgradeable/contracts/token/ERC20/extensions/ERC4626Upgradeable.sol";
import { ERC20Upgradeable } from "openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControlUpgradeable } from "openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { ITawfIdentityRegistry } from "./interfaces/ITawfIdentityRegistry.sol";

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
 *      Shares are non-transferable by default, the same soulbound posture as
 *      BondReceiptNFT and for the same reason, not because ERC-4626 requires
 *      fungible shares to be transferable. An admin can open holder-to-holder
 *      transfers by setting the vault's transfer policy to VerifiedOnly, after
 *      which a transfer clears only between two currently verified holders in
 *      the wired identity registry (T-REX IdentityRegistry in production).
 */
contract PooledFinancingVault is
    Initializable,
    ERC4626Upgradeable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPS_ROLE = keccak256("OPS_ROLE");

    /// @notice Per-vault transfer policy. Soulbound (default) blocks every
    ///         holder-to-holder share move; VerifiedOnly permits it between
    ///         two verified holders.
    enum TransferPolicy {
        Soulbound,   // 0 — non-transferable (default)
        VerifiedOnly // 1 — transferable only between verified holders
    }

    ITawfIdentityRegistry public identityRegistry;

    /// @notice This vault's share transfer policy. Defaults to Soulbound (0).
    TransferPolicy public transferPolicy;

    error InvalidAddress();
    error ZeroAmount();
    error TransferBlocked();

    event IdentityRegistrySet(address identityRegistry);
    event TransferPolicySet(TransferPolicy policy);
    event RepaymentRecorded(address indexed from, uint256 amount);

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
    function initialize(IERC20 asset_, address admin) public initializer {
        if (address(asset_) == address(0) || admin == address(0)) revert InvalidAddress();
        __ERC20_init("Tawf Pooled Financing Shares", "tPFS");
        __ERC4626_init(asset_);
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    /// @dev UUPS: only UPGRADER_ROLE may point the proxy at a new implementation.
    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}

    // ---------------------------------------------------------------------
    // Admin configuration
    // ---------------------------------------------------------------------

    /// @notice Wire (or unwire, via address(0)) the identity registry that
    ///         VerifiedOnly share transfers consult.
    function setIdentityRegistry(ITawfIdentityRegistry identityRegistry_) external onlyRole(ADMIN_ROLE) {
        identityRegistry = identityRegistry_;
        emit IdentityRegistrySet(address(identityRegistry_));
    }

    /// @notice Set this vault's share transfer policy. Soulbound (default)
    ///         blocks every holder-to-holder transfer; VerifiedOnly permits
    ///         it between two currently verified holders.
    function setTransferPolicy(TransferPolicy policy) external onlyRole(ADMIN_ROLE) {
        transferPolicy = policy;
        emit TransferPolicySet(policy);
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
    ///      local transfer policy plus the wired identity registry, mirroring
    ///      BondReceiptNFT. ERC4626's own deposit/mint/withdraw/redeem all
    ///      call _update with from or to == address(0) internally, so normal
    ///      vault operations are never blocked, only a direct share-to-share
    ///      transfer is. Soulbound (default) always reverts; VerifiedOnly
    ///      requires a wired registry and both parties verified.
    function _update(address from, address to, uint256 value) internal virtual override(ERC20Upgradeable) {
        if (from != address(0) && to != address(0)) {
            if (transferPolicy != TransferPolicy.VerifiedOnly) revert TransferBlocked();
            ITawfIdentityRegistry registry = identityRegistry;
            if (address(registry) == address(0)) revert TransferBlocked();
            if (!registry.isVerified(from) || !registry.isVerified(to)) revert TransferBlocked();
        }
        super._update(from, to, value);
    }

    /// @dev AccessControl and ERC20/IERC4626 do not otherwise collide, but
    ///      ERC4626/ERC20 both implement IERC20Metadata's decimals(); no
    ///      override needed there, ERC4626 already resolves it. Only ERC165
    ///      needs resolving here, AccessControl provides it, ERC4626 does
    ///      not implement it, so no override conflict exists in practice,
    ///      this function is included for future-proofing if that changes.
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @dev Reserved storage so later versions can add state without shifting the layout.
    uint256[50] private __gap;
}
