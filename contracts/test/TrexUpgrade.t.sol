// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Upgrade tests for the T-REX suite behind the T-REX proxies: one version switch on the
// TREXImplementationAuthority upgrades every proxy, state is kept, and only the authority owner
// (the timelock after hand-over) can add or switch versions.

import { TrexFixture } from "./trex/TrexFixture.sol";
import { TrexProxies } from "../src/proxy/TrexProxies.sol";
import { ITREXImplementationAuthority } from
    "@erc3643org/erc-3643/contracts/proxy/authority/ITREXImplementationAuthority.sol";
import { Token } from "@erc3643org/erc-3643/contracts/token/Token.sol";
import { ModularCompliance } from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import { TrustedIssuersRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import { IdentityRegistryStorage } from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistryStorage.sol";
import { IdentityRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";
import { ClaimTopicsRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/ClaimTopicsRegistry.sol";

contract TokenV2 is Token {
    uint256 public newField;

    function setNewField(uint256 v) external onlyOwner {
        newField = v;
    }

    function versionTag() external pure returns (uint256) {
        return 2;
    }
}

contract IdentityRegistryV2 is IdentityRegistry {
    function versionTag() external pure returns (uint256) {
        return 2;
    }
}

contract TrexUpgradeTest is TrexFixture {
    address internal stranger = address(0xBAD);

    Token internal token;
    ModularCompliance internal mc;

    function setUp() public {
        _setUpTrex();
        (token, mc,) = _deployTrexToken("Upgrade Token", "tUPG", 6);
        // Hand the authority to the timelock, as the deploy script does.
        vm.prank(deployer);
        trexIA.transferOwnership(timelock);
    }

    function _v2() internal returns (ITREXImplementationAuthority.TREXContracts memory c) {
        c = TrexProxies.implementations();
        c.tokenImplementation = address(new TokenV2());
        c.irImplementation = address(new IdentityRegistryV2());
    }

    function _v(uint8 minor) internal pure returns (ITREXImplementationAuthority.Version memory) {
        return ITREXImplementationAuthority.Version({ major: 1, minor: minor, patch: 0 });
    }

    function test_upgradeKeepsStateAcrossSuite() public {
        _registerVerified(address(0xA1), 360);
        assertEq(token.name(), "Upgrade Token");
        assertEq(ctr.getClaimTopics().length, 1);

        ITREXImplementationAuthority.TREXContracts memory c = _v2();
        vm.prank(timelock);
        trexIA.addAndUseTREXVersion(_v(1), c);

        // Every proxy now runs the new logic, with the old state.
        assertEq(TokenV2(address(token)).versionTag(), 2);
        assertEq(IdentityRegistryV2(address(ir)).versionTag(), 2);
        assertEq(token.name(), "Upgrade Token");
        assertEq(token.decimals(), 6);
        assertEq(token.owner(), deployer);
        assertEq(ctr.getClaimTopics().length, 1);
        assertTrue(ir.contains(address(0xA1)));
        assertTrue(ir.isVerified(address(0xA1)));

        vm.prank(deployer);
        TokenV2(address(token)).setNewField(5);
        assertEq(TokenV2(address(token)).newField(), 5);
    }

    function test_onlyAuthorityOwnerCanAddOrUseVersion() public {
        ITREXImplementationAuthority.TREXContracts memory c = _v2();
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        trexIA.addAndUseTREXVersion(_v(1), c);
        // The operator handed the authority over and cannot upgrade any more.
        vm.prank(deployer);
        vm.expectRevert("Ownable: caller is not the owner");
        trexIA.addAndUseTREXVersion(_v(1), c);
    }

    function test_rollbackToPreviousVersion() public {
        ITREXImplementationAuthority.TREXContracts memory c = _v2();
        vm.startPrank(timelock);
        trexIA.addAndUseTREXVersion(_v(1), c);
        trexIA.useTREXVersion(_v(0));
        vm.stopPrank();
        (bool ok,) = address(token).call(abi.encodeWithSignature("versionTag()"));
        assertFalse(ok);
        assertEq(token.name(), "Upgrade Token");
    }

    function test_proxiesCannotBeReinitialised() public {
        vm.expectRevert();
        token.init(address(ir), address(mc), "x", "y", 6, address(0));
        vm.expectRevert();
        mc.init();
    }

    function test_unknownVersionReverts() public {
        vm.prank(timelock);
        vm.expectRevert("invalid argument - non existing version");
        trexIA.useTREXVersion(_v(9));
    }

    function test_implementationsAreLocked() public {
        ITREXImplementationAuthority.TREXContracts memory c = trexIA.getContracts(_v(0));
        vm.expectRevert();
        Token(c.tokenImplementation).init(address(ir), address(mc), "x", "y", 6, address(0));
        vm.expectRevert();
        ModularCompliance(c.mcImplementation).init();
        vm.expectRevert();
        ClaimTopicsRegistry(c.ctrImplementation).init();
        vm.expectRevert();
        IdentityRegistry(c.irImplementation).init(address(tir), address(ctr), address(irs));
        vm.expectRevert();
        TrustedIssuersRegistry(c.tirImplementation).init();
        vm.expectRevert();
        IdentityRegistryStorage(c.irsImplementation).init();
    }
}
