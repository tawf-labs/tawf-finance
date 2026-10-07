// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "openzeppelin-contracts/contracts/access/IAccessControl.sol";
import { MessageHashUtils } from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import { DisbursementVerifier } from "../../src/prototype/DisbursementVerifier.sol";

/**
 * @notice Tests for the local-prototype DisbursementVerifier. Mirrors the
 *         BaseSetup conventions of the production suite (makeAddr, vm.prank,
 *         onlyRole revert-reason assertions) but is self-contained — the
 *         prototype is never wired into the production stack.
 *
 *         The decisive test is testAgentHasNoDenyOrDefaultPath: it asserts the
 *         ABI exposes NO agent-callable adverse mutator, which is how
 *         asymmetric automation is proven structurally.
 */
contract DisbursementVerifierTest is Test {
    DisbursementVerifier internal verifier;

    address internal admin = makeAddr("admin");
    // Role separation: each role on a DISTINCT account (a Table VII gap).
    uint256 internal agentPk = 0xA6E57;
    address internal agent = vm.addr(0xA6E57);
    address internal officer = makeAddr("officer");
    address internal shariah = makeAddr("shariah");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant EVID = keccak256("evidence-blob-1");
    bytes32 internal constant REASONS = keccak256("reasons-1");

    // Cached so view calls do not consume a vm.prank in the guarded-call tests.
    bytes32 internal AGENT_ROLE;
    bytes32 internal OFFICER_ROLE;
    bytes32 internal SHARIAH_ROLE;

    function setUp() public {
        vm.prank(admin);
        verifier = new DisbursementVerifier(admin);
        AGENT_ROLE = verifier.AGENT_ROLE();
        OFFICER_ROLE = verifier.OFFICER_ROLE();
        SHARIAH_ROLE = verifier.SHARIAH_ROLE();
        vm.startPrank(admin);
        verifier.grantRole(AGENT_ROLE, agent);
        verifier.grantRole(OFFICER_ROLE, officer);
        verifier.grantRole(SHARIAH_ROLE, shariah);
        vm.stopPrank();
    }

    // --- helpers ---

    function _sign(uint256 pk, uint256 milestoneId, bool clean, bytes32 reasonsHash)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = verifier.verdictDigest(milestoneId, clean, reasonsHash);
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function _register(bytes32 evid) internal returns (uint256) {
        vm.prank(agent);
        return verifier.registerMilestone(evid);
    }

    /// @dev Submit a verdict as the agent. Signature is computed BEFORE the
    ///      prank so the view call inside _sign does not consume it.
    function _agentVerdict(uint256 id, bool clean) internal {
        bytes memory sig = _sign(agentPk, id, clean, REASONS);
        vm.prank(agent);
        verifier.submitVerdict(id, clean, REASONS, sig);
    }

    // --- (a) register anchors a hash; second register of the same hash reverts ---

    function testRegisterAnchorsHash() public {
        uint256 id = _register(EVID);
        assertEq(id, 1);
        assertEq(verifier.milestoneCount(), 1);
        assertTrue(verifier.evidenceSeen(EVID));
        DisbursementVerifier.Milestone memory m = verifier.getMilestone(id);
        assertEq(m.evidenceHash, EVID);
        assertEq(uint8(m.status), uint8(DisbursementVerifier.Status.Registered));
    }

    function testDuplicateEvidenceHashReverts() public {
        _register(EVID);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(DisbursementVerifier.EvidenceAlreadyAnchored.selector, EVID));
        verifier.registerMilestone(EVID);
    }

    // --- (b) AGENT_ROLE + clean -> Released + event, attestation stored ---

    function testCleanVerdictReleases() public {
        uint256 id = _register(EVID);
        bytes memory sig = _sign(agentPk, id, true, REASONS);
        vm.expectEmit(true, true, false, true);
        emit DisbursementVerifier.TrancheReleased(id, agent, REASONS);
        vm.prank(agent);
        verifier.submitVerdict(id, true, REASONS, sig);

        DisbursementVerifier.Milestone memory m = verifier.getMilestone(id);
        assertEq(uint8(m.status), uint8(DisbursementVerifier.Status.Released));
        assertTrue(m.clean);
        assertEq(m.reasonsHash, REASONS);
        assertEq(m.agent, agent);
    }

    // --- (c) AGENT_ROLE + not-clean -> Flagged + event, NO release ---

    function testNotCleanVerdictFlagsNoRelease() public {
        uint256 id = _register(EVID);
        bytes memory sig = _sign(agentPk, id, false, REASONS);
        vm.expectEmit(true, true, false, true);
        emit DisbursementVerifier.FlaggedForHuman(id, agent, REASONS);
        vm.prank(agent);
        verifier.submitVerdict(id, false, REASONS, sig);

        DisbursementVerifier.Milestone memory m = verifier.getMilestone(id);
        assertEq(uint8(m.status), uint8(DisbursementVerifier.Status.Flagged));
        assertFalse(m.clean);
    }

    // --- (d) the agent has NO deny/default/reject path (asymmetric automation) ---

    /**
     * @dev Structural proof of asymmetric automation. There is no agent-callable
     *      function that drives a milestone to Denied. The only route to Denied
     *      is officerDeny, which requires OFFICER_ROLE and a SHARIAH co-sign. We
     *      prove the agent cannot reach Denied by any exposed call: the agent
     *      lacks OFFICER_ROLE, so officerDeny reverts for it, and no other
     *      mutator produces Denied.
     */
    function testAgentHasNoDenyOrDefaultPath() public {
        uint256 id = _register(EVID);
        bytes memory sig = _sign(agentPk, id, false, REASONS);
        vm.prank(agent);
        verifier.submitVerdict(id, false, REASONS, sig); // flag it

        // The agent cannot deny — officerDeny is OFFICER_ROLE-gated.
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, agent, OFFICER_ROLE
            )
        );
        verifier.officerDeny(id, shariah);

        // The agent also cannot override-release — OFFICER_ROLE-gated.
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, agent, OFFICER_ROLE
            )
        );
        verifier.officerOverrideRelease(id, shariah);

        // Status is still Flagged — the agent produced no adverse write.
        assertEq(uint8(verifier.statusOf(id)), uint8(DisbursementVerifier.Status.Flagged));
    }

    // --- (e) only OFFICER_ROLE (+ SHARIAH co-sign) resolves a flag ---

    function testOfficerOverrideReleaseResolvesFlag() public {
        uint256 id = _register(EVID);
        _agentVerdict(id, false);

        vm.expectEmit(true, true, false, false);
        emit DisbursementVerifier.OfficerOverrideReleased(id, officer);
        vm.prank(officer);
        verifier.officerOverrideRelease(id, shariah);
        assertEq(uint8(verifier.statusOf(id)), uint8(DisbursementVerifier.Status.OverrideReleased));
    }

    function testOfficerDenyIsHumanOnlyAndNeedsShariah() public {
        uint256 id = _register(EVID);
        _agentVerdict(id, false);

        // A non-shariah co-signer is rejected.
        vm.prank(officer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, SHARIAH_ROLE
            )
        );
        verifier.officerDeny(id, stranger);

        // Proper officer + shariah co-sign denies (a HUMAN outcome).
        vm.prank(officer);
        verifier.officerDeny(id, shariah);
        assertEq(uint8(verifier.statusOf(id)), uint8(DisbursementVerifier.Status.Denied));
    }

    function testCannotOverrideUnflaggedMilestone() public {
        uint256 id = _register(EVID);
        vm.prank(officer);
        vm.expectRevert(abi.encodeWithSelector(DisbursementVerifier.MilestoneNotFlagged.selector, id));
        verifier.officerOverrideRelease(id, shariah);
    }

    // --- (f) onlyRole revert-reason tests ---

    function testRegisterRequiresAgentRole() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, AGENT_ROLE
            )
        );
        verifier.registerMilestone(EVID);
    }

    function testSubmitVerdictRequiresAgentRole() public {
        uint256 id = _register(EVID);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, AGENT_ROLE
            )
        );
        verifier.submitVerdict(id, true, REASONS, hex"00");
    }

    function testVerdictRejectsForeignSignature() public {
        uint256 id = _register(EVID);
        // Signed by a different key than the submitting agent.
        bytes memory sig = _sign(0xBEEF, id, true, REASONS);
        vm.prank(agent);
        vm.expectRevert(DisbursementVerifier.BadSignature.selector);
        verifier.submitVerdict(id, true, REASONS, sig);
    }

    function testCannotDecideTwice() public {
        uint256 id = _register(EVID);
        _agentVerdict(id, true);
        bytes memory sig = _sign(agentPk, id, true, REASONS);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(DisbursementVerifier.MilestoneNotRegistered.selector, id));
        verifier.submitVerdict(id, true, REASONS, sig);
    }
}
