// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title IdentityRegistry
 * @notice Minimal ERC-3643-style identity registry: a shared whitelist of
 *         eligible investors, reused by every token that gates transfers
 *         through a Compliance module (BondReceiptNFT, PooledFinancingVault,
 *         and any future instrument, gold-tokenization included).
 *
 * @dev This is deliberately thin. It records that an address has cleared
 *      KYC/KYB off-chain (Tawf's Didit integration, or a BPRS's own KYC per
 *      the Moria-style eligibility-bridge pattern), plus two policy-relevant
 *      facts the secondary-market.md §4.1 compliance flow needs: a
 *      jurisdiction code and an optional lockup expiry. It does not itself
 *      decide whether a transfer is allowed, that is Compliance's job.
 */
contract IdentityRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct Identity {
        bool verified;
        uint16 jurisdiction; // ISO 3166-1 numeric country code, 0 = unset
        uint40 lockupUntil;  // unix timestamp; 0 = no lockup
    }

    mapping(address => Identity) private _identities;

    error InvalidAddress();

    event IdentityRegistered(address indexed investor, uint16 jurisdiction, uint40 lockupUntil);
    event IdentityRevoked(address indexed investor);

    /// @param admin Address (an EOA for local dev, a Safe multisig in
    ///        production) granted DEFAULT_ADMIN_ROLE and REGISTRAR_ROLE.
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    /// @notice Register or update an investor's identity record.
    function registerIdentity(
        address investor,
        uint16 jurisdiction,
        uint40 lockupUntil
    ) external onlyRole(REGISTRAR_ROLE) {
        if (investor == address(0)) revert InvalidAddress();
        _identities[investor] = Identity({ verified: true, jurisdiction: jurisdiction, lockupUntil: lockupUntil });
        emit IdentityRegistered(investor, jurisdiction, lockupUntil);
    }

    /// @notice Revoke an investor's eligibility (KYC expired, sanctions hit,
    ///         and so on). Does not delete the record, only unverifies it.
    function revokeIdentity(address investor) external onlyRole(REGISTRAR_ROLE) {
        _identities[investor].verified = false;
        emit IdentityRevoked(investor);
    }

    /// @notice Whether `investor` is currently eligible to receive a
    ///         transfer: verified and past any lockup.
    function isEligible(address investor) external view returns (bool) {
        Identity memory id = _identities[investor];
        return id.verified && block.timestamp >= id.lockupUntil;
    }

    function identityOf(address investor) external view returns (Identity memory) {
        return _identities[investor];
    }
}
