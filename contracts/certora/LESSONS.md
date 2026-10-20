# Lessons from the local prover runs (read before writing or editing any spec)

1. **No external self-calls in harnesses.** `this.foo()` inside a harness is an external call the prover models badly (requires become unsatisfiable, or state gets havoced). Call the parent's function internally instead. If the parent function is `external`, it was changed to `public` in `src/`:
   - done for `getDeal`, `dealCount`, `getReceiptMeta`, `getDealSnapshot`, `mintedCount` and `burnedCount`
   - for new contracts, list the needed `external`→`public` changes in your notes; don't edit `src/` yourself
2. **OZ v5 SafeERC20 uses inline assembly.** It is summarized by `specs/summaries/OZ_SafeERC20.spec` plus `DISPATCHER(true)` for `transfer`/`transferFrom`/`balanceOf`, all imported through `specs/summaries/pool_summaries.spec`. Any spec whose contract moves ERC20 via SafeERC20 must import a summaries file that does the same.
3. **OZ ERC1155 `_asSingletonArrays` and `Arrays.unsafeMemoryAccess` use assembly.** The confs map `openzeppelin-contracts` to `certora/munged/openzeppelin-contracts`, built by `certora/munge.sh`. Every new conf must use that mapping. If a new contract hits other OZ assembly ("Pointer analysis for optimization failed" in the log), add a patch to `munge.sh`. Don't touch `lib/`.
4. **Unknown external callees havoc everything.** Every external call to a contract that isn't in the scene needs a summary:
   - `_.isVerified` → ghost
   - ERC-1155 receiver hooks → `NONDET`
   - ILedgerAnchor `verify` → ghost (for sukuk/deposito)
   - T-REX token calls → ghost ledger
5. **Reading results:**
   - `Violated: ...-rule_not_vacuous` and `...-invariant_not_trivial_postcondition` are good: the rule is reachable or non-trivial
   - a real violation is any other `Violated:` line
6. **Parametric rules** (`method f`) range over every function of every contract in the scene, including `MockUSDC.faucet`. A `require`/`filtered` exclusion must be justified in a comment.
7. **Memory:** prover runs are serial and capped. Never run the prover yourself; Claude runs it.
8. **Shared summaries must not name a concrete contract** (`BondReceiptNFT.uri`). A conf that swaps in a harness removes that name from the scene, and CVL type-checking fails. Use `_.` wildcards or `currentContract`, or put contract-specific entries in the component spec.
9. **Public mappings are indexed, not called, inside Solidity.** In a harness write `transferPolicy[dealId]`; `transferPolicy(dealId)` is only valid from outside the contract.
10. **CVL reserved words** can't be variable names: `at`, `sig`, `rule`, `method`, `env`, `return`, `old`, `exists`, `forall`, `sum`, `persistent`. Use `atTs`, `sigBytes` and so on.
11. **A harness function called from a rule without an `env` must be declared `envfree`** in `methods`, and must not read `msg.sender`/`msg.value`. That covers mutators too, such as a harness `fund`/`settle`/`take`.
12. **Multi-contract invariants:** in a CVL `invariant`'s base case only the verified contract's constructor runs, and other in-scene contracts start from arbitrary storage. State cross-contract consistency as a preservation rule (`require` it before, call `f`, `assert` it after) and note that every contract starts empty on deployment.
13. **Contract-only entry points:** functions only another scene contract may call (vault-only, registry-only, `onlyCompliance`) reach real state only through that contract's own public functions. Exclude them from parametric rules by selector, with a `definition contractOnly(method f)` and a comment. Otherwise they produce vacuous or unreachable counterexamples.
