/* ============================================================================
 * autospec_deposito_PoolLedger.spec: DepositoPoolLedger (via the read-only
 * DepositoPoolLedgerHarness). The ledger is the ILedgerAnchor of a regional
 * Deposito Pool series. The operator lists banks and posts balances, profit
 * and maturity, each post opening an epoch of recorded leaves.
 *
 * Bank-array loops are bounded by loop_iter 3 with optimistic_loop, so the
 * sum and array rules cover pools of up to 3 banks per call and per scan.
 * ========================================================================== */

methods {
    function operator() external returns (address) envfree;
    function seriesId() external returns (bytes32) envfree;
    function ledgerChainId() external returns (uint256) envfree;
    function snapshotAt() external returns (uint64) envfree;
    function totalBalance() external returns (uint256) envfree;
    function epochs() external returns (uint256) envfree;
    function reserveEpoch() external returns (uint256) envfree;
    function balanceOf(bytes32) external returns (uint256) envfree;
    function bankIdsLen() external returns (uint256) envfree;
    function bankIdAt(uint256) external returns (bytes32) envfree;
    function isListed(bytes32) external returns (bool) envfree;
    function nameHash(bytes32) external returns (bytes32) envfree;
    function refHash(bytes32) external returns (bytes32) envfree;
    function sumBalances() external returns (uint256) envfree;
    function reserveLeafFor(bytes32, uint256, uint256) external returns (bytes32) envfree;
    function bankLeafFor(bytes32, uint256, uint256) external returns (bytes32) envfree;
    function profitLeafFor(bytes32, uint256, uint256) external returns (bytes32) envfree;
    function verify(uint256, bytes32, bytes32[]) external returns (bool) envfree;
    function kindReserve() external returns (bytes32) envfree;
    function kindBank() external returns (bytes32) envfree;
    function kindProfit() external returns (bytes32) envfree;
    function kindMaturity() external returns (bytes32) envfree;
}

/// The four leaf kinds are keccak256 of four different tag strings, so they differ. The prover
/// does not evaluate keccak of constants, so the rules that compare leaves of different kinds
/// state this once (assuming no keccak collision, as the prover does everywhere).
function kindsDistinct() {
    require kindReserve() != kindBank() && kindReserve() != kindProfit() && kindReserve() != kindMaturity();
    require kindBank() != kindProfit() && kindBank() != kindMaturity() && kindProfit() != kindMaturity();
}

definition isPost(method f) returns bool =
    f.selector == sig:postReserve(uint64, bytes32[], uint256[]).selector
    || f.selector == sig:postProfit(uint32, bytes32[], uint256[]).selector
    || f.selector == sig:postMaturity(uint64, uint32, uint256).selector;

// ===========================================================================
// Access control
// ===========================================================================

/// @title only the operator can change state
rule onlyOperatorMutates(method f, env e, calldataarg args) filtered { f -> !f.isView } {
    address op = operator();
    f@withrevert(e, args);
    assert !lastReverted => e.msg.sender == op, "a non-operator changed ledger state";
}

/// @title the operator changes only through transferOperator
rule operatorOnlyViaTransfer(method f, env e, calldataarg args) {
    address before = operator();
    f(e, args);
    assert operator() != before => f.selector == sig:transferOperator(address).selector,
        "operator changed outside transferOperator";
}

/// @title the operator is never the zero address
invariant operatorNonZero() operator() != 0;

// ===========================================================================
// Reserve post
// ===========================================================================

/// @title postReserve: totals, snapshot, epoch and the recorded reserve leaf
rule postReserveRecordsTotalAndLeaf(env e, uint64 atTs, bytes32[] ids, uint256[] bals, bytes32[] proof) {
    uint256 epochBefore = epochs();
    uint64 snapBefore = snapshotAt();
    uint256 ep = postReserve(e, atTs, ids, bals);

    assert ep == epochBefore, "returned epoch is not the opened epoch";
    assert epochs() == epochBefore + 1, "epochs did not advance by one";
    assert reserveEpoch() == ep, "reserveEpoch not updated";
    assert snapshotAt() == atTs, "snapshotAt not the posted time";
    assert atTs >= snapBefore, "snapshot moved backwards";
    assert totalBalance() == sumBalances(), "total differs from the sum of bank balances";
    assert verify(ep, reserveLeafFor(seriesId(), atTs, totalBalance()), proof),
        "reserve leaf with the total and snapshot was not recorded";
}

/// @title a reserve post records no reserve leaf except (own series, snapshot, total)
rule postReserveOnlyOwnSeriesLeaf(env e, uint64 atTs, bytes32[] ids, uint256[] bals,
                                  bytes32 subject, uint256 a, uint256 b, bytes32[] proof) {
    kindsDistinct();
    requireInvariant noLeafInFutureEpoch(epochs(), reserveLeafFor(subject, a, b), proof);
    uint256 ep = postReserve(e, atTs, ids, bals);
    assert verify(ep, reserveLeafFor(subject, a, b), proof)
        => (subject == seriesId() && a == to_mathint(atTs) && b == totalBalance()),
        "a reserve leaf for another series or with other numbers was recorded";
}

/// @title only a reserve post can record a reserve leaf
rule onlyReserveRecordsReserveLeaf(method f, env e, calldataarg args,
                                   bytes32 subject, uint256 a, uint256 b, bytes32[] proof) filtered {
    f -> isPost(f) && f.selector != sig:postReserve(uint64, bytes32[], uint256[]).selector
} {
    kindsDistinct();
    requireInvariant noLeafInFutureEpoch(epochs(), reserveLeafFor(subject, a, b), proof);
    uint256 ep = epochs();
    f(e, args);
    assert !verify(ep, reserveLeafFor(subject, a, b), proof),
        "a profit or maturity post recorded a reserve leaf";
}

/// @title only a profit post records a profit leaf, and only for its own series
rule profitLeafOnlyOwnSeries(env e, uint32 period, bytes32[] ids, uint256[] profits,
                             bytes32 subject, uint256 a, uint256 b, bytes32[] proof) {
    kindsDistinct();
    requireInvariant noLeafInFutureEpoch(epochs(), profitLeafFor(subject, a, b), proof);
    uint256 ep; uint256 total;
    ep, total = postProfit(e, period, ids, profits);
    assert verify(ep, profitLeafFor(subject, a, b), proof)
        => (subject == seriesId() && a == to_mathint(period) && b == total),
        "a profit leaf for another series or with other numbers was recorded";
}

// ===========================================================================
// Epochs and leaves
// ===========================================================================

/// @title every post advances epochs by exactly one, every other call leaves it alone
rule epochsStrictlyIncreaseOnPost(method f, env e, calldataarg args) {
    uint256 before = epochs();
    f(e, args);
    assert isPost(f) => epochs() == before + 1, "a post did not advance epochs by one";
    assert !isPost(f) => epochs() == before, "a non-post call changed epochs";
}

/// @title snapshotAt never decreases
rule snapshotNeverDecreases(method f, env e, calldataarg args) {
    uint64 before = snapshotAt();
    f(e, args);
    assert snapshotAt() >= before, "snapshotAt decreased";
}

/// @title a recorded leaf stays verified
rule leavesNeverRemoved(method f, env e, calldataarg args, uint256 ep, bytes32 leaf, bytes32[] proof) {
    require verify(ep, leaf, proof);
    f(e, args);
    assert verify(ep, leaf, proof), "a recorded leaf stopped verifying";
}

/// @title the proof argument is ignored, a leaf is in an epoch or not
rule verifyIgnoresProof(uint256 ep, bytes32 leaf, bytes32[] p1, bytes32[] p2) {
    assert verify(ep, leaf, p1) == verify(ep, leaf, p2), "verify depends on the proof";
}

/// @title no leaf verifies at an epoch that has not been opened
invariant noLeafInFutureEpoch(uint256 ep, bytes32 leaf, bytes32[] proof)
    ep >= epochs() => !verify(ep, leaf, proof);

// ===========================================================================
// Banks
// ===========================================================================

/// @title a listed bank stays listed with the same name and account reference
rule bankIsPermanent(method f, env e, calldataarg args, bytes32 id) {
    require isListed(id);
    bytes32 n = nameHash(id);
    bytes32 r = refHash(id);
    f(e, args);
    assert isListed(id), "a bank was unlisted";
    assert nameHash(id) == n, "a bank name changed";
    assert refHash(id) == r, "a bank account reference changed";
}

/// @title addBank rejects the zero id and a repeated id
rule addBankRejectsZeroAndDuplicates(env e, bytes32 id, string name, string ref) {
    bool wasListed = isListed(id);
    addBank@withrevert(e, id, name, ref);
    assert id == to_bytes32(0) => lastReverted, "zero bank id accepted";
    assert wasListed => lastReverted, "duplicate bank id accepted";
}

/// @title every id in the bank array is listed, non-zero and appears once
invariant bankArrayListed(uint256 i)
    i < bankIdsLen() => (isListed(bankIdAt(i)) && bankIdAt(i) != to_bytes32(0));

invariant bankArrayUnique(uint256 i, uint256 j)
    (i < j && j < bankIdsLen()) => bankIdAt(i) != bankIdAt(j) {
    preserved {
        requireInvariant bankArrayListed(i);
        requireInvariant bankArrayListed(j);
    }
}

/// @title an unlisted id never holds a balance
invariant unlistedHasNoBalance(bytes32 id)
    !isListed(id) => balanceOf(id) == 0;

/// @title totalBalance is the sum of the bank balances, at all times
invariant totalMatchesSum()
    totalBalance() == sumBalances() {
    preserved addBank(bytes32 id, string n, string r) with (env e) {
        requireInvariant unlistedHasNoBalance(id);
    }
}

/// @title a post cannot reference an unlisted bank
rule postsRejectUnlistedBanks(env e, uint64 atTs, bytes32[] ids, uint256[] vals, uint256 k) {
    require k < ids.length;
    require !isListed(ids[k]);
    postReserve@withrevert(e, atTs, ids, vals);
    assert lastReverted, "postReserve accepted an unlisted bank";
    postProfit@withrevert(e, 1, ids, vals);
    assert lastReverted, "postProfit accepted an unlisted bank";
}
