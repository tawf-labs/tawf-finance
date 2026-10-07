// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { ERC1155 } from "openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol";
import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { Strings } from "openzeppelin-contracts/contracts/utils/Strings.sol";
import { Compliance } from "./Compliance.sol";

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
 *      Transfer policy: soulbound is the default and, with no Compliance
 *      module wired, the only possible state (see `_update`). Once a
 *      Compliance module is set, whether a given dealId may transfer is
 *      delegated to it (secondary-market.md phase 2/3), so flipping a pool's
 *      policy never requires a redeploy of this contract.
 */
contract BondReceiptNFT is ERC1155, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
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

    /// @notice Optional ERC-3643-style compliance module. Unset (address(0))
    ///         means every non-mint/burn transfer reverts, the original
    ///         hardcoded soulbound behavior.
    Compliance public compliance;

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
    error DealAlreadyMatured(uint256 dealId);
    error ZeroTotalFunded(uint256 dealId);

    event ReceiptMinted(uint256 indexed dealId, address indexed investor, uint96 principal);
    event ReceiptBurned(uint256 indexed dealId, address indexed investor);
    event DealMatured(uint256 indexed dealId, uint96 yieldPool, uint96 totalFunded);
    event DealDefaulted(uint256 indexed dealId);

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

    /// @notice Wire (or unwire, via address(0)) the compliance module that
    ///         gates non-mint/burn transfers. See `_update`.
    function setCompliance(Compliance compliance_) external onlyRole(ADMIN_ROLE) {
        compliance = compliance_;
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
        if (_receipts[dealId][investor].principal == 0) {
            _mintedCount[dealId] += 1;
        }

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
    ) external view returns (ReceiptMeta memory meta) {
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

    function getDealSnapshot(uint256 dealId) external view returns (DealSnapshot memory) {
        return _dealSnapshots[dealId];
    }

    function mintedCount(uint256 dealId) external view returns (uint256) {
        return _mintedCount[dealId];
    }

    function burnedCount(uint256 dealId) external view returns (uint256) {
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
     *         default; if a Compliance module is wired, each token id in
     *         the batch is checked against that dealId's transfer policy
     *         instead of an unconditional revert.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override {
        if (from != address(0) && to != address(0)) {
            if (address(compliance) == address(0)) revert Soulbound();
            for (uint256 i = 0; i < ids.length; i++) {
                if (!compliance.canTransfer(address(this), ids[i], from, to)) {
                    revert Soulbound();
                }
            }
        }
        super._update(from, to, ids, values);
    }

    /// @notice No operator approvals. Direct owner-initiated transfers are
    ///         the only path a Transferable/Conditional policy opens up
    ///         (see `_update`); operator-based marketplace settlement is
    ///         secondary-market.md phase 2/3, out of scope here.
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
