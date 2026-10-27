// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Focused tests for the ScfInvestorLimitModule: the per-offering cap, the per-investor yearly
// limit (shared across offerings and across wallets of one ONCHAINID), exemptions, periods,
// and the access rules. Two T-REX tokens bind the same module instance, as two offerings of one
// SCF platform would. The deployer is the token agent and mints directly.

import {TrexFixture} from "../trex/TrexFixture.sol";
import {ScfInvestorLimitModule} from "../../src/scf/ScfInvestorLimitModule.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {IIdentity} from "@onchain-id/solidity/contracts/interface/IIdentity.sol";

contract ScfInvestorLimitModuleTest is TrexFixture {
    uint256 internal constant CAP = 50_000e6;
    uint128 internal constant LIMIT = 300e6;

    ScfInvestorLimitModule internal scf;
    Token internal tokenA;
    ModularCompliance internal mcA;
    Token internal tokenB;
    ModularCompliance internal mcB;

    address internal treasury = makeAddr("treasury");
    address internal platform = makeAddr("platform");
    address internal alice = makeAddr("alice");
    address internal alice2 = makeAddr("alice2");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    Identity internal aliceId;
    Identity internal bobId;

    function setUp() public {
        _setUpTrex();
        (tokenA, mcA,) = _deployTrexToken("SCF Sukuk A", "tSCF-A", 6);
        (tokenB, mcB,) = _deployTrexToken("SCF Sukuk B", "tSCF-B", 6);

        vm.startPrank(deployer);
        scf = new ScfInvestorLimitModule(address(ir));
        scf.setAgent(platform, true);
        scf.initOffering(address(mcA), treasury, CAP);
        scf.initOffering(address(mcB), treasury, CAP);
        mcA.addModule(address(scf));
        mcB.addModule(address(scf));
        tokenA.addAgent(deployer);
        tokenB.addAgent(deployer);
        tokenA.unpause();
        tokenB.unpause();
        vm.stopPrank();

        aliceId = _registerVerified(alice, 360);
        bobId = _registerVerified(bob, 360);
        _registerVerified(treasury, 360);
        // A second wallet of Alice, registered to the same ONCHAINID.
        vm.prank(deployer);
        ir.registerIdentity(alice2, IIdentity(address(aliceId)), 360);
    }

    function _profile(Identity id, uint128 limit, ScfInvestorLimitModule.Exemption ex) internal {
        vm.prank(platform);
        scf.setProfile(address(id), limit, 1, ex);
    }

    function _mint(Token t, address to, uint256 amount) internal {
        vm.prank(deployer);
        t.mint(to, amount);
    }

    // --- binding and config -------------------------------------------------

    function test_bindRequiresInit() public {
        (, ModularCompliance mcC,) = _deployTrexToken("SCF Sukuk C", "tSCF-C", 6);
        vm.prank(deployer);
        vm.expectRevert("compliance is not suitable for binding to the module");
        mcC.addModule(address(scf));
    }

    function test_initOffering_onlyOwner() public {
        vm.prank(platform);
        vm.expectRevert(ScfInvestorLimitModule.OnlyOwner.selector);
        scf.initOffering(address(0xC0), treasury, CAP);
    }

    function test_setOfferingCap_onlyCompliance() public {
        vm.expectRevert("only bound compliance can call");
        scf.setOfferingCap(1);

        vm.prank(deployer);
        mcA.callModuleFunction(abi.encodeWithSelector(scf.setOfferingCap.selector, 100e6), address(scf));
        (, uint256 cap,) = scf.offeringOf(address(mcA));
        assertEq(cap, 100e6);
    }

    function test_setProfile_onlyAgent() public {
        vm.prank(stranger);
        vm.expectRevert(ScfInvestorLimitModule.OnlyAgent.selector);
        scf.setProfile(address(aliceId), LIMIT, 1, ScfInvestorLimitModule.Exemption.NONE);

        vm.prank(deployer); // owner may act too
        scf.setProfile(address(aliceId), LIMIT, 1, ScfInvestorLimitModule.Exemption.NONE);
    }

    function test_setAgent_onlyOwner() public {
        vm.prank(platform);
        vm.expectRevert(ScfInvestorLimitModule.OnlyOwner.selector);
        scf.setAgent(stranger, true);
    }

    // --- investor limit -----------------------------------------------------

    function test_noProfile_blocked() public {
        vm.prank(deployer);
        vm.expectRevert("Compliance not followed");
        tokenA.mint(alice, 10e6);
    }

    function test_unregisteredWallet_blocked() public {
        assertFalse(scf.moduleCheck(address(0), stranger, 1, address(mcA)));
    }

    function test_limitEnforced() public {
        _profile(aliceId, LIMIT, ScfInvestorLimitModule.Exemption.NONE);
        _mint(tokenA, alice, 300e6);
        assertEq(tokenA.balanceOf(alice), 300e6);

        vm.prank(deployer);
        vm.expectRevert("Compliance not followed");
        tokenA.mint(alice, 1);
    }

    function test_limitSpansOfferings() public {
        _profile(aliceId, LIMIT, ScfInvestorLimitModule.Exemption.NONE);
        _mint(tokenA, alice, 200e6);
        _mint(tokenB, alice, 100e6);

        vm.prank(deployer);
        vm.expectRevert("Compliance not followed");
        tokenB.mint(alice, 1e6);
    }

    function test_limitSharedAcrossWallets() public {
        _profile(aliceId, LIMIT, ScfInvestorLimitModule.Exemption.NONE);
        _mint(tokenA, alice, 250e6);
        (,, uint256 remaining,) = scf.remainingOf(alice2);
        assertEq(remaining, 50e6);

        vm.prank(deployer);
        vm.expectRevert("Compliance not followed");
        tokenA.mint(alice2, 51e6);
        _mint(tokenA, alice2, 50e6);
    }

    function test_exemptions() public {
        _profile(aliceId, 0, ScfInvestorLimitModule.Exemption.LEGAL_ENTITY);
        _profile(bobId, 0, ScfInvestorLimitModule.Exemption.CAPITAL_MARKET_2Y);
        _mint(tokenA, alice, 10_000e6);
        _mint(tokenA, bob, 10_000e6);
        (,, uint256 remaining, ScfInvestorLimitModule.Exemption ex) = scf.remainingOf(alice);
        assertEq(remaining, type(uint256).max);
        assertEq(uint8(ex), uint8(ScfInvestorLimitModule.Exemption.LEGAL_ENTITY));
    }

    function test_newPeriodResetsUsage() public {
        _profile(aliceId, LIMIT, ScfInvestorLimitModule.Exemption.NONE);
        _mint(tokenA, alice, 300e6);
        assertEq(scf.currentPeriod(), 0);

        vm.warp(block.timestamp + 365 days);
        assertEq(scf.currentPeriod(), 1);
        _mint(tokenA, alice, 300e6);
        assertEq(scf.usedOf(address(aliceId), 1), 300e6);
    }

    function test_transferCountsAgainstReceiver() public {
        _profile(aliceId, 0, ScfInvestorLimitModule.Exemption.LEGAL_ENTITY);
        _profile(bobId, 100e6, ScfInvestorLimitModule.Exemption.NONE);
        _mint(tokenA, alice, 1_000e6);

        vm.prank(alice);
        tokenA.transfer(bob, 100e6);
        assertEq(scf.usedOf(address(bobId), 0), 100e6);

        vm.prank(alice);
        vm.expectRevert("Transfer not possible");
        tokenA.transfer(bob, 1);
    }

    function test_burnDoesNotRefundUsage_resetDoes() public {
        _profile(aliceId, LIMIT, ScfInvestorLimitModule.Exemption.NONE);
        _mint(tokenA, alice, 300e6);
        vm.prank(deployer);
        tokenA.burn(alice, 300e6);
        assertEq(scf.usedOf(address(aliceId), 0), 300e6);

        vm.prank(stranger);
        vm.expectRevert(ScfInvestorLimitModule.OnlyAgent.selector);
        scf.resetUsage(address(aliceId), 0);

        vm.prank(platform);
        scf.resetUsage(address(aliceId), 0);
        _mint(tokenA, alice, 300e6);
    }

    function test_treasuryExemptAndNotCounted() public {
        _mint(tokenA, treasury, 1_000e6);
        assertEq(scf.usedOf(address(ir.identity(treasury)), 0), 0);
    }

    // --- offering cap -------------------------------------------------------

    function test_offeringCap() public {
        _profile(aliceId, 0, ScfInvestorLimitModule.Exemption.LEGAL_ENTITY);
        _mint(tokenA, alice, CAP);
        vm.prank(deployer);
        vm.expectRevert("Compliance not followed");
        tokenA.mint(alice, 1);
        // The other offering has its own cap.
        _mint(tokenB, alice, 1e6);
    }

    function test_remainingOf() public {
        (uint256 limit, uint256 used, uint256 remaining,) = scf.remainingOf(alice);
        assertEq(limit, 0);
        assertEq(remaining, 0);

        _profile(aliceId, LIMIT, ScfInvestorLimitModule.Exemption.NONE);
        _mint(tokenA, alice, 120e6);
        (limit, used, remaining,) = scf.remainingOf(alice);
        assertEq(limit, LIMIT);
        assertEq(used, 120e6);
        assertEq(remaining, 180e6);

        (,, remaining,) = scf.remainingOf(stranger);
        assertEq(remaining, 0);
    }
}
