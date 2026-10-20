# Local formal verification (Certora Prover)

## What this is

This directory holds the **local formal verification** setup for the tawf.finance
financing pool contracts (`DealRegistry`, `BondReceiptNFT`, `RedemptionVault`). It
runs the **Certora Prover** — the open-source prover, **built locally**, with **no
cloud** and no Certora API key. The property/spec workflow follows the
**AutoProver** pipeline ([mzf11125/AutoProver](https://github.com/mzf11125/AutoProver)):
system analysis → properties → CVL specs → confs → runs. The LLM phases of that
pipeline (system analysis, property mining, spec drafting) are done here by
**Claude Code and kiro** instead of the hosted API.

Everything in this tree is self-contained: the specs verify against the Solidity
sources under `contracts/src/` (through thin harnesses), and the prover binary is
the one you build yourself under `~/tools`.

## Layout

```
certora/
├── confs/               # one *.conf per component (autospec_pool_<C>.conf)
├── specs/               # CVL specs (autospec_pool_<C>.spec)
│   └── summaries/       # shared CVL summaries (SafeERC20, pool helpers)
├── harness/             # Solidity harnesses exposing internal state as getters
├── properties/          # system analysis + properties + property→rule maps
│   ├── pool.system.md                      # system analysis
│   ├── autospec_pool.properties.json       # mined properties (titles + descriptions)
│   └── autospec_pool_<C>.property_rules.json  # property → CVL rule name map
├── out/                 # run.sh writes <component>.log here (generated)
├── run.sh               # serial driver over confs/
├── README.md            # this file
└── REPORT.md            # property × rule × status table (template)
```

## Prerequisites

The driver expects a locally built prover and toolchain under `~/tools`:

- `~/tools/certora-target` — the built Certora Prover (the prover's build output).
- `~/tools/jdk19` — JDK 19, used to build and run the prover.
- `solc8.17` and `solc8.24` on `PATH` — the pool contracts compile with
  `solc8.24` (T-REX/ONCHAINID files use `solc8.17`).
- `z3` and `cvc5` on `PATH` — the SMT solvers.
- `~/tools/bin/prove` — the local, **memory-capped** wrapper that `run.sh` calls
  (see *Memory safety* below).

### Building the prover

Gradle 7.2 is run on JDK 19:

```bash
# from the prover source checkout, with JAVA_HOME pointing at ~/tools/jdk19
export JAVA_HOME="$HOME/tools/jdk19"
./gradlew --no-daemon --no-build-cache copy-assets
```

`--no-daemon` and `--no-build-cache` keep the build from holding memory between
invocations, and `copy-assets` assembles the runnable prover into the target
directory that `~/tools/certora-target` points at.

## Memory safety (this matters)

The default Certora settings use **every core** and spin up multiple solvers per
rule. On this 15 GB laptop that took the machine **down**. The `~/tools/bin/prove`
wrapper exists to prevent that, and `run.sh` is **strictly serial** on top of it —
it never starts a second conf while one is running.

The wrapper runs **one job at a time** under a **5 GB systemd cgroup cap**, with:

- `--max_concurrent_rules 2` — at most two rules in flight,
- a **2.5 GB JVM heap** (`-Xmx`),
- a **single solver** (not the full solver portfolio).

Environment overrides (read by the wrapper):

| Var | Meaning | Default |
|---|---|---|
| `PROVE_MEM`   | systemd cgroup memory cap            | `5G`   |
| `PROVE_RULES` | value for `--max_concurrent_rules`   | `2`    |
| `PROVE_XMX`   | JVM max heap                         | `2.5g` |

Keep jobs serial. Two concurrent proofs can each climb past the per-job cap at the
same moment and exhaust system RAM before the cgroup reclaims it.

## Running

From `contracts/`:

```bash
./certora/run.sh                 # every certora/confs/*.conf, serially
./certora/run.sh pool_Registry   # just confs/autospec_pool_Registry.conf
./certora/run.sh Registry Vault  # several, one after another
```

Each run writes `certora/out/<component>.log` and prints one summary line:

```
=== pool_Registry: verified=<n> violated=<n> timeouts=<n> (log: out/pool_Registry.log)
```

where the counts come straight from the log:

- `verified` = lines starting `Verified: `,
- `violated` = lines starting `Violated: ` that **do not** contain
  `rule_not_vacuous` (the real violations),
- `timeouts` = lines containing `Timeout`.

`run.sh` exits non-zero if any conf has real violations.

## Summaries and assumptions

- **SafeERC20 → direct token call** — AutoProver's `specs/summaries/OZ_SafeERC20.spec`
  summarises `SafeERC20` as a direct ERC-20 call, dispatched (`DISPATCHER`) to
  `MockUSDC`.
- **`isVerified` → ghost predicate** — the identity registry's `isVerified(addr)`
  is modelled as an uninterpreted ghost predicate rather than the full registry.
- **ERC-1155 receiver hooks → NONDET** — `onERC1155Received` / `...BatchReceived`
  are `NONDET`, i.e. no reentrancy through receiver callbacks.
- **`uri()` excluded** — the metadata `uri()` getter is excluded from verification
  (string formatting, no state effect).

## Munged OpenZeppelin

`certora/munge.sh` copies `lib/openzeppelin-contracts/contracts` to
`certora/munged` (which is **gitignored**) and patches the spots where OZ drops to
inline assembly that the prover cannot follow, rewriting them in plain Solidity —
this is the munging step from the Certora guide, section 1.4. Specifically it
replaces the inline assembly in:

- `ERC1155._asSingletonArrays`, and
- the **five** `Arrays.unsafeMemoryAccess` memory overloads.

The confs then map `openzeppelin-contracts` to this munged copy instead of `lib/`,
so verification builds against the plain-Solidity version. **Production builds are
unaffected** — `forge build`/`forge test` and the deploy scripts still use the
unmodified `lib/openzeppelin-contracts`.

The plain-Solidity rewrite adds an array **bounds check** that the assembly
`unsafeMemoryAccess` deliberately skips. This is sound for our purposes: OZ only
ever calls these helpers with in-range indexes, so the added check can never fire
in the modelled paths — it just makes the access analyzable by the prover.

`run.sh` builds `certora/munged` once, before the first `prove` run, if the
directory is missing.

## Harness getters

The harnesses in `harness/` expose internal state the specs reason over. The
getters — `getDeal`, `getReceiptMeta`, `getDealSnapshot`, `dealCount`,
`mintedCount`, `burnedCount` — are declared **`public`** on purpose. The harnesses
call them internally from other harness code, and marking them `public` lets those
be plain internal calls; declaring them `external` forces external self-calls,
which confuse the prover's call-graph/storage reasoning. `public` gives both the
internal call path (for the harness) and the external ABI entry (for the spec).

## Reading results

Lines reported as **"Violated"** whose rule name is a `rule_not_vacuous` check are
**good**: they are the sanity/vacuity witnesses, and a "violation" there means the
rule is **reachable** (not vacuously true). `run.sh` already excludes these from the
real-violation count. A genuine problem is a `Violated: ` line that is *not*
`rule_not_vacuous`.

## Bugs found so far

- **Repeat-investment receipt overwrite** in `BondReceiptNFT.mint`: a second
  investment by the same investor into the same deal overwrote the earlier
  receipt's recorded principal instead of accumulating it. **Fixed**, with a
  regression test at `test/RepeatInvest.t.sol`.
