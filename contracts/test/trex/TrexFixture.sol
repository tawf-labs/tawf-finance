// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Pinned to 0.8.17 because it imports the concrete T-REX and onchain-id contracts (both 0.8.17).
// Tawf contracts under test (SukukDistributor ^0.8.20, TawfDepositoSeries ^0.8.24,
// MockUSDC/MockUSDT ^0.8.20) are reached only via vm.deployCode and minimal interfaces.

import { TrexProxies } from "../../src/proxy/TrexProxies.sol";
import { TREXImplementationAuthority } from "@erc3643org/erc-3643/contracts/proxy/authority/TREXImplementationAuthority.sol";
import { ModuleProxies } from "../../src/proxy/ModuleProxies.sol";
import "forge-std/Test.sol";
import {ProxyDeployer} from "../../script/lib/ProxyDeployer.sol";

import {ClaimTopicsRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import {IdentityRegistryStorage} from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistryStorage.sol";
import {IdentityRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";

import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {ClaimIssuer} from "@onchain-id/solidity/contracts/ClaimIssuer.sol";
import {IIdentity} from "@onchain-id/solidity/contracts/interface/IIdentity.sol";

import {DistributionCheckpointModule} from "../../src/sukuk/DistributionCheckpointModule.sol";
import {IBalanceCheckpoint} from "../../src/sukuk/IBalanceCheckpoint.sol";

/// @notice Shared T-REX identity + token fixture for the ERC-3643 Tawf test suites. Mirrors the
///         wiring in tawf-gold-bsi's TBSI.t.sol: identities are registered through ONCHAINID with
///         a KYC claim signed by a trusted ClaimIssuer, so isVerified reflects real claims.
abstract contract TrexFixture is Test, ProxyDeployer {
    uint256 internal constant KYC_TOPIC = 1;

    // Actors shared across suites.
    address internal deployer = address(0xA11CE);
    /// @dev Stand-in for the TimelockController that holds UPGRADER_ROLE on the proxied contracts.
    address internal timelock = address(0x71AE10C0);
    bytes4 internal constant DIST_INIT = bytes4(keccak256("initialize(address[],address,address,address,address,(bytes32,uint256,uint40,uint256,uint256,uint40,address),address,address)"));
    bytes4 internal constant SERIES_INIT = bytes4(keccak256("initialize(address,address,address,address,address,(bytes32,uint8,uint16),address,address,address,uint64,address)"));
    uint256 internal claimIssuerKey = 0xC1A1;
    address internal claimIssuerSigner;

    // T-REX suite.
    ClaimTopicsRegistry internal ctr;
    TrustedIssuersRegistry internal tir;
    IdentityRegistryStorage internal irs;
    IdentityRegistry internal ir;
    ClaimIssuer internal claimIssuer;
    /// @dev T-REX implementation authority every proxy of the suite reads its logic from.
    TREXImplementationAuthority internal trexIA;

    /// @dev Deploy and wire the shared identity suite. Call from a test's setUp while pranking as
    ///      the deployer is handled internally.
    function _setUpTrex() internal {
        claimIssuerSigner = vm.addr(claimIssuerKey);

        vm.startPrank(deployer);
        trexIA = TrexProxies.authority();
        ctr = TrexProxies.claimTopicsRegistry(address(trexIA));
        tir = TrexProxies.trustedIssuersRegistry(address(trexIA));
        irs = TrexProxies.identityRegistryStorage(address(trexIA));
        ir = TrexProxies.identityRegistry(address(trexIA), address(tir), address(ctr), address(irs));
        irs.bindIdentityRegistry(address(ir));
        ctr.addClaimTopic(KYC_TOPIC);

        claimIssuer = new ClaimIssuer(deployer);
        claimIssuer.addKey(keccak256(abi.encode(claimIssuerSigner)), 3, 1);

        uint256[] memory topics = new uint256[](1);
        topics[0] = KYC_TOPIC;
        tir.addTrustedIssuer(claimIssuer, topics);

        ir.addAgent(deployer); // deployer registers verified holders
        vm.stopPrank();
    }

    /// @dev Deploy a T-REX token with its own ModularCompliance and a DistributionCheckpointModule
    ///      (hook not yet set). Returns the token, its compliance, and the module so the caller can
    ///      deploy the distributor and then call _wireDistributor. The token starts paused.
    function _deployTrexToken(string memory name_, string memory symbol_, uint8 decimals_)
        internal
        returns (Token token, ModularCompliance mc, DistributionCheckpointModule module)
    {
        vm.startPrank(deployer);
        mc = TrexProxies.modularCompliance(address(trexIA));
        token = TrexProxies.token(address(trexIA), address(ir), address(mc), name_, symbol_, decimals_, address(0));
        module = ModuleProxies.checkpoint();
        vm.stopPrank();
    }

    /// @dev Wire a freshly deployed distributor to the token: set the module hook, bind the module,
    ///      make the distributor (and deployer) token agents, and unpause.
    function _wireDistributor(Token token, ModularCompliance mc, DistributionCheckpointModule module, address distributor)
        internal
    {
        vm.startPrank(deployer);
        module.setHook(address(mc), IBalanceCheckpoint(distributor));
        mc.addModule(address(module));
        token.addAgent(distributor);
        token.addAgent(deployer);
        token.unpause();
        vm.stopPrank();
    }

    /// @dev Register `wallet` as a verified holder: deploy an identity whose management key is
    ///      `wallet`, add a ClaimIssuer-signed KYC claim, then registerIdentity.
    function _registerVerified(address wallet, uint16 country) internal returns (Identity idc) {
        idc = new Identity(wallet, false);

        bytes memory claimData = abi.encodePacked("KYC-OK");
        bytes32 dataHash = keccak256(abi.encode(address(idc), KYC_TOPIC, claimData));
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(claimIssuerKey, prefixed);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(wallet);
        idc.addClaim(KYC_TOPIC, 1, address(claimIssuer), sig, claimData, "");

        vm.prank(deployer);
        ir.registerIdentity(wallet, IIdentity(address(idc)), country);
    }
}
