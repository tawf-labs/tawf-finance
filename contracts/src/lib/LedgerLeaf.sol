// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17;

/**
 * @title LedgerLeaf
 * @notice Canonical encoding of a tawf-network LedgerLeaf and the set of leaf
 *         kinds the on-chain tokenization contracts verify against the
 *         LedgerAnchor.
 *
 * @dev The encoding is identical to tawf-network's
 *      `contracts/src/common/LedgerLeaf.sol` and to the original
 *      `SukukDistributor.leafHash`: a double keccak256 over the ABI encoding
 *      of `(ledgerChainId, kind, subjectId, a, b)`. Both repos assert the
 *      same golden vectors in their tests so the roots produced off-chain on
 *      the Tawf Network ledger prove here without re-derivation.
 *
 *      A leaf is `(kind, subjectId, a, b)`. `kind` names the fact,
 *      `subjectId` names what the fact is about, and `a`/`b` carry the two
 *      numeric fields that fact needs. The meaning of `a` and `b` is fixed
 *      per kind and documented beside each constant below. Kinds are the
 *      keccak256 of a dotted string, and those exact strings must match
 *      tawf-network's LedgerLeaf.
 */
library LedgerLeaf {
    // ---------------------------------------------------------------------
    // Sukuk leaf kinds (subjectId = sukukId)
    // ---------------------------------------------------------------------

    /// @notice DPS approved the issuance. a = faceValue, b = maturity.
    bytes32 internal constant SUKUK_APPROVED = keccak256("tawf.sukuk.approved");
    /// @notice Periodic profit declared. a = period, b = amount.
    bytes32 internal constant SUKUK_DISTRIBUTION = keccak256("tawf.sukuk.distribution");
    /// @notice Redemption at maturity declared. a = amount, b = 0.
    bytes32 internal constant SUKUK_REDEMPTION = keccak256("tawf.sukuk.redemption");
    /// @notice Default recovery declared. a = recovery, b = 0.
    bytes32 internal constant SUKUK_DEFAULT = keccak256("tawf.sukuk.default");
    /// @notice Reserve snapshot. subject sukukId, a = snapshot ts,
    ///         b = outstanding.
    bytes32 internal constant SUKUK_RESERVE = keccak256("tawf.sukuk.reserve");
    /// @notice A Shariah-board release of profit held at a flagged maturity.
    ///         subject sukukId, a = amount released, b = release index (1, 2, ...).
    bytes32 internal constant SUKUK_PROFIT_RESOLUTION = keccak256("tawf.sukuk.profit-resolution");
    /// @notice The Shariah board's approved destination for released profit
    ///         left unclaimed. subject sukukId, a = uint160(destination), b = 0.
    bytes32 internal constant SUKUK_SWEEP_DESTINATION = keccak256("tawf.sukuk.sweep-destination");

    // ---------------------------------------------------------------------
    // Deposito leaf kinds
    // ---------------------------------------------------------------------

    /// @notice A placement was tokenized. subject placementId,
    ///         a = nominal IDR sen, b = maturity.
    bytes32 internal constant DEPOSITO_PLACEMENT = keccak256("tawf.deposito.placement");
    /// @notice Reserve snapshot for a product. subject productId,
    ///         a = snapshot ts, b = total placed sen.
    bytes32 internal constant DEPOSITO_RESERVE = keccak256("tawf.deposito.reserve");
    /// @notice Profit credited for a Tawf deposito series period. subject
    ///         seriesId, a = period, b = profit sen.
    bytes32 internal constant DEPOSITO_PROFIT = keccak256("tawf.deposito.profit");
    /// @notice Series maturity: principal returned. subject seriesId,
    ///         a = packMaturity(maturity ts, last profit period), b = principal sen.
    bytes32 internal constant DEPOSITO_MATURITY = keccak256("tawf.deposito.maturity");
    /// @notice One bank's share of a regional Deposito Pool reserve snapshot.
    ///         subject bankId, a = snapshot ts, b = Tawf's balance at that bank in sen.
    bytes32 internal constant DEPOSITO_BANK_BALANCE = keccak256("tawf.deposito.bank-balance");

    /// @notice `a` of a DEPOSITO_MATURITY leaf, identical to tawf-network's
    ///         LedgerLeaf.packMaturity: the last profit period above bit 64,
    ///         the maturity timestamp in the low 64 bits.
    function packMaturity(uint64 at, uint32 finalPeriod) internal pure returns (uint256) {
        return (uint256(finalPeriod) << 64) | uint256(at);
    }

    /**
     * @notice Encode a ledger leaf exactly as tawf-network's LedgerLeaf.hash.
     * @param ledgerChainId The chain id of the Tawf Network ledger the roots
     *        come from (not necessarily this chain's id).
     * @param kind One of the leaf-kind constants above.
     * @param subjectId The subject the fact is about (sukukId, productId,
     *        placementId, ...).
     * @param a First numeric field; meaning fixed per kind.
     * @param b Second numeric field; meaning fixed per kind.
     * @return The leaf hash to verify against an anchored Merkle root.
     */
    function hash(uint256 ledgerChainId, bytes32 kind, bytes32 subjectId, uint256 a, uint256 b)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(bytes.concat(keccak256(abi.encode(ledgerChainId, kind, subjectId, a, b))));
    }
}
