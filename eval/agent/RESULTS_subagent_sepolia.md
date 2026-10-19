# Sepolia run: subagent verdicts bridged on-chain

**Prototype of future work on a public testnet, synthetic data, one burner key.** This says nothing about role separation. The verifier is the unaudited `DisbursementVerifier` prototype, and its status changes move no funds.

## What was run
- Network: Ethereum Sepolia (chain 11155111). Verifier: `0xbed93C018dba9684e78aAE3B0C76DC1C302dCf71`, deployed earlier by the Kiro run. It already held milestones 1 and 2 from that run, so this run produced milestones 3 to 14.
- Verdicts: the 12 Sonnet 5.5 subagent verdicts for cases C001 to C012 (`raw/subagent-sonnet.jsonl`), the same cases and the same documents-only prompt as the local run. Haiku 4.5 and Kiro gave identical verdicts on these 12, so only one set was sent. Sending a second set would revert on the evidence-hash uniqueness check.
- Per case, two transactions through `e2e_sepolia.py`: `registerMilestone` (evidence hash anchored) and `submitVerdict` (signed). A clean verdict releases and anything else flags for a human. No deny path is called.
- One account held every role, so the signer, officer and Shariah account are the same address.

## Result
| metric | value |
|---|---|
| cases | 12 |
| transactions | 24, all receipts status 0x1 |
| released on-chain | 8 |
| flagged for a human | 4 |
| mis-releases (released but truth is not match) | 0 |
| register gas, total / per tx | 5,734,548 / about 477,879 |
| verdict gas, total / per tx | 3,106,936 / about 258,911 |
| wallet nonce | 160 to 184 (24 transactions) |
| ETH spent | about 0.0000088 |

Every milestone status was read back from two independent RPC providers (Alchemy and Infura) and matched on both. Receipts were re-read from the RPC after the run.

| case | truth | milestone | on-chain status | register tx | verdict tx |
|---|---|---|---|---|---|
| C001 | match | 3 | Released | `0xb874973a78630d71ef18a3c09bddb03aa08d4f94ac1e9a9def56a2916999c247` | `0xb00e38e00a21c2fe21da2eeb1adc8aa841011c1f80e1ea346ceb7bb29d538fca` |
| C002 | match | 4 | Released | `0x5cb063ccbec7f1f3237eea53fc068fb68cdc0614381136e9c3d5b57ddb09239d` | `0xefadf530dc9894d3abf1a7a6050230f02dd756083bb5b1dab1e875179bc731db` |
| C003 | match | 5 | Released | `0x9f76fd9248610a9789676165d7c462dc62dd15e51abad53369ed109d9511c1a2` | `0x9aa513e13571a228eab77360f85625175a2c974c25772e1625ca31e0d6e23ee3` |
| C004 | match | 6 | Released | `0x366a81f770ccc96638beae1225cc22136166614c370af6b4f9358ee87ab470fa` | `0x04d45315c279f54380e8855e7742efa6c1115bfff0afd674fc991ecd76f4747f` |
| C005 | mismatch | 7 | Flagged | `0x65737b414d9bae2769e7ef2a9197242872336b0a5084df5324f2b1dbebdf081c` | `0x74543d9639a3b8975e8043b3d830587bce310e8e46f44c886f6e87e2e0ffb94e` |
| C006 | match | 8 | Released | `0x53699d1082715c6d8b4a83839031f7c37842e55d255b5ac60d64cd9b787cb304` | `0xdb698a285a8a842a746ec4cdc3fd8d783dd2f53258aebab22d1ddfe7da0b9bf6` |
| C007 | match | 9 | Released | `0x3114ef12f572eefa5a022e3fed1bc4519e0da89b14ae1ffa18bc042a79d8ce56` | `0x990d4eed36479e66277620b9dba86419c145e80fa020f0f4c20d9f54bcd50bc7` |
| C008 | mismatch | 10 | Flagged | `0xd6857dede08e08a43fc6c026afb050eb62e9a14dcfdc21849c4c974b486acedf` | `0x904a256de3e4c1f3635fdb067a6f8b1059218a301ac3113460afc9292d54a89a` |
| C009 | mismatch | 11 | Flagged | `0x1a5d3e023aa3a0c186ac47d3251b90488012a923dc581b24939ee5a5dcc9faba` | `0xe1cfad5a59cc68dec158dc63d9bcbb338e837049d38354e5cb703aec3befba2c` |
| C010 | match | 12 | Released | `0x4bbb8b6b6d7b262cf2ec801d7de46d42bf3c7c74593e216525c2ebfce7575fac` | `0xcad6ea93ea3e53b4e3fbcc3e8c4d8ca09123846f038d9af624c65bb9229da651` |
| C011 | mismatch | 13 | Flagged | `0xb05093cbc69778b1a27f4840324efbb8cda0cffbdafc8a7afabc1d67a486dfa9` | `0x842144e9667af950ea81adcecc2fdbe138d7864e96b53cc7194e700022a559e9` |
| C012 | match | 14 | Released | `0x83cbbbd4628c238f90449a99d4258974d3e820219f04325087abf4f460732d85` | `0xdc6eac17b3368f3c5420ec0c26166d79a4140940f3d333ff95a2e8784d205a46` |

## Comparison notes
- The local Anvil run with the same verdicts gave the same 8 releases and 4 flags, so the on-chain behaviour matches between Anvil and Sepolia.
- Gas here is measured on Sepolia. It is not comparable to the Foundry-model gas in `eval/RESULTS.md`, which already differs from Sepolia by a wide margin.

## Limitations
- 12 easy synthetic cases. Verdict quality is covered by the 300-case evaluation, not this run.
- Single key, so role separation is not exercised. Signature and "Shariah co-sign" caveats from the review of the verifier apply.
- The first Sonnet verdicts were produced by a subagent that could read files. Nothing checks that it read only its input.
- The burner key was shared in chat earlier and should be treated as compromised and rotated.

Raw data: `raw/sepolia_subagent-sonnet.jsonl`, `raw/sepolia_subagent-sonnet_verified.json`, `sepolia_subagent_txs.csv`. Reproduce with `e2e_sepolia.py sonnet` (needs `SEPOLIA_RPC_URL_2` and `TESTNET_PRIVATE_KEY` in the environment).
