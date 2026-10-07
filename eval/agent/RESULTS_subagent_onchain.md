# End-to-end run with Claude Code subagents (local Anvil), compared with Kiro

**Local prototype of future work, on synthetic data.** The on-chain layer is the `DisbursementVerifier` prototype under `contracts/src/prototype/`. It is not part of the evaluated production contracts, not audited, and the status changes it makes do not move any funds.

## What was run
Same pipeline as the Kiro run (`RESULTS_kiro_onchain.md`), with the agent runtime swapped for Claude Code subagents:
1. The first 12 cases of `cases.jsonl` (C001 to C012), the same cases Kiro ran. Agents get documents only, never the truth label, and the identical system prompt.
2. One Haiku 4.5 subagent and one Sonnet 5.5 subagent, each judging all 12 cases and writing JSON verdicts. Self-reported model IDs: `claude-haiku-4-5-20251001` and `claude-sonnet-5-5`.
3. `e2e_subagent.py` starts a fresh local Anvil per model (evidence hashes must be unique per chain), deploys the verifier, and bridges each verdict with the existing `onchain_bridge.py`. A clean verdict registers evidence, posts a signed verdict and releases. Anything else flags for a human. No deny path is used.
4. Agent, officer and Shariah roles sit on distinct Anvil accounts. Only well-known local dev keys are used.

## Comparison
| agent | cases | tp_flagged | fn_false_release | fp_false_flag | tn_released | escalated | released_on_chain | flagged_on_chain | mis_releases | bridge_errors |
|---|---|---|---|---|---|---|---|---|---|---|
| Kiro (kiro-cli) | 12 | 4 | 0 | 0 | 8 | 0 | 8 | 4 | 0 | 0 |
| Claude Haiku 4.5 (subagent) | 12 | 4 | 0 | 0 | 8 | 0 | 8 | 4 | 0 | 0 |
| Claude Sonnet 5.5 (subagent) | 12 | 4 | 0 | 0 | 8 | 0 | 8 | 4 | 0 | 0 |

All three agents returned the same verdict on all 12 cases, so the on-chain outcomes are identical: 8 releases and 4 flags, with 0 false releases, 0 false flags, 0 escalations and 0 bridge errors. The 4 mismatches in these 12 cases are one vendor, two amount and one date case. 0 of the 12 are hard cases, so this subset cannot separate the models.

Where the runs differ:
- Kiro reported a mean latency of 7.91 s per case and 1.99 credits in total. Credits are not USD.
- The subagent runs report neither latency nor USD cost. A subagent batch handled all 12 cases in one context, so per-case latency is not defined.
- The 300-case subagent evaluation in `RESULTS.md` is the stronger accuracy evidence. This 12-case run shows the pipeline works end to end, not accuracy.

## Per-case outcome (identical for all three agents)
| case | type / subtype | truth | verdict | on-chain |
|---|---|---|---|---|
| C001 | genuine / plain | match | match | Released |
| C002 | genuine / distractor | match | match | Released |
| C003 | genuine / plain | match | match | Released |
| C004 | genuine / plain | match | match | Released |
| C005 | vendor_not_approved / clear | mismatch | mismatch | Flagged |
| C006 | genuine / plain | match | match | Released |
| C007 | genuine / plain | match | match | Released |
| C008 | amount_altered / clear | mismatch | mismatch | Flagged |
| C009 | amount_altered / clear | mismatch | mismatch | Flagged |
| C010 | genuine / plain | match | match | Released |
| C011 | date_outside_window / clear | mismatch | mismatch | Flagged |
| C012 | genuine / plain | match | match | Released |

## Limitations
- 12 easy synthetic cases. A perfect score here says nothing about real documents.
- Batching 12 cases in one subagent context allows cross-case influence. Kiro ran one process per case.
- Subagents had file tools and were told to read only their input file. Not independently verified.
- Verifier caveats from review: the Shariah "co-sign" in `officerOverrideRelease` only checks that a supplied address holds the role. The agent signature must equal `msg.sender`, so it adds no attestation beyond the role check. Neither affects these outcomes.
- Local Anvil only. No Sepolia transaction was made for this run.

## Reproduce
```
python3 e2e_subagent.py <label> <dir with batch_*.jsonl verdicts>
```
Raw outputs: `raw/subagent-*.jsonl`, `raw/onchain_subagent-*.jsonl`. Table: `e2e_comparison.csv`.
