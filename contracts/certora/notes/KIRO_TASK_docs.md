# Kiro task: run script + README for the local formal verification setup

Use only file read/write tools. Do not run shell commands. Only write under `contracts/certora/`.

## 1. `contracts/certora/run.sh` (bash, executable intent; I will chmod it)
- Usage: `./certora/run.sh [component ...]` from `contracts/`. With no args, run every `certora/confs/*.conf` in turn.
  - A component name `pool_Registry` maps to `certora/confs/autospec_pool_Registry.conf`.
- Runs each conf through `~/tools/bin/prove` (the local, memory-capped prover wrapper), writes the log to `certora/out/<component>.log`, and prints one summary line per conf from the log:
  - count of lines starting `Verified: `
  - count of lines starting `Violated: ` that do not contain `rule_not_vacuous` (real violations)
  - count of lines containing `Timeout`
- Exit non-zero if any conf has real violations.
- Strictly serial: never run two confs at once (the laptop has 15 GB RAM).

## 2. `contracts/certora/README.md`
Sections:
- What this is: local formal verification with the Certora Prover (open source, built locally, no cloud), following the AutoProver pipeline (mzf11125/AutoProver). The LLM phases are done by Claude Code and kiro instead of the API.
- Layout: confs/, specs/, specs/summaries/, harness/, properties/ (system analysis, properties, property→rule maps).
- Prerequisites: `~/tools/certora-target` (prover build), JDK 19 at `~/tools/jdk19`, solc8.17/solc8.24, z3/cvc5, and the `~/tools/bin/prove` wrapper. Give the build commands:
  - Gradle 7.2 runs on JDK 19
  - `./gradlew --no-daemon --no-build-cache copy-assets`
- Memory safety, which matters: the wrapper runs one job at a time, under a 5 GB systemd cgroup cap, with `--max_concurrent_rules 2`, a 2.5 GB heap and a single solver. Env overrides: `PROVE_MEM`, `PROVE_RULES`, `PROVE_XMX`. Say why: the default settings use every core and took a 15 GB laptop down.
- Summaries and assumptions, one line each:
  - SafeERC20 → direct token call (AutoProver's `OZ_SafeERC20.spec`) + DISPATCHER to MockUSDC
  - `isVerified` → ghost predicate
  - ERC-1155 receiver hooks → NONDET (no reentry)
  - `uri()` excluded
- The harness getters and why `getDeal`/`getReceiptMeta`/`getDealSnapshot`/`dealCount`/`mintedCount`/`burnedCount` are `public` (internal calls from harnesses; external self-calls confuse the prover).
- Reading results: `rule_not_vacuous` lines reported as "Violated" mean the rule is reachable (good).
- Bugs found so far: the repeat-investment receipt overwrite in `BondReceiptNFT.mint` (fixed; regression test `test/RepeatInvest.t.sol`).

## 3. `contracts/certora/REPORT.md` (template)
A table per component (Registry, Receipt, Vault): Property | Rule | Status. Fill the property titles from `properties/autospec_pool.properties.json` and the rule names from the `*.property_rules.json` files. Leave Status as `pending`.

When done, print "KIRO DONE 4" as the last line.
