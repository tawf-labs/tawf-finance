# Hand-off: formal verification work in progress

Branch `feat/formal-verification` in **tawf-finance**, **tawf-network** and **tawf-gold-bsi**. Nothing is merged to `main` yet.

Read first: `certora/REPORT.md` (results, bugs found, assumptions) and `certora/LESSONS.md` (13 pitfalls we hit; read before editing any spec). Copies of `LESSONS.md` live in each repo's `certora/`.

## Toolchain (local, no Certora cloud)

- **Certora Prover**, built from source:
  - `git clone --recurse-submodules https://github.com/Certora/CertoraProver ~/tools/CertoraProver`
  - Gradle 7.2 has to run on **JDK 19**: `JAVA_HOME=<jdk19> ./gradlew --no-daemon --no-build-cache copy-assets`, with `CERTORA=~/tools/certora-target`
  - If a submodule URL is SSH, run `git -c url."https://github.com/".insteadOf="git@github.com:" submodule update --init`
- **Into `$CERTORA`:** z3, cvc5, `solc8.17`, `solc8.24`.
- **Python deps:** `certora_cli_requirements.txt` from `CertoraProver/scripts`, installed in a venv (we used `~/Documents/Github/AutoProver/.venv`).
- **Wrapper `~/tools/bin/prove`** (copy below). One run at a time, under a hard memory cap. The defaults use every core and crashed a 15 GB laptop.
  ```bash
  exec flock ~/tools/prover.lock systemd-run --user --scope --quiet -p MemoryMax=5G -p MemorySwapMax=0 \
    python3 "$CERTORA/certoraRun.py" "$@" --max_concurrent_rules 2 \
    --java_args "-Xmx2500m -Dcvt.default.parallelism=2 -Djava.awt.headless=true" --prover_args "-solver z3"
  ```
- **Before the first run in a repo:** `./certora/munge.sh` (a verification-only OpenZeppelin copy without inline assembly).

**Run a spec:** `cd contracts && ~/tools/bin/prove certora/confs/<name>.conf`. Real failures are `Failed on <rule>:` lines, excluding `rule_not_vacuous`.

## Status

| Repo / spec | State |
|---|---|
| tawf-finance pool Registry, Vault | proven |
| tawf-finance pool Receipt | proven except 4 counting invariants (`redeemedHasPrincipal`, `redeemedCountEqualsBurned`, `liveAndRedeemedEqualMinted`, `burnedNeverExceedsMinted`); the ghosts mirror principal + status but the induction still fails on mint / transfer / burn. Next step: read the counterexample in the run's `Reports/` |
| tawf-finance sukuk Distributor, both ProfitAccumulators, deposito Series | proven (sukuk has 1 documented hardening gap) |
| tawf-finance deposito SandboxReal (real 0.8.17 module) | proven (12 checks) |
| tawf-finance mutants `certora/mutants/M1–M9` | written before the contract fixes; regenerate from current `src/`, then `./certora/mutate.sh` |
| tawf-gold-bsi tBSI Controller | proven except the documented attestation-freshness gap |
| tawf-network l2 LeafLog | proven (12 checks): append-only, leafCount monotonic, writer-only |
| tawf-network l2 LedgerAnchor | proven (40 checks): epochs and nextIndex monotonic, roots never overwritten, relayer-only anchoring, verify stable once true (Merkle soundness assumed) |
| tawf-network l3 ReserveLedger | 29 proven; `maturedSeriesStaysMatured` needs an invariant `matured ⇒ registeredAt != 0` (unreachable pre-state) |
| tawf-network l3 SukukLedger, PoolLedger | CVL compile errors, listed in `certora/out/*.errors.txt` (gitignored; rerun to regenerate) |
| tawf-network l3 ServicingLedger, InstitutionRegistry, DocumentRegistry, ShariahAttestations | specs not written yet; harnesses exist |

## Contract changes on this branch (all tests pass: tawf-finance 160, tawf-network 65)

- BondReceiptNFT: repeat-invest top-up fix, receipt moves with the token under VerifiedOnly, no top-up of a Redeemed receipt.
- DealRegistry: `setReceiptNft` and `moveInvestorPrincipal`.
- TawfDepositoSeries: no profit after maturity; `settleMaturity(at, finalPeriod, …)` requires every profit period to be distributed. The maturity leaf `a` = `(finalPeriod << 64) | at` in both repos (`LedgerLeaf.packMaturity`).
- ReserveLedger: a placement must reference a registered product of the same institution.
- Several `external view` getters made `public`, for harnesses. No behaviour change.

**Not redeployed.** The testnet pool, deposito series and VPS L3 still run the old code. Redeploy only with the owner's go-ahead.

## Open decisions for the owner

- Sukuk: require a reserve snapshot before `subscribe`?
- tBSI: require a recent attestation in `tokenizeBar`?
- L3: should `declareMaturity` re-check the Shariah attestation? Should re-attest after revoke be allowed to change institution?
