// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { Token } from "@erc3643org/erc-3643/contracts/token/Token.sol";
import { IdFactory } from "@onchain-id/solidity/contracts/factory/IdFactory.sol";
import { Identity } from "@onchain-id/solidity/contracts/Identity.sol";

interface IClaimSignerVm {
    function sign(uint256 privateKey, bytes32 digest) external pure returns (uint8 v, bytes32 r, bytes32 s);
}

/**
 * @title TokenIdentitySetup
 * @notice Records WHO is behind a token on chain, with the ERC-3643 standard pieces only: a token ONCHAINID
 *         (IdFactory.createTokenIdentity, Token.setOnchainID) carrying claims under four topics of our own
 *         numbering, after the investor topics 1 to 3:
 *
 *           10 ORIGINATOR              abi.encode(string name, string licence, string kind, address originatorId)
 *           11 PLATFORM                abi.encode(string name, string licence, address platformId)
 *           12 TOKENIZATION_PARTNER    abi.encode(string name, string entity)
 *           13 OFFERING_DOCS           abi.encode(bytes32 documentHash, string uri)
 *
 *         The topics describe the TOKEN, so they are never added to the ClaimTopicsRegistry (investor
 *         requirements). A claim id is keccak256(issuer, topic), so one issuer holds one claim per topic.
 *
 *         Deploy order (script, before the hand-over): `link` the token, `addClaim` the four claims, then
 *         `handOver` the identity to the Compliance Safe, which then adds and removes the claims. The Governance Safe,
 *         as token owner, is the only one that can call `Token.setOnchainID`.
 *         No new contract is deployed by this library. Internal functions only.
 */
library TokenIdentitySetup {
    uint256 internal constant ORIGINATOR = 10;
    uint256 internal constant PLATFORM = 11;
    uint256 internal constant TOKENIZATION_PARTNER = 12;
    uint256 internal constant OFFERING_DOCS = 13;
    uint256 internal constant MANAGEMENT = 1;
    uint256 internal constant CLAIM_SIGNER = 3; // implied by MANAGEMENT in keyHasPurpose
    uint256 internal constant ECDSA = 1;

    IClaimSignerVm private constant VM = IClaimSignerVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    // --- claim data encoders (the API and the UI decode with the same field lists) ---------------------

    function encodeOriginator(string memory name, string memory licence, string memory kind, address originatorId)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(name, licence, kind, originatorId);
    }

    function encodePlatform(string memory name, string memory licence, address platformId) internal pure returns (bytes memory) {
        return abi.encode(name, licence, platformId);
    }

    function encodePartner(string memory name, string memory entity) internal pure returns (bytes memory) {
        return abi.encode(name, entity);
    }

    function encodeDocs(bytes32 documentHash, string memory uri) internal pure returns (bytes memory) {
        return abi.encode(documentHash, uri);
    }

    // --- identity wiring ---------------------------------------------------------------------------------

    /// @notice Create the token's ONCHAINID with `deployer` as its temporary management and claim key, bind it
    ///         with `setOnchainID` (the deployer must own the token and the IdFactory) and read both back.
    ///         `deployer` is passed in, never taken from msg.sender: in a Foundry script msg.sender is not the
    ///         broadcaster.
    function link(IdFactory factory, Token token, string memory salt, address deployer) internal returns (Identity id) {
        id = Identity(factory.createTokenIdentity(address(token), deployer, salt));
        require(address(id) != address(0), "token identity not created");
        token.setOnchainID(address(id));
        require(address(token.onchainID()) == address(id), "token onchainID read-back mismatch");
        require(factory.getIdentity(address(token)) == address(id), "factory does not link the token");
    }

    /// @notice The digest an issuer key signs for a claim: keccak256(abi.encode(identity, topic, data)) with the
    ///         Ethereum signed message prefix, exactly what ClaimIssuer.isClaimValid recovers.
    function claimDigest(address identity, uint256 topic, bytes memory data) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encode(identity, topic, data))));
    }

    /// @notice Sign a claim with an issuer key held by the script (testnet issuer only, never a real issuer key).
    function signClaim(address identity, uint256 topic, bytes memory data, uint256 issuerKey) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = VM.sign(issuerKey, claimDigest(identity, topic, data));
        return abi.encodePacked(r, s, v);
    }

    /// @notice Add a claim the issuer already signed. The caller must hold a management or claim key of `id`.
    function addClaim(Identity id, address issuer, uint256 topic, bytes memory data, bytes memory signature, string memory uri)
        internal
        returns (bytes32 claimId)
    {
        claimId = id.addClaim(topic, 1, issuer, signature, data, uri);
        require(claimId == keccak256(abi.encode(issuer, topic)), "unexpected claim id");
    }

    /// @notice Give the identity to the Compliance Safe and take it away from the deployer.
    ///
    ///         In this OnchainID version `keyHasPurpose` is true for ANY purpose when the key holds MANAGEMENT
    ///         (purpose 1), so a management key can always add and remove claims too. The duties therefore cannot be
    ///         split between a management key and a claim key. Claims are a Compliance duty, so the Compliance Safe
    ///         holds the management key (and with it the claim and key rights) and the Governance Safe holds NO key on
    ///         the token identity. Governance keeps its own lever: as token owner it alone can call
    ///         `Token.setOnchainID` to point the token at a different identity.
    function handOver(Identity id, address compliance, address deployer) internal {
        require(compliance != address(0), "zero compliance safe");
        require(compliance != deployer, "the Safe cannot be the deployer");
        bytes32 complianceKey = keccak256(abi.encode(compliance));
        bytes32 deployerKey = keccak256(abi.encode(deployer));
        id.addKey(complianceKey, MANAGEMENT, ECDSA);
        id.removeKey(deployerKey, MANAGEMENT);
        require(id.keyHasPurpose(complianceKey, MANAGEMENT), "compliance has no management key");
        require(!id.keyHasPurpose(deployerKey, MANAGEMENT) && !id.keyHasPurpose(deployerKey, CLAIM_SIGNER), "deployer still has a key");
    }
}
