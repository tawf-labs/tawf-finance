// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { ECDSA } from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title DisbursementVerifier (LOCAL PROTOTYPE — NOT PRODUCTION)
 *
 * @notice Local-Anvil prototype of the disbursement verification layer that the
 *         tawf.finance IEEE chapter describes as *designed but not yet
 *         implemented* and lists as the first item of future work (SS III-H,
 *         SS IV). It is NOT part of the production contract set, NOT audited,
 *         and MUST NOT be deployed to any testnet or mainnet. It exists only to
 *         demonstrate, on a disposable local chain, the on-chain half of the
 *         agent-driven milestone-release design.
 *
 * @dev Design fidelity to the chapter:
 *
 *      - Evidence hashes are anchored on submission with a UNIQUENESS check
 *        (reverts on reuse) — this closes a Table VII gap (evidence-hash
 *        uniqueness).
 *
 *      - The agent posts verdicts as SIGNED attestations (verdict + a hash of
 *        its reasons). A CLEAN verdict releases a tranche; a NOT-CLEAN verdict
 *        flags the milestone for a HUMAN. The agent never writes an adverse,
 *        irreversible outcome.
 *
 *      - Asymmetric automation is enforced STRUCTURALLY: there is NO
 *        agent-callable deny / default / reject function anywhere in this
 *        contract. The agent can only release (on a clean verdict) or flag
 *        (escalate to a human). Denying / defaulting is reserved for HUMANS
 *        (OFFICER_ROLE / SHARIAH_ROLE) via officerOverride*, closing a second
 *        Table VII gap (default/deny reserved for humans + role separation).
 *
 *      - Roles are separated per the chapter's regulation role split. On Anvil
 *        each role is granted to a DISTINCT account to demonstrate separation.
 */
contract DisbursementVerifier is AccessControl {
    using ECDSA for bytes32;

    /// @notice The automated agent runtime. May anchor milestones, submit
    ///         signed verdicts, release on a clean verdict, or flag for a human.
    ///         It can NEVER deny, default, or reject.
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    /// @notice A human disbursement officer. The only role (with SHARIAH_ROLE)
    ///         that may act on a flagged milestone.
    bytes32 public constant OFFICER_ROLE = keccak256("OFFICER_ROLE");

    /// @notice A human Shariah supervisor. Co-signs the officer override.
    bytes32 public constant SHARIAH_ROLE = keccak256("SHARIAH_ROLE");

    enum Status {
        None, // 0 — milestone id never registered
        Registered, // 1 — evidence anchored, awaiting a verdict
        Released, // 2 — clean agent verdict released the tranche
        Flagged, // 3 — not-clean agent verdict; awaiting a human
        OverrideReleased, // 4 — a human officer released a flagged milestone
        Denied // 5 — a human officer denied a flagged milestone (HUMAN-ONLY)
    }

    struct Milestone {
        bytes32 evidenceHash; // anchored on registration (unique)
        bytes32 reasonsHash; // hash of the agent's reasons, set on verdict
        address agent; // the agent account that signed the verdict
        bool clean; // the agent's verdict
        Status status;
        uint256 registeredAt;
        uint256 decidedAt;
    }

    uint256 public milestoneCount;
    mapping(uint256 => Milestone) private _milestones;

    /// @notice Guards evidence-hash uniqueness across all milestones.
    mapping(bytes32 => bool) public evidenceSeen;

    event MilestoneRegistered(uint256 indexed milestoneId, bytes32 indexed evidenceHash, address indexed by);
    event TrancheReleased(uint256 indexed milestoneId, address indexed agent, bytes32 reasonsHash);
    event FlaggedForHuman(uint256 indexed milestoneId, address indexed agent, bytes32 reasonsHash);
    event OfficerOverrideReleased(uint256 indexed milestoneId, address indexed officer);
    event OfficerDenied(uint256 indexed milestoneId, address indexed officer);

    error EvidenceAlreadyAnchored(bytes32 evidenceHash);
    error UnknownMilestone(uint256 milestoneId);
    error MilestoneNotRegistered(uint256 milestoneId);
    error MilestoneNotFlagged(uint256 milestoneId);
    error BadSignature();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Anchor an evidence hash and open a new milestone. The hash must be
     *         globally unique: a second registration of the same hash reverts.
     * @param evidenceHash SHA-256 (or keccak) digest of the assembled evidence.
     * @return milestoneId The id of the new milestone.
     */
    function registerMilestone(bytes32 evidenceHash) external onlyRole(AGENT_ROLE) returns (uint256 milestoneId) {
        if (evidenceSeen[evidenceHash]) revert EvidenceAlreadyAnchored(evidenceHash);
        evidenceSeen[evidenceHash] = true;
        milestoneId = ++milestoneCount;
        _milestones[milestoneId] = Milestone({
            evidenceHash: evidenceHash,
            reasonsHash: bytes32(0),
            agent: address(0),
            clean: false,
            status: Status.Registered,
            registeredAt: block.timestamp,
            decidedAt: 0
        });
        emit MilestoneRegistered(milestoneId, evidenceHash, msg.sender);
    }

    /**
     * @notice Submit a SIGNED agent verdict for a registered milestone.
     *         A clean verdict releases the tranche; a not-clean verdict flags
     *         the milestone for a human. There is intentionally NO path here (or
     *         anywhere) for the agent to deny or default a milestone.
     * @param milestoneId The milestone being decided.
     * @param clean       The agent's verdict (true = all checks pass).
     * @param reasonsHash Hash of the agent's human-readable reasons.
     * @param signature   The agent's signature over
     *                     keccak256(milestoneId, clean, reasonsHash, address(this), chainid),
     *                     as an Ethereum signed message. Must recover to msg.sender.
     */
    function submitVerdict(uint256 milestoneId, bool clean, bytes32 reasonsHash, bytes calldata signature)
        external
        onlyRole(AGENT_ROLE)
    {
        Milestone storage m = _milestones[milestoneId];
        if (m.status == Status.None) revert UnknownMilestone(milestoneId);
        if (m.status != Status.Registered) revert MilestoneNotRegistered(milestoneId);

        bytes32 digest = verdictDigest(milestoneId, clean, reasonsHash);
        address signer = MessageHashUtils.toEthSignedMessageHash(digest).recover(signature);
        if (signer != msg.sender) revert BadSignature();

        m.reasonsHash = reasonsHash;
        m.agent = msg.sender;
        m.clean = clean;
        m.decidedAt = block.timestamp;

        if (clean) {
            m.status = Status.Released;
            emit TrancheReleased(milestoneId, msg.sender, reasonsHash);
        } else {
            m.status = Status.Flagged;
            emit FlaggedForHuman(milestoneId, msg.sender, reasonsHash);
        }
    }

    /**
     * @notice Human officer override: release a FLAGGED milestone. Requires
     *         OFFICER_ROLE and co-sign by a SHARIAH_ROLE human. This is the
     *         chapter's officer-override resolve-a-flag path.
     * @param milestoneId The flagged milestone to release.
     * @param shariahSupervisor A SHARIAH_ROLE account co-signing the override.
     */
    function officerOverrideRelease(uint256 milestoneId, address shariahSupervisor) external onlyRole(OFFICER_ROLE) {
        _requireFlagged(milestoneId);
        _checkRole(SHARIAH_ROLE, shariahSupervisor);
        _milestones[milestoneId].status = Status.OverrideReleased;
        _milestones[milestoneId].decidedAt = block.timestamp;
        emit OfficerOverrideReleased(milestoneId, msg.sender);
    }

    /**
     * @notice Human-only deny of a FLAGGED milestone. Reserved for OFFICER_ROLE
     *         with a SHARIAH_ROLE co-sign. Deliberately there is NO agent path
     *         to this outcome — denying/defaulting is a human decision.
     */
    function officerDeny(uint256 milestoneId, address shariahSupervisor) external onlyRole(OFFICER_ROLE) {
        _requireFlagged(milestoneId);
        _checkRole(SHARIAH_ROLE, shariahSupervisor);
        _milestones[milestoneId].status = Status.Denied;
        _milestones[milestoneId].decidedAt = block.timestamp;
        emit OfficerDenied(milestoneId, msg.sender);
    }

    /// @notice The digest an agent must sign for `submitVerdict` (domain-bound).
    function verdictDigest(uint256 milestoneId, bool clean, bytes32 reasonsHash) public view returns (bytes32) {
        return keccak256(abi.encode(milestoneId, clean, reasonsHash, address(this), block.chainid));
    }

    function getMilestone(uint256 milestoneId) external view returns (Milestone memory) {
        if (_milestones[milestoneId].status == Status.None) revert UnknownMilestone(milestoneId);
        return _milestones[milestoneId];
    }

    function statusOf(uint256 milestoneId) external view returns (Status) {
        return _milestones[milestoneId].status;
    }

    function _requireFlagged(uint256 milestoneId) internal view {
        Milestone storage m = _milestones[milestoneId];
        if (m.status == Status.None) revert UnknownMilestone(milestoneId);
        if (m.status != Status.Flagged) revert MilestoneNotFlagged(milestoneId);
    }
}
