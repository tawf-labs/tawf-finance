// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Runs the REAL DeployAll (the same _runAll the script broadcasts: beacons, T-REX proxies, role wiring, hand-over and
// every read-back) against placeholder Safes, then checks the result from the outside. Nothing here copies the wiring.

import "forge-std/Test.sol";
import { DeployAll } from "../script/DeployAll.s.sol";
import { TrustedIssuersRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/TrustedIssuersRegistry.sol";

interface IRolesT {
    function hasRole(bytes32 role, address account) external view returns (bool);
    function pause() external;
    function unpause() external;
    function claim(address coin) external;
    function redeem(address coin) external;
}

interface IOwnableT {
    function owner() external view returns (address);
}

interface IAgentT {
    function isAgent(address a) external view returns (bool);
}

interface ITirT {
    function isTrustedIssuer(address issuer) external view returns (bool);
}

contract DeployAllRolesTest is Test, DeployAll {
    address internal operator = address(0xBEEF0);
    address internal gov = address(0x1000000000000000000000000000000000000001);
    address internal treasury = address(0x1000000000000000000000000000000000000002);
    address internal minting = address(0x1000000000000000000000000000000000000003);
    address internal complianceSafe = address(0x1000000000000000000000000000000000000004);
    address internal guardian = address(0x1000000000000000000000000000000000000005);
    address internal signer = address(0x7E57);
    address internal registryAgent = address(0x7E58);
    address internal alice = address(0xA11CE0);

    Out internal o;

    function setUp() public {
        vm.chainId(421614); // the faucet branch of the deploy only runs on Arbitrum Sepolia
        vm.setEnv("ALLOW_EOA_SAFES", "true");
        vm.setEnv("GOV_SAFE", vm.toString(gov));
        vm.setEnv("TREASURY_SAFE", vm.toString(treasury));
        vm.setEnv("MINTING_SAFE", vm.toString(minting));
        vm.setEnv("COMPLIANCE_SAFE", vm.toString(complianceSafe));
        vm.setEnv("GUARDIAN_SAFE", vm.toString(guardian));
        vm.setEnv("TEST_CLAIM_SIGNER", vm.toString(signer));
        vm.setEnv("TEST_REGISTRY_AGENT", vm.toString(registryAgent));
        vm.setEnv("SUKUK_ID", vm.toString(bytes32(keccak256("sukuk.demo.2026"))));
        vm.setEnv("SUKUK_FACE", vm.toString(uint256(500_000e6)));
        vm.setEnv("SUKUK_MATURITY", vm.toString(uint256(block.timestamp + 365 days)));
        _loadSafes();
        vm.startPrank(operator);
        o = _runAll(operator, 42);
        vm.stopPrank();
    }

    // ---- the operator ends with FX and data posts only ----

    function test_operatorHoldsOnlyFxAndDataRoles() public view {
        bytes32 admin = keccak256("ADMIN_ROLE");
        bytes32 minter = keccak256("MINTER_ROLE");
        bytes32 funder = keccak256("FUNDER_ROLE");
        address[6] memory all = [o.d.series, o.pSeries, o.d.sukukDistributor, o.scf.distributor, o.pLedger, o.d.dealRegistry];
        for (uint256 i; i < all.length; i++) {
            IRolesT c = IRolesT(all[i]);
            assertFalse(c.hasRole(admin, operator));
            assertFalse(c.hasRole(minter, operator));
            assertFalse(c.hasRole(funder, operator));
            assertFalse(c.hasRole(0x00, operator));
        }
        assertTrue(IRolesT(o.d.series).hasRole(keccak256("FX_ROLE"), operator));
        assertTrue(IRolesT(o.pSeries).hasRole(keccak256("FX_ROLE"), operator));
    }

    // ---- MINTER and FUNDER sit on different Safes, across every contract ----

    function test_minterAndFunderAreDifferentSafesEverywhere() public view {
        bytes32 minter = keccak256("MINTER_ROLE");
        bytes32 funder = keccak256("FUNDER_ROLE");
        address[2] memory series = [o.d.series, o.pSeries];
        address[2] memory dists = [o.d.sukukDistributor, o.scf.distributor];
        for (uint256 i; i < 2; i++) {
            assertTrue(IRolesT(series[i]).hasRole(minter, minting));
            assertTrue(IRolesT(series[i]).hasRole(funder, treasury));
            assertFalse(IRolesT(series[i]).hasRole(funder, minting));
            assertFalse(IRolesT(series[i]).hasRole(minter, treasury));
            assertTrue(IRolesT(dists[i]).hasRole(funder, treasury));
            assertFalse(IRolesT(dists[i]).hasRole(funder, minting));
            assertFalse(IRolesT(dists[i]).hasRole(funder, guardian));
            assertFalse(IRolesT(series[i]).hasRole(minter, guardian));
        }
    }

    // ---- T-REX read-backs ----

    function test_trexAgentsAndClaimIssuerKeys() public view {
        address ir = o.d.shared.identityRegistry;
        assertFalse(IAgentT(ir).isAgent(operator));
        assertTrue(IAgentT(ir).isAgent(complianceSafe));
        assertTrue(IAgentT(ir).isAgent(registryAgent)); // the faucet's TEST agent, Arbitrum Sepolia only
        address[4] memory tokens = [o.d.seriesToken, o.pToken, o.d.sukukToken, o.scf.token];
        for (uint256 i; i < 4; i++) {
            assertFalse(IAgentT(tokens[i]).isAgent(operator));
            assertFalse(IAgentT(tokens[i]).isAgent(guardian)); // an agent can mint and force-transfer, so never the guardian
            assertTrue(IAgentT(tokens[i]).isAgent(minting));
        }
        // The test issuer is recorded and trusted, the real claim issuer belongs to the Compliance Safe.
        assertTrue(o.testClaimIssuer != address(0));
        assertTrue(ITirT(o.d.shared.trustedIssuersRegistry).isTrustedIssuer(o.testClaimIssuer));
    }

    // ---- ownership ----

    function test_everyOwnerIsTheGovernanceSafe() public view {
        assertEq(IOwnableT(o.d.shared.identityRegistry).owner(), gov);
        assertEq(IOwnableT(o.d.shared.trustedIssuersRegistry).owner(), gov);
        assertEq(IOwnableT(_trexAuthority).owner(), gov);
        assertEq(IOwnableT(o.d.seriesToken).owner(), gov);
        for (uint256 i; i < _allBeacons.length; i++) assertEq(IOwnableT(_allBeacons[i]).owner(), gov);
        // every ModularCompliance, sandboxed or not (dev1's API calls callModuleFunction through the Governance Safe)
        assertEq(IOwnableT(_complianceOf(o.d.seriesToken)).owner(), gov);
        assertEq(IOwnableT(_complianceOf(o.pToken)).owner(), gov);
        assertEq(IOwnableT(_complianceOf(o.scf.token)).owner(), gov);
    }

    function _complianceOf(address token) internal view returns (address c) {
        (bool ok, bytes memory r) = token.staticcall(abi.encodeWithSignature("compliance()"));
        require(ok, "compliance()");
        c = abi.decode(r, (address));
    }

    // ---- pause: one guardian signer can stop new money but never freeze payouts ----

    function test_guardianPausesNewMoneyButNotPayouts() public {
        vm.prank(guardian);
        IRolesT(o.d.series).pause();
        vm.prank(guardian);
        IRolesT(o.d.sukukDistributor).pause();

        // New money and minting stop.
        vm.prank(minting);
        (bool ok, bytes memory err) = o.d.series.call(abi.encodeWithSignature("allocate(address[],uint256,uint64,uint256,bytes32[])", new address[](0), 0, uint64(0), 0, new bytes32[](0)));
        assertFalse(ok);
        assertEq(bytes4(err), bytes4(keccak256("EnforcedPause()")));
        vm.prank(alice);
        (ok, err) = o.d.sukukDistributor.call(abi.encodeWithSignature("subscribe(address,uint256)", o.d.mockUsdc, 1e6));
        assertEq(bytes4(err), bytes4(keccak256("EnforcedPause()")));

        // Payouts and exits stay open: they fail for their own reasons (nothing to claim), never because of the pause.
        vm.prank(alice);
        (ok, err) = o.d.series.call(abi.encodeWithSignature("claim(address)", o.d.mockUsdc));
        assertTrue(bytes4(err) != bytes4(keccak256("EnforcedPause()")));
        vm.prank(alice);
        (ok, err) = o.d.series.call(abi.encodeWithSignature("redeem(address)", o.d.mockUsdc));
        assertTrue(bytes4(err) != bytes4(keccak256("EnforcedPause()")));
        vm.prank(alice);
        (ok, err) = o.d.sukukDistributor.call(abi.encodeWithSignature("claim(address)", o.d.mockUsdc));
        assertTrue(bytes4(err) != bytes4(keccak256("EnforcedPause()")));
        vm.prank(alice);
        (ok, err) = o.d.sukukDistributor.call(abi.encodeWithSignature("redeem(address)", o.d.mockUsdc));
        assertTrue(bytes4(err) != bytes4(keccak256("EnforcedPause()")));
        vm.prank(alice);
        (ok, err) = o.d.sukukDistributor.call(abi.encodeWithSignature("claimProfit(address)", o.d.mockUsdc));
        assertTrue(bytes4(err) != bytes4(keccak256("EnforcedPause()")));

        // The guardian cannot unpause. Governance can.
        vm.prank(guardian);
        vm.expectRevert();
        IRolesT(o.d.series).unpause();
        vm.prank(gov);
        IRolesT(o.d.series).unpause();
    }
}
