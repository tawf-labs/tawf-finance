# Hand-off: formal verification

Branch `feat/formal-verification` in **tawf-finance**, **tawf-network** and **tawf-gold-bsi**. Merged to `main` in each repo.

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

## Status (2026-10-27): pool specs rerun on the upgradeable contracts, others as of 2026-10-21

| Repo / spec | Checks verified |
|---|---|
| tawf-finance pool Registry / Vault / Receipt (UUPS + USDG vault, 2026-10-27) | 339 / 777 / 422 |
| tawf-finance sukuk Distributor (incl. held profit + nisbah) / ProfitAccumulator | 298 / 4 |
| tawf-finance deposito Accumulator / Series (incl. nisbah) / SandboxReal | 5 / 133 / 12 |
| tawf-finance mutants M1–M14 | 13 killed; M8 equivalent (see REPORT). M11 and M13 rerun on 2026-10-27, still killed. The other vault, registry and receipt mutants need regenerating from the upgradeable sources |
| tawf-gold-bsi tBSI Controller | 69 |
| tawf-network l2 LeafLog / LedgerAnchor | 12 / 40 |
| tawf-network l3 SukukLedger / ReserveLedger / InstitutionRegistry | 127 / 42 / 33 |
| tawf-network l3 PoolLedger / ServicingLedger / DocumentRegistry / ShariahAttestations | 8 / 7 / 7 / 6 |

Real failures are `Failed on <rule>:` lines whose sub-check is not a sanity check. A "Violated" `rule_not_vacuous` / `invariant_not_trivial_postcondition` is the healthy outcome: the rule is reachable and the invariant is not trivially true.

## Contract changes (tests: tawf-finance 173, tawf-network 76)

- **BondReceiptNFT:**
  - repeat-invest top-up fix
  - the receipt moves with the token under VerifiedOnly
  - no top-up of a Redeemed receipt
  - `ZeroPrincipal` on mint
  - `markReceiptDefaulted` refuses a Redeemed receipt
- **DealRegistry:** `setReceiptNft` and `moveInvestorPrincipal`.
- **TawfDepositoSeries:** no profit after maturity; `settleMaturity(at, finalPeriod, …)` requires every profit period to be distributed. The maturity leaf `a` = `(finalPeriod << 64) | at` (`LedgerLeaf.packMaturity`).
- **SukukDistributor:**
  - fresh reserve gate
  - held profit: snapshot at maturity, pay by claim
    - `releaseHeldProfit`, `claimProfit`
    - `setSweepDestination` (board-proven), `sweepUnclaimed` after `claimWindow`
    - transfers frozen after maturity
- **tawf-network:**
  - `SukukLedger`: flag-and-hold maturity; repeatable board releases; sweep-destination approval
  - `ShariahAttestations.migrateInstitution`
  - `ReserveLedger` checks the placement's product
- **tawf-gold-bsi:** fresh attestation covering supply on `tokenizeBar`.

All of this is deployed on testnet (redeploy of 2026-10-20/21; addresses in `src/web3/tokenization.deployments.json` and tawf-network `contracts/deployments/ledger.7142026.json`). The two latest receipt hardenings (`ZeroPrincipal`, `markReceiptDefaulted`) are not deployed. Both are unreachable through the live vault, so they need no redeploy until the next pool deploy.

## Owner decisions (implemented)

- Sukuk: `subscribe`/close need a fresh (≤ `maxReserveAge`) reserve snapshot covering supply.
- tBSI: `tokenizeBar` needs a fresh (≤ `maxAttestationAge`) attestation covering supply after the mint.
- L3 `declareMaturity` re-checks the attestation. If it's invalid, the sukuk is flagged, principal is still declared, and profit is held for the Shariah board, which releases it in parts. Holders claim it on L2, and anything unclaimed is swept after the claim window to a board-approved destination (never Tawf).
- L3 attestations stay with their institution; switching needs the admin-only `migrateInstitution`.

## Open notes

- L3 `releaseHeldProfit` does not cap the total released at `heldAmount`. The board can release more than was held (e.g. a later true-up). Add a cap if that is not intended.
- L2 `setSweepDestination` can be called by anyone, but only with a board-approved ledger proof, and only once.
