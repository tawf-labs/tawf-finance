# Reference verification agent on synthetic evidence

**This is a reference prototype evaluated on synthetic data. It is not a deployed system and it is not connected to on-chain tranche release.** The contracts in this repo do not implement tranche verification, so this result and the contract results in `eval/RESULTS.md` are separate.

## Setup
- 300 synthetic cases from `generate_cases.py` (seed 20261007, identical output on re-run). 180 genuine (120 plain, 60 distractors) and 120 mismatches.
- Each case has four documents: approved proposal, invoice, bank transfer statement and a ledger of earlier accepted invoices. Domain is micro-trade financing in Rupiah.
- Mismatch types: altered amount (20 clear, 10 under 5% off), duplicate or reused invoice (20 exact, 10 near-duplicate with one digit changed in the invoice number), vendor not approved (20), date outside tranche window (20), item category not matching the akad purpose (20).
- Distractors are valid cases that look suspicious: same vendor as an earlier invoice with different items and total, invoice dated exactly on a window edge, and total equal to the ceiling. Vendor name casing and date formats vary.
- Agents: Claude Code subagents, one per batch of 10 independent cases, 30 batches per model. Models selected as `haiku` and `sonnet`. Self-reported IDs were `claude-haiku-4-5-20251001` and `claude-sonnet-5-5`. One run per model, no repeats.
- Agents read a label-free batch file and wrote JSON lines. Scoring is in `analyze.py` and `ingest_subagent.py`.

## Prompt (identical for both models)
```
You are a disbursement verification agent for an Islamic financing platform. A financing tranche has been paid to a vendor. Decide whether the submitted evidence supports the payment.

You receive four documents: the approved proposal, a vendor invoice, a bank transfer statement, and the ledger of invoices already accepted for earlier tranches.

Check all of the following:
1. Amount: the bank transfer amount must equal the invoice total, and must not exceed the tranche ceiling.
2. Duplicate or reuse: the invoice must not repeat an invoice already in the ledger. Treat an invoice as a reuse if the same vendor, date, items and total appear in the ledger, even when the invoice number differs slightly. A repeat purchase from the same vendor with different items, date or total is legitimate.
3. Vendor: the invoice vendor and the transfer beneficiary must both be on the approved vendor list. Ignore differences in capitalisation or word order only.
4. Date: the invoice date must fall inside the tranche window, edges included. The transfer should be at or shortly after the invoice date.
5. Purpose: every invoice item must fit the akad purpose in the approved proposal.

Decide one of:
- "match": all checks pass.
- "mismatch": at least one check fails.
- "escalate": you cannot decide from these documents alone, for example when evidence is missing, contradictory in a way you cannot resolve, or a failed check is within rounding or ambiguity. Escalating sends the case to a human reviewer. Use it only when genuinely unsure, not as a default.

Reply with one JSON object and nothing else:
{"decision": "match" | "mismatch" | "escalate", "failed_checks": [subset of "amount", "duplicate", "vendor", "date", "purpose"], "reason": "one sentence"}
```

## Results
Mismatch is the positive class. Escalation was never used by either model, so decided-only and escalation-as-flag views coincide.

| model | cases | escalated | escalation_rate | tp_mismatch_flagged | fn_false_release | fp_false_flag | tn_match_released | precision_decided | recall_decided | f1_decided | false_release_rate | false_flag_rate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-4-5-20251001 | 300 | 0 | 0.0% | 120 | 0 | 1 | 179 | 0.992 | 1.000 | 0.996 | 0.0% | 0.6% |
| claude-sonnet-5-5 | 300 | 0 | 0.0% | 120 | 0 | 0 | 180 | 1.000 | 1.000 | 1.000 | 0.0% | 0.0% |

Per mismatch type (flagged as mismatch):

| model | mismatch_type | subtype | cases | flagged_mismatch | escalated | false_release | flag_rate |
|---|---|---|---|---|---|---|---|
| claude-haiku-4-5-20251001 | amount_altered | clear | 20 | 20 | 0 | 0 | 100.0% |
| claude-haiku-4-5-20251001 | amount_altered | hard_under_5pct | 10 | 10 | 0 | 0 | 100.0% |
| claude-haiku-4-5-20251001 | category_mismatch | clear | 20 | 20 | 0 | 0 | 100.0% |
| claude-haiku-4-5-20251001 | date_outside_window | clear | 20 | 20 | 0 | 0 | 100.0% |
| claude-haiku-4-5-20251001 | duplicate_invoice | exact_reuse | 20 | 20 | 0 | 0 | 100.0% |
| claude-haiku-4-5-20251001 | duplicate_invoice | hard_near_duplicate | 10 | 10 | 0 | 0 | 100.0% |
| claude-haiku-4-5-20251001 | vendor_not_approved | clear | 20 | 20 | 0 | 0 | 100.0% |
| claude-sonnet-5-5 | amount_altered | clear | 20 | 20 | 0 | 0 | 100.0% |
| claude-sonnet-5-5 | amount_altered | hard_under_5pct | 10 | 10 | 0 | 0 | 100.0% |
| claude-sonnet-5-5 | category_mismatch | clear | 20 | 20 | 0 | 0 | 100.0% |
| claude-sonnet-5-5 | date_outside_window | clear | 20 | 20 | 0 | 0 | 100.0% |
| claude-sonnet-5-5 | duplicate_invoice | exact_reuse | 20 | 20 | 0 | 0 | 100.0% |
| claude-sonnet-5-5 | duplicate_invoice | hard_near_duplicate | 10 | 10 | 0 | 0 | 100.0% |
| claude-sonnet-5-5 | vendor_not_approved | clear | 20 | 20 | 0 | 0 | 100.0% |

- Haiku produced one false flag, C137: a valid purchase of buttons (kancing) for a sewing workshop was judged not to fit the equipment purchase purpose. Sonnet had no errors.
- Both models caught all 10 hard amount cases and all 10 near-duplicates.
- Escalations: 0 of 300 for both models.

## Cost and latency
Not measured. Subagent runs give no per-call API usage or latency. Harness-reported subagent token totals were roughly 45 to 55 thousand per batch, about 1.4 to 1.5 million per model, and include harness overhead. A USD cost per case from this run would be a guess, so none is given. `run_agent.py` measures these directly through the API and was tested only against an offline stub.

## Limitations
- Synthetic evidence is much easier than real documents. There are no scans, photos, OCR errors, forged layouts or adversarial wording. Near-ceiling scores here should not be read as field accuracy.
- Results depend on this prompt and these models. One run each, so no variance estimate. With 300 cases a single error moves a rate by 0.3 points.
- Batching 10 cases per agent means an agent saw other cases in its context. Cases were independent and the prompt said to treat them so, but cross-case influence is not ruled out.
- Subagents had file tools. They were told to read only their batch file. The labelled `cases.jsonl` is in the repo, and no check confirmed it was never opened.
- Subagent runs add the harness system prompt and tool definitions, so this is not a clean API call. Temperature was not controlled and model IDs are self-reported.
- Not a deployed system, no integration with the contracts, and no human reviewer was modelled.
