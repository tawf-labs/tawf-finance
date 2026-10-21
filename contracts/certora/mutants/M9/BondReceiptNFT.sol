// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { ERC1155 } from "openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol";
import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { Strings } from "openzeppelin-contracts/contracts/utils/Strings.sol";
import { ITawfIdentityRegistry } from "../../../src/interfaces/ITawfIdentityRegistry.sol";

/// @notice The slice of DealRegistry a receipt transfer needs.
interface IDealPrincipalLedger {
    function moveInvestorPrincipal(uint256 id, address from, address to) external;
}

/**
 * @title BondReceiptNFT
 * @notice Soulbound ERC-1155 receipts for BPRS financing sell-down pools.
 *
 * @dev Every investment mints exactly one non-transferable receipt token
 *      (token id == deal id). Receipts can never be transferred, sold, or
 *      approved — they are burned on redemption. Metadata is stored
 *      on-chain (no external metadata service), so each receipt is a
 *      self-contained, tamper-proof record of a real-world deal.
 *
 *      Sharia framing: non-transferability (no secondary market, no maysir),
 *      one receipt per real invoice (no gharar), returns from real trade
 *      only (no riba).
 *
 *      Transfer policy: Soulbound is the default for every dealId. Mint
 *      (from == address(0)) and burn (to == address(0)) are always allowed.
 *      A holder-to-holder transfer only succeeds when an admin has set that
 *      dealId's policy to VerifiedOnly AND an identity registry is wired AND
 *      both parties are currently verified there. This replaces the former
 *      external Compliance module with a local per-id policy plus the shared
 *      T-REX IdentityRegistry, read through ITawfIdentityRegistry.isVerified,
 *      so flipping a pool's policy never requires a redeploy.
 */
contract BondReceiptNFT is ERC1155, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Per-dealId transfer policy. Soulbound (default) blocks every
    ///         holder-to-holder move; VerifiedOnly permits it between two
    ///         currently verified holders.
    enum TransferPolicy {
        Soulbound,   // 0 — non-transferable (default)
        VerifiedOnly // 1 — transferable only between verified holders
    }
    enum ReceiptStatus {
        Active,      // 0 — minted and live (default)
        Matured,     // 1 — deal repaid; derived from deal snapshot
        Redeemed,    // 2 — principal + yield claimed; receipt burned
        Defaulted    // 3 — deal defaulted; principal-only claim
    }

    struct ReceiptMeta {
        uint96 principal;      // invested amount (USDC base units)
        uint96 apyBps;         // annualized yield in basis points
        uint32 durationDays;
        ReceiptStatus status;  // terminal flags only; otherwise derived
        uint256 mintedAt;
    }

    struct DealSnapshot {
        bool matured;          // deal has been repaid
        bool defaulted;        // deal defaulted
        uint96 yieldPool;      // total profit to distribute (USDC base units)
        uint96 totalFunded;    // snapshot of deal.totalFunded at maturity
        uint256 maturedAt;
    }

    /// @notice The vault authorized to mint, mature, and burn receipts.
    address public vault;

    /// @notice Shared identity registry (T-REX IdentityRegistry in
    ///         production) consulted for VerifiedOnly transfers. Unset
    ///         (address(0)) means no transfer can clear the verification
    ///         check, so every dealId stays effectively soulbound regardless
    ///         of its policy.
    ITawfIdentityRegistry public identityRegistry;

    /// @notice DealRegistry, told when a receipt changes hands so its
    ///         per-investor principal follows the receipt. A VerifiedOnly
    ///         transfer is blocked until this is set.
    IDealPrincipalLedger public dealRegistry;

    /// @notice Per-dealId transfer policy. Defaults to Soulbound (0).
    mapping(uint256 => TransferPolicy) public transferPolicy;

    mapping(uint256 => mapping(address => ReceiptMeta)) private _receipts;
    mapping(uint256 => DealSnapshot) private _dealSnapshots;
    mapping(uint256 => string) private _dealSupplier;
    mapping(uint256 => string) private _dealAnchorBuyer;
    mapping(uint256 => uint256) private _mintedCount;
    mapping(uint256 => uint256) private _burnedCount;

    error NotVault();
    error InvalidVaultAddress();
    error NotInvestor(uint256 dealId, address investor);
    error AlreadyRedeemed(uint256 dealId, address investor);
    error Soulbound();
    error TransferBlocked();
    error ReceiptTransferInvalid(uint256 dealId, address from, address to);
    error ReceiptAlreadyRedeemed(uint256 dealId, address investor);
    error NotVerified(address investor);
    error DealAlreadyMatured(uint256 dealId);
    error ZeroTotalFunded(uint256 dealId);

    event ReceiptMinted(uint256 indexed dealId, address indexed investor, uint96 principal);
    event ReceiptBurned(uint256 indexed dealId, address indexed investor);
    event DealMatured(uint256 indexed dealId, uint96 yieldPool, uint96 totalFunded);
    event DealDefaulted(uint256 indexed dealId);
    event IdentityRegistrySet(address identityRegistry);
    event TransferPolicySet(uint256 indexed dealId, TransferPolicy policy);
    event DealRegistrySet(address dealRegistry);
    event ReceiptMoved(uint256 indexed dealId, address indexed from, address indexed to, uint96 principal);

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    constructor(address admin) ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Admin configuration
    // ---------------------------------------------------------------------

    function setVault(address vault_) external onlyRole(ADMIN_ROLE) {
        if (vault_ == address(0)) revert InvalidVaultAddress();
        vault = vault_;
    }

    /// @notice Wire (or unwire, via address(0)) the identity registry that
    ///         VerifiedOnly transfers consult. See `_update`.
    /// @notice Wire the DealRegistry that VerifiedOnly transfers keep in step.
    function setDealRegistry(IDealPrincipalLedger dealRegistry_) external onlyRole(ADMIN_ROLE) {
        dealRegistry = dealRegistry_;
        emit DealRegistrySet(address(dealRegistry_));
    }

    function setIdentityRegistry(ITawfIdentityRegistry identityRegistry_) external onlyRole(ADMIN_ROLE) {
        identityRegistry = identityRegistry_;
        emit IdentityRegistrySet(address(identityRegistry_));
    }

    /// @notice Set the transfer policy for one dealId. Soulbound (default)
    ///         blocks every holder-to-holder transfer; VerifiedOnly permits
    ///         it between two currently verified holders. Held by whoever is
    ///         authorized to flip a pool's status per its akad, not by the
    ///         investors.
    function setTransferPolicy(uint256 dealId, TransferPolicy policy) external onlyRole(ADMIN_ROLE) {
        transferPolicy[dealId] = policy;
        emit TransferPolicySet(dealId, policy);
    }

    // ---------------------------------------------------------------------
    // Minting (vault only)
    // ---------------------------------------------------------------------

    /**
     * @notice Mint one soulbound receipt for `investor` against `dealId`.
     * @dev Called by the RedemptionVault after USDC has been pulled in.
     */
    function mint(
        address investor,
        uint256 dealId,
        uint96 principal,
        uint96 apyBps,
        uint32 durationDays,
        string calldata supplierName,
        string calldata anchorBuyer
    ) external onlyVault {
        // KYC gate for every investment, including a top-up (which mints no
        // token and so never reaches the check in `_update`).
        ITawfIdentityRegistry registry = identityRegistry;
        if (address(registry) != address(0) && !registry.isVerified(investor)) revert NotVerified(investor);

        ReceiptMeta storage receipt = _receipts[dealId][investor];

        // A repeat investment in the same deal tops up the existing receipt:
        // the principal accumulates (matching DealRegistry.investorPrincipal)
        // and no second token is minted, so one burn retires the receipt.
        if (receipt.principal != 0) {
            // A redeemed receipt is closed; topping it up would strand the money.
            if (receipt.status == ReceiptStatus.Redeemed) revert ReceiptAlreadyRedeemed(dealId, investor);
            receipt.principal += principal;
            emit ReceiptMinted(dealId, investor, principal);
            return;
        }

        _mintedCount[dealId] += 1;
        _receipts[dealId][investor] = ReceiptMeta({
            principal: principal,
            apyBps: apyBps,
            durationDays: durationDays,
            status: ReceiptStatus.Active,
            mintedAt: block.timestamp
        });

        _dealSupplier[dealId] = supplierName;
        _dealAnchorBuyer[dealId] = anchorBuyer;

        _mint(investor, dealId, 1, "");

        emit ReceiptMinted(dealId, investor, principal);
    }

    // ---------------------------------------------------------------------
    // Deal lifecycle snapshots (vault only)
    // ---------------------------------------------------------------------

    /**
     * @notice Record that a deal was repaid. The vault calls this after
     *         receiving repayment; `yieldPool` is the profit shared pro-rata.
     */
    function markDealMatured(
        uint256 dealId,
        uint96 yieldPool,
        uint96 totalFunded
    ) external onlyVault {
        if (totalFunded == 0) revert ZeroTotalFunded(dealId);
        DealSnapshot storage snap = _dealSnapshots[dealId];
        if (snap.matured) revert DealAlreadyMatured(dealId);
        snap.matured = true;
        snap.yieldPool = yieldPool;
        snap.totalFunded = totalFunded;
        snap.maturedAt = block.timestamp;
        emit DealMatured(dealId, yieldPool, totalFunded);
    }

    /// @notice Record that a deal defaulted (principal-only return).
    /// @dev Idempotent — a deal can be flagged once by the first claim; later
    ///      claims must not revert.
    function markDealDefaulted(uint256 dealId) external onlyVault {
        DealSnapshot storage snap = _dealSnapshots[dealId];
        if (snap.defaulted) return;
        snap.defaulted = true;
        emit DealDefaulted(dealId);
    }

    // ---------------------------------------------------------------------
    // Redemption (vault only)
    // ---------------------------------------------------------------------

    /**
     * @notice Burn a receipt after the investor's principal + yield have
     *         been paid out by the vault.
     */
    function burnOnRedemption(uint256 dealId, address investor) external onlyVault {
        if (_receipts[dealId][investor].principal == 0) {
            revert NotInvestor(dealId, investor);
        }
        if (_receipts[dealId][investor].status == ReceiptStatus.Redeemed) {
            revert AlreadyRedeemed(dealId, investor);
        }

        _receipts[dealId][investor].status = ReceiptStatus.Redeemed;
        _burnedCount[dealId] += 1;
        _burn(investor, dealId, 1);

        emit ReceiptBurned(dealId, investor);
    }

    /// @notice Mark a receipt as defaulted after a principal-only claim.
    function markReceiptDefaulted(uint256 dealId, address investor) external onlyVault {
        if (_receipts[dealId][investor].principal == 0) {
            revert NotInvestor(dealId, investor);
        }
        if (_receipts[dealId][investor].status == ReceiptStatus.Defaulted) {
            return; // idempotent
        }
        _receipts[dealId][investor].status = ReceiptStatus.Defaulted;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Full receipt metadata for one investor against one deal.
    function getReceiptMeta(
        uint256 dealId,
        address investor
    ) public view returns (ReceiptMeta memory meta) {
        meta = _receipts[dealId][investor];
        if (meta.principal == 0) return meta;
        // Derive non-terminal status from the deal snapshot.
        if (meta.status == ReceiptStatus.Redeemed || meta.status == ReceiptStatus.Defaulted) {
            return meta;
        }
        DealSnapshot storage snap = _dealSnapshots[dealId];
        if (snap.defaulted) meta.status = ReceiptStatus.Defaulted;
        else if (snap.matured) meta.status = ReceiptStatus.Matured;
        return meta;
    }

    function getDealSnapshot(uint256 dealId) public view returns (DealSnapshot memory) {
        return _dealSnapshots[dealId];
    }

    function mintedCount(uint256 dealId) public view returns (uint256) {
        return _mintedCount[dealId];
    }

    function burnedCount(uint256 dealId) public view returns (uint256) {
        return _burnedCount[dealId];
    }

    /// @notice Whether all receipts for a deal have been burned.
    function isFullyRedeemed(uint256 dealId) external view returns (bool) {
        return _mintedCount[dealId] > 0 && _mintedCount[dealId] == _burnedCount[dealId];
    }

    /**
     * @notice Assemble the token metadata as on-chain JSON (ERC-1155 uri()).
     * @dev No external metadata service — the receipt is self-contained.
     */
    function uri(uint256 dealId) public view virtual override returns (string memory) {
        DealSnapshot storage snap = _dealSnapshots[dealId];
        string memory status = "active";
        if (snap.defaulted) status = "defaulted";
        else if (snap.matured) status = "matured";

        return string.concat(
            "data:application/json;base64,",
            _encodeBase64(
                abi.encodePacked(
                    '{"name":"Tawf BPRS Financing Receipt #',
                    Strings.toString(dealId),
                    '","description":"Soulbound receipt - exposure to one BPRS financing sell-down pool. Non-transferable.","attributes":[{',
                    '"trait_type":"supplier","value":"',
                    _dealSupplier[dealId],
                    '"},{"trait_type":"anchor_buyer","value":"',
                    _dealAnchorBuyer[dealId],
                    '"},{"trait_type":"status","value":"',
                    status,
                    '"}],"image":""}'
                )
            )
        );
    }

    // ---------------------------------------------------------------------
    // Soulbound enforcement
    // ---------------------------------------------------------------------

    /**
     * @notice Minting (from == address(0)) and burning (to == address(0))
     *         are always allowed. Any other transfer is soulbound by
     *         default; it clears only when the dealId's policy is
     *         VerifiedOnly, an identity registry is wired, and both `from`
     *         and `to` are currently verified there. A blocked transfer
     *         reverts Soulbound when the policy itself forbids it (default),
     *         and TransferBlocked when the policy allows transfers in
     *         principle but a party is not verified.
     *
     *         A cleared transfer moves the whole receipt: exactly one token,
     *         to a holder with no receipt in that deal, carrying principal and
     *         status, and DealRegistry's investorPrincipal moves with it. So
     *         whoever holds the token is the one who can redeem.
     *
     *         Once an identity registry is wired, a mint also requires the
     *         recipient to be verified there, so only KYC'd investors can
     *         fund a pool. With no registry wired, minting is open.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override {
        if (from == address(0)) {
            ITawfIdentityRegistry registry = identityRegistry;
            if (address(registry) != address(0) && !registry.isVerified(to)) revert NotVerified(to);
        } else if (to != address(0)) {
            ITawfIdentityRegistry registry = identityRegistry;
            for (uint256 i = 0; i < ids.length; i++) {
                if (transferPolicy[ids[i]] != TransferPolicy.VerifiedOnly) revert Soulbound();
                if (address(registry) == address(0)) revert TransferBlocked();
                if (!registry.isVerified(from) || !registry.isVerified(to)) revert TransferBlocked();
                _moveReceipt(ids[i], values[i], from, to);
            }
        }
        super._update(from, to, ids, values);
    }

    function _moveReceipt(uint256 dealId, uint256 value, address from, address to) private {
        ReceiptMeta memory receipt = _receipts[dealId][from];
        if (
            value != 1 || address(dealRegistry) == address(0) || receipt.principal == 0
                || receipt.status == ReceiptStatus.Redeemed || _receipts[dealId][to].principal != 0
        ) revert ReceiptTransferInvalid(dealId, from, to);

        _receipts[dealId][to] = receipt;
        delete _receipts[dealId][from];
        // MUTANT M9: skip dealRegistry.moveInvestorPrincipal, so the registry principal stays with `from`.
        emit ReceiptMoved(dealId, from, to, receipt.principal);
    }

    /// @notice No operator approvals. Direct owner-initiated transfers are
    ///         the only path a VerifiedOnly policy opens up (see `_update`);
    ///         operator-based marketplace settlement is out of scope here.
    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    /// @dev AccessControl and ERC1155 both implement ERC165; resolve the
    ///      diamond explicitly.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    /// @dev '=' padding byte for base64. Single-char string to bytes1 cannot
    ///      truncate.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes1 private constant PAD = bytes1("=");

    function _encodeBase64(bytes memory data) internal pure returns (string memory) {
        bytes memory alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        if (data.length == 0) return "";
        string memory out = new string(4 * ((data.length + 2) / 3));
        uint256 outIdx = 0;
        for (uint256 i = 0; i < data.length; i += 3) {
            uint256 remaining = data.length - i;
            uint256 n = uint256(uint8(data[i])) << 16;
            if (remaining > 1) n |= uint256(uint8(data[i + 1])) << 8;
            if (remaining > 2) n |= uint256(uint8(data[i + 2]));
            bytes memory chunk = bytes(out);
            chunk[outIdx++] = alphabet[(n >> 18) & 63];
            chunk[outIdx++] = alphabet[(n >> 12) & 63];
            chunk[outIdx++] = remaining > 1 ? alphabet[(n >> 6) & 63] : PAD;
            chunk[outIdx++] = remaining > 2 ? alphabet[n & 63] : PAD;
            out = string(chunk);
        }
        return out;
    }
}
