// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { TrustedIssuersRegistry } from
    "@erc3643org/erc-3643/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import { IdentityRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";
import { ClaimIssuer } from "@onchain-id/solidity/contracts/ClaimIssuer.sol";
import { IClaimIssuer } from "@onchain-id/solidity/contracts/interface/IClaimIssuer.sol";

/**
 * @title TestClaimIssuerSetup
 * @notice Testnet-only wiring of the faucet's TEST ClaimIssuer and TEST registry agent. It is a ClaimIssuer contract whose only
 *         claim-signing key is an EOA held by the API, and it is trusted for the KYC, TAWF_SCREENED and
 *         token-claim topics 10 to 13 only (never OJK_SANDBOX_PARTICIPANT or anything else). It exists so the self-service
 *         faucet need not wait for the Compliance Safe. The real ClaimIssuer stays with the Compliance Safe.
 *
 *         Refuses to run on any chain other than Arbitrum Sepolia (421614), so a mainnet deploy script
 *         that includes it fails instead of trusting a test key.
 */
library TestClaimIssuerSetup {
    uint256 internal constant ARBITRUM_SEPOLIA = 421614;
    uint256 internal constant KYC_TOPIC = 1;
    uint256 internal constant TAWF_SCREENED_TOPIC = 2;
    // Token claims (originator, platform, tokenization partner, offering documents). Topic 3 (sandbox participant) stays out.
    uint256 internal constant ORIGINATOR_TOPIC = 10;
    uint256 internal constant PLATFORM_TOPIC = 11;
    uint256 internal constant PARTNER_TOPIC = 12;
    uint256 internal constant DOCS_TOPIC = 13;

    error TestIssuerTestnetOnly(uint256 chainId);

    /// @notice Grant the faucet's TEST registry agent (an EOA the API holds) the IdentityRegistry agent role.
    ///         The operator never holds that role. The caller must own `ir`. Arbitrum Sepolia only.
    function addRegistryAgent(IdentityRegistry ir, address agent) internal {
        if (block.chainid != ARBITRUM_SEPOLIA) revert TestIssuerTestnetOnly(block.chainid);
        ir.addAgent(agent);
    }

    /// @notice Deploy the test issuer (the caller is its management key), add `signer` as a claim key,
    ///         and list it as a trusted issuer for KYC and TAWF_SCREENED only. The caller must own `tir`.
    function deploy(TrustedIssuersRegistry tir, address signer) internal returns (ClaimIssuer testIssuer) {
        if (block.chainid != ARBITRUM_SEPOLIA) revert TestIssuerTestnetOnly(block.chainid);
        testIssuer = new ClaimIssuer(address(this));
        testIssuer.addKey(keccak256(abi.encode(signer)), 3, 1);
        uint256[] memory topics = new uint256[](6);
        topics[0] = KYC_TOPIC;
        topics[1] = TAWF_SCREENED_TOPIC;
        topics[2] = ORIGINATOR_TOPIC;
        topics[3] = PLATFORM_TOPIC;
        topics[4] = PARTNER_TOPIC;
        topics[5] = DOCS_TOPIC;
        tir.addTrustedIssuer(IClaimIssuer(address(testIssuer)), topics);
    }
}
