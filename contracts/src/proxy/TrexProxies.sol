// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { TREXImplementationAuthority } from
    "@erc3643org/erc-3643/contracts/proxy/authority/TREXImplementationAuthority.sol";
import { ITREXImplementationAuthority } from
    "@erc3643org/erc-3643/contracts/proxy/authority/ITREXImplementationAuthority.sol";
import { ClaimTopicsRegistryProxy } from "@erc3643org/erc-3643/contracts/proxy/ClaimTopicsRegistryProxy.sol";
import { TrustedIssuersRegistryProxy } from "@erc3643org/erc-3643/contracts/proxy/TrustedIssuersRegistryProxy.sol";
import { IdentityRegistryStorageProxy } from "@erc3643org/erc-3643/contracts/proxy/IdentityRegistryStorageProxy.sol";
import { IdentityRegistryProxy } from "@erc3643org/erc-3643/contracts/proxy/IdentityRegistryProxy.sol";
import { ModularComplianceProxy } from "@erc3643org/erc-3643/contracts/proxy/ModularComplianceProxy.sol";
import { TokenProxy } from "@erc3643org/erc-3643/contracts/proxy/TokenProxy.sol";
import { ClaimTopicsRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/ClaimTopicsRegistry.sol";
import { TrustedIssuersRegistry } from
    "@erc3643org/erc-3643/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import { IdentityRegistryStorage } from
    "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistryStorage.sol";
import { IdentityRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";
import { ModularCompliance } from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import { Token } from "@erc3643org/erc-3643/contracts/token/Token.sol";

/// @dev Logic contracts whose constructor disables initialisation, so nobody can call `init` on a
///      bare implementation and own it. The proxies keep their own storage and are unaffected.
contract LockedToken is Token {
    constructor() {
        _disableInitializers();
    }
}

contract LockedClaimTopicsRegistry is ClaimTopicsRegistry {
    constructor() {
        _disableInitializers();
    }
}

contract LockedTrustedIssuersRegistry is TrustedIssuersRegistry {
    constructor() {
        _disableInitializers();
    }
}

contract LockedIdentityRegistryStorage is IdentityRegistryStorage {
    constructor() {
        _disableInitializers();
    }
}

contract LockedIdentityRegistry is IdentityRegistry {
    constructor() {
        _disableInitializers();
    }
}

contract LockedModularCompliance is ModularCompliance {
    constructor() {
        _disableInitializers();
    }
}

/**
 * @title TrexProxies
 * @notice Deploys the T-REX suite behind the T-REX proxies and a
 *         TREXImplementationAuthority, the T-REX way to make it upgradeable.
 *         Every proxy reads its logic from the authority, so one `useTREXVersion`
 *         by the authority owner upgrades every proxy bound to it.
 *
 *         Pinned to 0.8.17 like the T-REX code. Internal functions only.
 *
 *         Never call `renounceOwnership` on the authority (it would freeze upgrades; the
 *         T-REX Ownable has no two-step transfer, so check the new owner before
 *         `transferOwnership`).
 *
 *         Ownership: the caller becomes the authority owner and the owner of
 *         every proxy (the proxy constructors delegatecall `init`, which sets
 *         the caller as owner). A deploy script hands the authority to the
 *         timelock with `authority.transferOwnership(timelock)`, which makes
 *         the timelock the only party able to add and switch versions. The
 *         per-contract owners (registries, compliance, token) stay with the
 *         operator for day-to-day configuration.
 */
library TrexProxies {
    /// @dev Deploy one implementation of each T-REX contract and a reference
    ///      authority that serves them as version 1.0.0. The caller owns it.
    function authority() internal returns (TREXImplementationAuthority ia) {
        ia = new TREXImplementationAuthority(true, address(0), address(0));
        ia.addAndUseTREXVersion(
            ITREXImplementationAuthority.Version({ major: 1, minor: 0, patch: 0 }), implementations()
        );
    }

    /// @dev Fresh implementations of the six T-REX logic contracts.
    function implementations() internal returns (ITREXImplementationAuthority.TREXContracts memory c) {
        c.tokenImplementation = address(new LockedToken());
        c.ctrImplementation = address(new LockedClaimTopicsRegistry());
        c.irImplementation = address(new LockedIdentityRegistry());
        c.irsImplementation = address(new LockedIdentityRegistryStorage());
        c.tirImplementation = address(new LockedTrustedIssuersRegistry());
        c.mcImplementation = address(new LockedModularCompliance());
    }

    function claimTopicsRegistry(address ia) internal returns (ClaimTopicsRegistry) {
        return ClaimTopicsRegistry(address(new ClaimTopicsRegistryProxy(ia)));
    }

    function trustedIssuersRegistry(address ia) internal returns (TrustedIssuersRegistry) {
        return TrustedIssuersRegistry(address(new TrustedIssuersRegistryProxy(ia)));
    }

    function identityRegistryStorage(address ia) internal returns (IdentityRegistryStorage) {
        return IdentityRegistryStorage(address(new IdentityRegistryStorageProxy(ia)));
    }

    function identityRegistry(address ia, address tir, address ctr, address irs) internal returns (IdentityRegistry) {
        return IdentityRegistry(address(new IdentityRegistryProxy(ia, tir, ctr, irs)));
    }

    function modularCompliance(address ia) internal returns (ModularCompliance) {
        return ModularCompliance(address(new ModularComplianceProxy(ia)));
    }

    function token(
        address ia,
        address identityRegistry_,
        address compliance,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address onchainId
    ) internal returns (Token) {
        return Token(
            address(new TokenProxy(ia, identityRegistry_, compliance, name_, symbol_, decimals_, onchainId))
        );
    }
}
