// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// The faucet's TEST ClaimIssuer is wired on Arbitrum Sepolia only and trusted for KYC and
// TAWF_SCREENED only.

import "forge-std/Test.sol";
import { TrexProxies } from "../src/proxy/TrexProxies.sol";
import { TestClaimIssuerSetup } from "../script/lib/TestClaimIssuerSetup.sol";
import { TrustedIssuersRegistry } from
    "@erc3643org/erc-3643/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import { IdentityRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";
import { ClaimIssuer } from "@onchain-id/solidity/contracts/ClaimIssuer.sol";
import { IClaimIssuer } from "@onchain-id/solidity/contracts/interface/IClaimIssuer.sol";

contract TestClaimIssuerHarness {
    function run(TrustedIssuersRegistry tir, address signer) external returns (ClaimIssuer) {
        return TestClaimIssuerSetup.deploy(tir, signer);
    }

    function runAgent(IdentityRegistry ir, address agent) external {
        TestClaimIssuerSetup.addRegistryAgent(ir, agent);
    }
}

contract TestClaimIssuerTest is Test {
    TrustedIssuersRegistry internal tir;
    TestClaimIssuerHarness internal harness;
    address internal signer = makeAddr("testIssuerSigner");

    function setUp() public {
        address ia = address(TrexProxies.authority());
        tir = TrexProxies.trustedIssuersRegistry(ia);
        harness = new TestClaimIssuerHarness();
        tir.transferOwnership(address(harness));
    }

    function test_refusedOffArbitrumSepolia() public {
        for (uint256 i; i < 3; i++) {
            vm.chainId(i == 0 ? 1 : i == 1 ? 42161 : 31337);
            vm.expectRevert(abi.encodeWithSelector(TestClaimIssuerSetup.TestIssuerTestnetOnly.selector, block.chainid));
            harness.run(tir, signer);
        }
    }

    function test_onSepolia_trustedForKycAndScreeningOnly() public {
        vm.chainId(421614);
        ClaimIssuer ci = harness.run(tir, signer);
        assertTrue(tir.isTrustedIssuer(address(ci)));
        assertTrue(tir.hasClaimTopic(address(ci), 1));
        assertTrue(tir.hasClaimTopic(address(ci), 2));
        assertFalse(tir.hasClaimTopic(address(ci), 3), "no sandbox participant topic");
        assertFalse(tir.hasClaimTopic(address(ci), 4));
        assertTrue(ci.keyHasPurpose(keccak256(abi.encode(signer)), 3));
    }

    function test_registryAgent_testnetOnly_operatorHoldsNoRole() public {
        address ia = address(TrexProxies.authority());
        address ctr = address(TrexProxies.claimTopicsRegistry(ia));
        address irs = address(TrexProxies.identityRegistryStorage(ia));
        IdentityRegistry ir = TrexProxies.identityRegistry(ia, address(tir), ctr, irs);
        ir.transferOwnership(address(harness));
        address agent = makeAddr("testRegistryAgent");
        address operator = makeAddr("operator");

        vm.chainId(42161);
        vm.expectRevert(abi.encodeWithSelector(TestClaimIssuerSetup.TestIssuerTestnetOnly.selector, uint256(42161)));
        harness.runAgent(ir, agent);
        assertFalse(ir.isAgent(agent));

        vm.chainId(421614);
        harness.runAgent(ir, agent);
        assertTrue(ir.isAgent(agent));
        assertFalse(ir.isAgent(operator), "the operator holds no registry agent role");
    }
}
