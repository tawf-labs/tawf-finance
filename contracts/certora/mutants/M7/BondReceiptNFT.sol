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
 * @dev Mutated copy of src/BondReceiptNFT.sol. See that file for full docs.
 */
contract BondReceiptNFT is ERC1155, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum TransferPolicy {
        Soulbound,   // 0
        VerifiedOnly // 1
    }
    enum ReceiptStatus {
        Active,      // 0
        Matured,     // 1
        Redeemed,    // 2
        Defaulted    // 3
    }

    struct ReceiptMeta {
        uint96 principal;
        uint96 apyBps;
        uint32 durationDays;
        ReceiptStatus status;
        uint256 mintedAt;
    }

    struct DealSnapshot {
        bool matured;
        bool defaulted;
        uint96 yieldPool;
        uint96 totalFunded;
        uint256 maturedAt;
    }

    address public vault;
    ITawfIdentityRegistry public identityRegistry;
    IDealPrincipalLedger public dealRegistry;

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

    function setVault(address vault_) external onlyRole(ADMIN_ROLE) {
        if (vault_ == address(0)) revert InvalidVaultAddress();
        vault = vault_;
    }

    function setDealRegistry(IDealPrincipalLedger dealRegistry_) external onlyRole(ADMIN_ROLE) {
        dealRegistry = dealRegistry_;
        emit DealRegistrySet(address(dealRegistry_));
    }

    function setIdentityRegistry(ITawfIdentityRegistry identityRegistry_) external onlyRole(ADMIN_ROLE) {
        identityRegistry = identityRegistry_;
        emit IdentityRegistrySet(address(identityRegistry_));
    }

    function setTransferPolicy(uint256 dealId, TransferPolicy policy) external onlyRole(ADMIN_ROLE) {
        transferPolicy[dealId] = policy;
        emit TransferPolicySet(dealId, policy);
    }

    function mint(
        address investor,
        uint256 dealId,
        uint96 principal,
        uint96 apyBps,
        uint32 durationDays,
        string calldata supplierName,
        string calldata anchorBuyer
    ) external onlyVault {
        ITawfIdentityRegistry registry = identityRegistry;
        if (address(registry) != address(0) && !registry.isVerified(investor)) revert NotVerified(investor);

        ReceiptMeta storage receipt = _receipts[dealId][investor];

        if (receipt.principal != 0) {
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

    function markDealDefaulted(uint256 dealId) external onlyVault {
        DealSnapshot storage snap = _dealSnapshots[dealId];
        if (snap.defaulted) return;
        snap.defaulted = true;
        emit DealDefaulted(dealId);
    }

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

    function markReceiptDefaulted(uint256 dealId, address investor) external onlyVault {
        if (_receipts[dealId][investor].principal == 0) {
            revert NotInvestor(dealId, investor);
        }
        if (_receipts[dealId][investor].status == ReceiptStatus.Defaulted) {
            return;
        }
        _receipts[dealId][investor].status = ReceiptStatus.Defaulted;
    }

    function getReceiptMeta(
        uint256 dealId,
        address investor
    ) public view returns (ReceiptMeta memory meta) {
        meta = _receipts[dealId][investor];
        if (meta.principal == 0) return meta;
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

    function isFullyRedeemed(uint256 dealId) external view returns (bool) {
        return _mintedCount[dealId] > 0 && _mintedCount[dealId] == _burnedCount[dealId];
    }

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
                // MUTANT M7: dropped the `transferPolicy != VerifiedOnly ->
                // revert Soulbound()` guard, so a Soulbound-policy receipt can
                // move between two verified holders.
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
        dealRegistry.moveInvestorPrincipal(dealId, from, to);
        emit ReceiptMoved(dealId, from, to, receipt.principal);
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

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
