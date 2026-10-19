// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { ITrexToken } from "../interfaces/ITrexToken.sol";
import { ILedgerAnchor } from "../sukuk/ILedgerAnchor.sol";
import { LedgerLeaf } from "../lib/LedgerLeaf.sol";

/**
 * @title DepositoReserveController
 * @notice Supply controller and proof-of-reserve registry for tokenized BPRS
 *         time deposits (deposito). Each product (one tenor at one bank) maps
 *         to a T-REX token with 2 decimals, denominated in Indonesian rupiah
 *         sen. The controller is an AGENT of each product token and mints a
 *         tokenized placement to a verified investor against a ledger-proven
 *         placement fact, then checks the product's live supply stays within
 *         the latest ledger-proven reserve.
 *
 * @dev Pragma ^0.8.24 and OZ v5, talking to T-REX tokens only through
 *      ITrexToken (which is `>=0.8.17`), so this contract never imports the
 *      0.8.17-pinned T-REX concrete Token. Holder verification is enforced on
 *      the token side by T-REX on mint, so the controller does not re-check it.
 *
 *      Every amount is shown, never told: tokenizePlacement verifies a
 *      DEPOSITO_PLACEMENT leaf and updateReserve verifies a DEPOSITO_RESERVE
 *      leaf against the LedgerAnchor. updateReserve is permissionless, the
 *      proof is the authority; tokenizePlacement is ISSUER_ROLE (Tawf), since
 *      minting to a specific investor is an operational act even though the
 *      amount itself is proven.
 */
contract DepositoReserveController is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Product {
        ITrexToken token;
        uint8 tenorMonths;
        uint16 nisbahBps; // profit-sharing ratio in basis points
        bool exists;
    }

    struct Reserve {
        uint64 snapshotAt;   // DEPOSITO_RESERVE a (snapshot ts)
        uint256 totalPlaced; // DEPOSITO_RESERVE b (total placed sen); the cap
    }

    ILedgerAnchor public immutable anchor;
    uint256 public immutable ledgerChainId;
    /// @notice Identifier of the originating institution on the ledger.
    bytes32 public immutable institutionId;

    mapping(bytes32 => Product) private _products;
    bytes32[] private _productIds;
    mapping(bytes32 => Reserve) private _reserves;
    /// @notice Placement ids already tokenized (replay guard).
    mapping(bytes32 => bool) public placementUsed;

    error InvalidAddress();
    error ProductExists(bytes32 productId);
    error UnknownProduct(bytes32 productId);
    error PlacementAlreadyUsed(bytes32 placementId);
    error ProofInvalid();
    error StaleReserve(uint64 latest, uint64 got);
    error ReserveInsufficient(uint256 supplyAfter, uint256 totalPlaced);

    event ProductAdded(bytes32 indexed productId, address token, uint8 tenorMonths, uint16 nisbahBps);
    event PlacementTokenized(
        bytes32 indexed productId, bytes32 indexed placementId, address indexed investor, uint256 nominal, uint64 maturity
    );
    event ReserveUpdated(bytes32 indexed productId, uint64 snapshotAt, uint256 totalPlaced);

    /// @param anchor_ LedgerAnchor the Tawf Network roots are anchored on.
    /// @param institutionId_ The originating institution id on the ledger.
    /// @param admin DEFAULT_ADMIN_ROLE holder (manages roles).
    /// @param issuer ISSUER_ROLE holder (Tawf ops), tokenizes placements.
    constructor(ILedgerAnchor anchor_, bytes32 institutionId_, address admin, address issuer) {
        if (address(anchor_) == address(0) || admin == address(0) || issuer == address(0)) revert InvalidAddress();
        anchor = anchor_;
        ledgerChainId = anchor_.ledgerChainId();
        institutionId = institutionId_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, issuer);
    }

    // ---------------------------------------------------------------
    // Product configuration
    // ---------------------------------------------------------------

    /// @notice Register a deposito product (one tenor) backed by `token`.
    /// @dev The controller must be an AGENT of `token` to mint placements.
    function addProduct(bytes32 productId, address token, uint8 tenorMonths, uint16 nisbahBps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (token == address(0)) revert InvalidAddress();
        if (_products[productId].exists) revert ProductExists(productId);
        _products[productId] =
            Product({ token: ITrexToken(token), tenorMonths: tenorMonths, nisbahBps: nisbahBps, exists: true });
        _productIds.push(productId);
        emit ProductAdded(productId, token, tenorMonths, nisbahBps);
    }

    // ---------------------------------------------------------------
    // Tokenize
    // ---------------------------------------------------------------

    /// @notice Tokenize a ledger-proven placement: mint `nominal` sen of the
    ///         product token to `investor`, then require the product's live
    ///         supply stays within the latest verified reserve.
    /// @dev Verifies a DEPOSITO_PLACEMENT leaf (subject placementId,
    ///      a = nominal sen, b = maturity). The placement may be tokenized
    ///      once. T-REX enforces that `investor` is a verified holder on mint.
    function tokenizePlacement(
        bytes32 productId,
        bytes32 placementId,
        uint256 nominal,
        uint64 maturity,
        uint256 epoch,
        bytes32[] calldata proof,
        address investor
    ) external onlyRole(ISSUER_ROLE) {
        Product storage product = _products[productId];
        if (!product.exists) revert UnknownProduct(productId);
        if (placementUsed[placementId]) revert PlacementAlreadyUsed(placementId);
        _requireFact(LedgerLeaf.DEPOSITO_PLACEMENT, placementId, nominal, maturity, epoch, proof);

        // Effects before the external mint.
        placementUsed[placementId] = true;

        product.token.mint(investor, nominal);

        uint256 supplyAfter = product.token.totalSupply();
        Reserve storage reserve = _reserves[productId];
        if (reserve.snapshotAt != 0 && supplyAfter > reserve.totalPlaced) {
            revert ReserveInsufficient(supplyAfter, reserve.totalPlaced);
        }

        emit PlacementTokenized(productId, placementId, investor, nominal, maturity);
    }

    // ---------------------------------------------------------------
    // Reserve
    // ---------------------------------------------------------------

    /// @notice Record a reserve snapshot for a product, proven on the ledger.
    ///         Permissionless: the proof is the authority. The snapshot must
    ///         be strictly newer than the stored one.
    /// @dev Verifies a DEPOSITO_RESERVE leaf (subject productId,
    ///      a = snapshot ts, b = total placed sen).
    function updateReserve(bytes32 productId, uint64 snapshotAt, uint256 totalPlaced, uint256 epoch, bytes32[] calldata proof)
        external
    {
        if (!_products[productId].exists) revert UnknownProduct(productId);
        Reserve storage reserve = _reserves[productId];
        if (snapshotAt == 0 || (reserve.snapshotAt != 0 && snapshotAt <= reserve.snapshotAt)) {
            revert StaleReserve(reserve.snapshotAt, snapshotAt);
        }
        _requireFact(LedgerLeaf.DEPOSITO_RESERVE, productId, snapshotAt, totalPlaced, epoch, proof);
        reserve.snapshotAt = snapshotAt;
        reserve.totalPlaced = totalPlaced;
        emit ReserveUpdated(productId, snapshotAt, totalPlaced);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    /// @notice Latest verified total-placed reserve for `productId` (sen).
    function reserveOf(bytes32 productId) external view returns (uint256) {
        return _reserves[productId].totalPlaced;
    }

    /// @notice Ratio of reserve backing to live supply, in basis points.
    /// @dev Returns 10000 (100%) when supply is zero.
    function reserveRatioBps(bytes32 productId) external view returns (uint256) {
        Product storage product = _products[productId];
        if (!product.exists) revert UnknownProduct(productId);
        uint256 supply = product.token.totalSupply();
        if (supply == 0) return 10_000;
        return (_reserves[productId].totalPlaced * 10_000) / supply;
    }

    /// @notice Whether the product's live supply is within its verified reserve.
    function isFullyBacked(bytes32 productId) external view returns (bool) {
        Product storage product = _products[productId];
        if (!product.exists) revert UnknownProduct(productId);
        return product.token.totalSupply() <= _reserves[productId].totalPlaced;
    }

    /// @notice Full product record.
    function getProduct(bytes32 productId) external view returns (Product memory) {
        if (!_products[productId].exists) revert UnknownProduct(productId);
        return _products[productId];
    }

    /// @notice All registered product ids.
    function products() external view returns (bytes32[] memory) {
        return _productIds;
    }

    /// @notice Latest reserve snapshot timestamp for `productId`.
    function reserveSnapshotAt(bytes32 productId) external view returns (uint64) {
        return _reserves[productId].snapshotAt;
    }

    // ---------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------

    function _requireFact(bytes32 kind, bytes32 subjectId, uint256 a, uint256 b, uint256 epoch, bytes32[] calldata proof)
        private
        view
    {
        if (!anchor.verify(epoch, LedgerLeaf.hash(ledgerChainId, kind, subjectId, a, b), proof)) revert ProofInvalid();
    }
}
