// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { TREXImplementationAuthority } from
    "@erc3643org/erc-3643/contracts/proxy/authority/TREXImplementationAuthority.sol";
import { ITREXImplementationAuthority } from
    "@erc3643org/erc-3643/contracts/proxy/authority/ITREXImplementationAuthority.sol";

/**
 * @title AuthorityGuard
 * @notice Owns the T-REX TREXImplementationAuthority and is itself owned by the timelock. The authority is
 *         plain single-step Ownable, so it could be given away or renounced by one wrong call. The guard
 *         closes that: its own ownership is two-step, `renounceOwnership` reverts, and it forwards only the
 *         three version calls an upgrade needs. Everything else on the authority (factory setters,
 *         `changeImplementationAuthority`, its own `transferOwnership`) is unreachable through the guard.
 *
 *         The one deliberate exit is `releaseAuthority(newOwner)`, owner only, for a planned migration. It is
 *         a timelock operation like any other, so it is delayed and public.
 */
contract AuthorityGuard is Ownable2Step {
    TREXImplementationAuthority public immutable authority;

    event AuthorityReleased(address indexed newOwner);

    constructor(TREXImplementationAuthority authority_) {
        authority = authority_;
    }

    function addAndUseTREXVersion(
        ITREXImplementationAuthority.Version calldata version,
        ITREXImplementationAuthority.TREXContracts calldata contracts
    ) external onlyOwner {
        authority.addAndUseTREXVersion(version, contracts);
    }

    function addTREXVersion(
        ITREXImplementationAuthority.Version calldata version,
        ITREXImplementationAuthority.TREXContracts calldata contracts
    ) external onlyOwner {
        authority.addTREXVersion(version, contracts);
    }

    function useTREXVersion(ITREXImplementationAuthority.Version calldata version) external onlyOwner {
        authority.useTREXVersion(version);
    }

    /// @notice Planned migration only: hand the authority itself to `newOwner`.
    function releaseAuthority(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AuthorityGuard: zero owner");
        authority.transferOwnership(newOwner);
        emit AuthorityReleased(newOwner);
    }

    /// @dev Renouncing would freeze the authority for good, so it is disabled.
    function renounceOwnership() public pure override {
        revert("AuthorityGuard: renounce disabled");
    }
}
