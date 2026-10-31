// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Token ONCHAINID: created through the IdFactory, bound with Token.setOnchainID and read back, carrying the
// originator, platform, tokenization partner and offering document claims (topics 10 to 13). Only the
// Governance Safe changes any of it after the hand-over.

import "forge-std/Test.sol";
import { TrexProxies } from "../src/proxy/TrexProxies.sol";
import { TokenIdentitySetup } from "../script/lib/TokenIdentitySetup.sol";
import { ClaimTopicsRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/ClaimTopicsRegistry.sol";
import { TrustedIssuersRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import { IdentityRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";
import { IdentityRegistryStorage } from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistryStorage.sol";
import { ModularCompliance } from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import { Token } from "@erc3643org/erc-3643/contracts/token/Token.sol";
import { IdFactory } from "@onchain-id/solidity/contracts/factory/IdFactory.sol";
import { ImplementationAuthority } from "@onchain-id/solidity/contracts/proxy/ImplementationAuthority.sol";
import { Identity } from "@onchain-id/solidity/contracts/Identity.sol";
import { ClaimIssuer } from "@onchain-id/solidity/contracts/ClaimIssuer.sol";
import { IClaimIssuer } from "@onchain-id/solidity/contracts/interface/IClaimIssuer.sol";
import { IIdentity } from "@onchain-id/solidity/contracts/interface/IIdentity.sol";

contract TokenIdentityTest is Test {
    uint256 internal constant ISSUER_KEY = 0x155EE5;
    uint256 internal constant OTHER_KEY = 0x0BAD;

    IdFactory internal factory;
    Token internal token;
    TrustedIssuersRegistry internal tir;
    ClaimTopicsRegistry internal ctr;
    ClaimIssuer internal issuer;
    address internal gov = makeAddr("governanceSafe");
    address internal compliance = makeAddr("complianceSafe");
    address internal operator = makeAddr("operator");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        vm.chainId(421614); // signClaim is testnet only
        address ia = address(TrexProxies.authority());
        ctr = TrexProxies.claimTopicsRegistry(ia);
        tir = TrexProxies.trustedIssuersRegistry(ia);
        IdentityRegistryStorage irs = TrexProxies.identityRegistryStorage(ia);
        IdentityRegistry ir = TrexProxies.identityRegistry(ia, address(tir), address(ctr), address(irs));
        ModularCompliance mc = TrexProxies.modularCompliance(ia);
        token = TrexProxies.token(ia, address(ir), address(mc), "Originator Token", "tORG", 2, address(0));
        ctr.addClaimTopic(1); // investor KYC only

        Identity impl = new Identity(address(this), true);
        ImplementationAuthority implAuth = new ImplementationAuthority(address(impl));
        factory = new IdFactory(address(implAuth));

        issuer = new ClaimIssuer(address(this));
        issuer.addKey(keccak256(abi.encode(vm.addr(ISSUER_KEY))), 3, 1);
        uint256[] memory topics = new uint256[](4);
        for (uint256 i; i < 4; i++) topics[i] = 10 + i;
        tir.addTrustedIssuer(IClaimIssuer(address(issuer)), topics);
    }

    function _claims(Identity id) internal {
        bytes[4] memory data = [
            TokenIdentitySetup.encodeOriginator("Demo BPRS", "OJK-DEMO-001", "BPRS", address(0)),
            TokenIdentitySetup.encodePlatform("Demo Deposito Aggregator", "REG-DEMO-77", address(0)),
            TokenIdentitySetup.encodePartner("Tawf Labs", "PT Tawf Labs Teknologi"),
            TokenIdentitySetup.encodeDocs(keccak256("akad v1"), "ipfs://demo-akad")
        ];
        for (uint256 i; i < 4; i++) {
            uint256 topic = 10 + i;
            bytes memory sig = TokenIdentitySetup.signClaim(address(id), topic, data[i], ISSUER_KEY);
            TokenIdentitySetup.addClaim(id, address(issuer), topic, data[i], sig, "");
        }
    }

    function _linked() internal returns (Identity id) {
        id = TokenIdentitySetup.link(factory, token, "tORG", address(this));
    }

    function test_tokenGetsAnIdentityAndReadsItBack() public {
        assertEq(token.onchainID(), address(0));
        Identity id = _linked();
        assertTrue(address(id) != address(0));
        assertEq(token.onchainID(), address(id));
        assertEq(factory.getIdentity(address(token)), address(id));
        assertEq(factory.getToken(address(id)), address(token));
    }

    function test_claimsDecodeToTheExpectedFieldsAndVerify() public {
        Identity id = _linked();
        _claims(id);
        for (uint256 t = 10; t <= 13; t++) {
            bytes32[] memory ids = id.getClaimIdsByTopic(t);
            assertEq(ids.length, 1, "one claim per topic");
            assertEq(ids[0], keccak256(abi.encode(address(issuer), t)));
            (uint256 topic,, address iss, bytes memory sig, bytes memory data,) = id.getClaim(ids[0]);
            assertEq(topic, t);
            assertEq(iss, address(issuer));
            assertTrue(issuer.isClaimValid(IIdentity(address(id)), t, sig, data), "signature valid for the issuer");
            assertTrue(tir.isTrustedIssuer(iss));
            assertTrue(tir.hasClaimTopic(iss, t), "issuer trusted for the topic");
            if (t == 10) {
                (string memory name, string memory licence, string memory kind, address oid) = abi.decode(data, (string, string, string, address));
                assertEq(name, "Demo BPRS");
                assertEq(licence, "OJK-DEMO-001");
                assertEq(kind, "BPRS");
                assertEq(oid, address(0));
            } else if (t == 11) {
                (string memory name, string memory licence, address pid) = abi.decode(data, (string, string, address));
                assertEq(name, "Demo Deposito Aggregator");
                assertEq(licence, "REG-DEMO-77");
                assertEq(pid, address(0));
            } else if (t == 12) {
                (string memory name, string memory entity) = abi.decode(data, (string, string));
                assertEq(name, "Tawf Labs");
                assertEq(entity, "PT Tawf Labs Teknologi");
            } else {
                (bytes32 h, string memory uri) = abi.decode(data, (bytes32, string));
                assertEq(h, keccak256("akad v1"));
                assertEq(uri, "ipfs://demo-akad");
            }
        }
    }

    function test_tokenClaimTopicsAreNotInvestorRequirements() public {
        _linked();
        uint256[] memory required = ctr.getClaimTopics();
        assertEq(required.length, 1);
        assertEq(required[0], 1);
    }

    function test_complianceHoldsTheIdentityGovernanceHoldsNoKey() public {
        Identity id = _linked();
        _claims(id);
        TokenIdentitySetup.handOver(id, compliance, address(this));
        for (uint256 p = 1; p <= 3; p += 2) {
            assertTrue(id.keyHasPurpose(keccak256(abi.encode(compliance)), p));
            assertFalse(id.keyHasPurpose(keccak256(abi.encode(gov)), p), "governance holds no key on the identity");
            assertFalse(id.keyHasPurpose(keccak256(abi.encode(address(this))), p), "deployer holds nothing");
            assertFalse(id.keyHasPurpose(keccak256(abi.encode(operator)), p), "operator holds nothing");
        }

        bytes memory data = TokenIdentitySetup.encodeDocs(keccak256("akad v2"), "ipfs://v2");
        bytes memory sig = TokenIdentitySetup.signClaim(address(id), 13, data, ISSUER_KEY);
        bytes32 docsId = keccak256(abi.encode(address(issuer), uint256(13)));

        // governance, the old deployer and the operator cannot add or remove claims, nor change keys
        address[3] memory no = [gov, address(this), operator];
        for (uint256 i; i < 3; i++) {
            vm.startPrank(no[i]);
            vm.expectRevert(bytes("Permissions: Sender does not have claim signer key"));
            id.addClaim(13, 1, address(issuer), sig, data, "");
            vm.expectRevert(bytes("Permissions: Sender does not have claim signer key"));
            id.removeClaim(docsId);
            vm.expectRevert();
            id.addKey(keccak256(abi.encode(no[i])), 1, 1);
            vm.stopPrank();
        }

        // the Compliance Safe updates the document claim, removes one, and rotates its own key
        vm.startPrank(compliance);
        id.addClaim(13, 1, address(issuer), sig, data, "");
        (,,,, bytes memory stored,) = id.getClaim(docsId);
        (bytes32 h,) = abi.decode(stored, (bytes32, string));
        assertEq(h, keccak256("akad v2"));
        id.removeClaim(docsId);
        address newCompliance = makeAddr("newComplianceSafe");
        id.addKey(keccak256(abi.encode(newCompliance)), 1, 1);
        id.removeKey(keccak256(abi.encode(compliance)), 1);
        vm.stopPrank();
        assertEq(id.getClaimIdsByTopic(13).length, 0);
        assertTrue(id.keyHasPurpose(keccak256(abi.encode(newCompliance)), 1));
        assertFalse(id.keyHasPurpose(keccak256(abi.encode(compliance)), 1));
    }

    function test_handOverRefusesBadSafes() public {
        Identity id = _linked();
        vm.expectRevert(bytes("the Safe cannot be the deployer"));
        this.callHandOver(id, address(this));
        vm.expectRevert(bytes("zero compliance safe"));
        this.callHandOver(id, address(0));
    }

    function callHandOver(Identity id, address c) external {
        TokenIdentitySetup.handOver(id, c, address(this));
    }

    function test_onlyTheTokenOwnerChangesTheOnchainId() public {
        Identity id = _linked();
        token.transferOwnership(gov); // the hand-over of the token
        Identity other = Identity(factory.createTokenIdentity(makeAddr("anotherToken"), address(this), "other"));

        vm.expectRevert(bytes("Ownable: caller is not the owner")); // the old deployer
        token.setOnchainID(address(other));
        vm.prank(stranger);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        token.setOnchainID(address(other));
        assertEq(token.onchainID(), address(id), "unchanged");

        vm.prank(gov);
        token.setOnchainID(address(other));
        assertEq(token.onchainID(), address(other));
    }

    function test_aClaimNotSignedByTheIssuerIsRejected() public {
        Identity id = _linked();
        bytes memory data = TokenIdentitySetup.encodeOriginator("Fake", "X", "BPRS", address(0));
        bytes memory forged = TokenIdentitySetup.signClaim(address(id), 10, data, OTHER_KEY);
        vm.expectRevert(bytes("invalid claim"));
        id.addClaim(10, 1, address(issuer), forged, data, "");
        // a signature over other data does not carry over to tampered data
        bytes memory good = TokenIdentitySetup.signClaim(address(id), 10, data, ISSUER_KEY);
        bytes memory tampered = TokenIdentitySetup.encodeOriginator("Other Name", "X", "BPRS", address(0));
        vm.expectRevert(bytes("invalid claim"));
        id.addClaim(10, 1, address(issuer), good, tampered, "");
    }

    function test_linkTwiceOrWithoutOwnershipFails() public {
        _linked();
        vm.expectRevert(bytes("token already linked to an identity"));
        this.callLink("again");
        // a caller that does not own the IdFactory cannot create token identities
        vm.prank(stranger);
        vm.expectRevert(bytes("only Factory or owner can call"));
        factory.createTokenIdentity(makeAddr("t2"), stranger, "x");
    }

    function callLink(string memory salt) external returns (Identity) {
        return TokenIdentitySetup.link(factory, token, salt, address(this));
    }

    function callSign() external view returns (bytes memory) {
        return TokenIdentitySetup.signClaim(address(1), 10, "", ISSUER_KEY);
    }

    function test_signClaimRefusesEveryChainButArbitrumSepolia() public {
        this.callSign(); // 421614 works
        uint256[3] memory others = [uint256(1), 42161, 31337];
        for (uint256 i; i < 3; i++) {
            vm.chainId(others[i]);
            vm.expectRevert(bytes("signClaim is testnet only"));
            this.callSign();
        }
    }
}
