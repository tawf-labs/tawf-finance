# Security and Dependency Triage

This page records the frontend (`tawf-finance`) dependency security posture, the
audit baseline, and the accepted items that are deliberately tracked rather than
force-patched.

## How to re-check

From the `tawf-finance` directory:

```bash
npm audit
```

`npm audit` reads the advisory database against `package-lock.json`. GitHub
Dependabot reports the same alerts against the default branch.

## Baseline and reduction

| State | Critical | High | Moderate | Low | Total |
| --- | --- | --- | --- | --- | --- |
| Initial | 1 | 17 | 22 | 1 | 41 |
| Current | 0 | 0 | 8 | 0 | 8 |

The reduction came from two deliberate, verified steps:

1. `npm update` (semver within existing ranges, no major bumps). This cleared
   the direct advisories in `postcss`, `vite`, and `react-router-dom`, and the
   critical along with most high severity entries.
2. Two safe `overrides` in `package.json` forcing patch-compatible versions of
   stable, widely used libraries:
   - `axios` pinned to `^1.19.0` (resolves the recursion, prototype pollution,
     and proxy bypass advisories in versions `1.0.0 - 1.17.0`).
   - `ws` pinned to `^8.21.3` (resolves the uninitialized memory disclosure and
     memory exhaustion advisories in versions `8.0.0 - 8.20.1`).

Every change was verified with `npx tsc --noEmit`, `npm run lint`, and
`npm run build`.

## Accepted / tracked upstream

The remaining 8 advisories are all `moderate` severity and all resolve only by
upgrading `wagmi` from v2 to v3 (the advisory fix target is `wagmi@3.7.6`, an
incompatible major). They live inside the wallet connector graph that v2 pulls
in:

- `@metamask/sdk` and `@metamask/sdk-communication-layer`
- `@metamask/rpc-errors` and `@metamask/utils`
- `@gemini-wallet/core`
- `@wagmi/connectors`
- `uuid`

These are not force-patched with `overrides` for two reasons:

- `overrides` would pin internal packages to versions their parents do not
  declare, which can break the injected wallet connector runtime.
- The correct, supported fix is the `wagmi` v2 to v3 migration, which also
  refreshes `viem` and the whole connector set.

### Follow-up: wagmi v2 to v3 migration

This is the work that closes out the remaining 8 moderate advisories. It is a
breaking change and should be its own reviewed change, not folded into routine
maintenance:

- Upgrade `wagmi`, `viem`, and `@wagmi/connectors` to their v3 (and matching
  viem) lines.
- Re-run `npm audit` and expect the remaining entries to clear.
- Manually test the injected wallet connection end to end (connect, invest,
  redeem) because the connector API surface changed between v2 and v3.

Until that migration lands, the 8 moderate items are accepted and tracked here
and via Dependabot alerts.

## Dependabot

`.github/dependabot.yml` is configured for `npm` on a weekly cadence so future
advisories surface as reviewable pull requests rather than accumulating as
alert noise.