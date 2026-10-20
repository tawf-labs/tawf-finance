# Kiro task: pre-flight a pool spec before its prover run

Use only file read/write tools. Do not run shell commands. Only write under `contracts/certora/`.

You will be told which component: **Receipt** or **Vault**.

1. Read `contracts/certora/LESSONS.md`. Then read the spec `contracts/certora/specs/autospec_pool_<Component>.spec`, its conf `contracts/certora/confs/autospec_pool_<Component>.conf`, and the harnesses in `contracts/certora/harness/`.
2. Fix everything that violates a lesson:
   - harness `this.` self-calls: call the parent internally. The getters above are already `public`.
   - the conf must map `openzeppelin-contracts` to `certora/munged/openzeppelin-contracts`
   - if the spec uses harness getters, the conf's `files`/`link`/`verify` must name the harness contract
   - the spec must import `summaries/pool_summaries.spec`
   - every parametric exclusion must carry a justification comment
3. Check the CVL against `/home/zidan/tools/certora-docs/docs/cvl/` for syntax you are unsure of: `methods` entries, `envfree`, `@withrevert`, `lastReverted`, hooks, `requireInvariant`.
4. Write a short `contracts/certora/properties/preflight_<Component>.md` listing what you changed and any `src/` changes you need (for example, an `external` getter that must become `public`).

Print "KIRO PREFLIGHT <Component> DONE" as the last line.
