# Fhenix CoFHE for the reserve ledger (design, not implemented)

Status: **design only.** Nothing here is compiled or tested. It is based on the Fhenix toolkit's
published skill notes (FHE.sol rules, ACL verbs, decryption flows); the full docs site was not
reachable from the session that wrote this, and `cofhe-contracts` needs a separate compiler setup
(the toolkit says Foundry mocks, solc and remappings differ from the rest of `contracts/`).

## Where it fits
Today the sukuk and deposito contracts accept a ledger fact only with a Merkle proof against
`ILedgerAnchor` (tawf-network in production, `LedgerAnchor` on chains without it). Two sensitive
things are still public or operator-trusted:

1. The deposito reserve (Tawf's dedicated account balance at the BPRS) appears in the clear in
   the `DEPOSITO_RESERVE` leaf and in `TawfDepositoSeries.reserve()`.
2. The roots themselves are posted by a single operator.

CoFHE helps with (1) directly and does nothing for (2).

## Proposal: `FhenixReserveLedger` (Arbitrum Sepolia only)
- Operator posts the reserve as an encrypted input (`InEuint64`), stored as `euint64`, then
  `FHE.allowThis`. Per the toolkit rules: branchless `FHE.select`, `allowThis` after every stored
  write, `allow*` before emit.
- On each snapshot compute `ebool covered = FHE.gte(reserve, FHE.asEuint64(tokensOutstanding))`.
  `FHE.allowPublic(covered)` only; the balance stays private. A client calls
  `decryptForTx(...).withoutPermit()` and the contract checks it with `FHE.verifyDecryptResult`,
  giving a public **proof of full backing that does not reveal the balance**.
- `allowPublic` is irreversible (toolkit rule 10), so publish only the boolean, never the balance.
- The Merkle anchor stays for the other ledger leaves; `allocate` would additionally require the
  `covered` result for that epoch.

## Constraints
- CoFHE is live on Arbitrum Sepolia (Fhenix announcement, Feb 2026). It is **not** on Robinhood
  Chain, so the Robinhood deployment keeps the plaintext reserve leaf and the trusted-operator
  `LedgerAnchor`.
- Keep it in its own Foundry project or profile; its compiler and remappings conflict with the
  0.8.17 T-REX units in `contracts/`.
- Confidentiality is not anonymity: transaction graph and timing stay public.

## Next steps
1. Install the Fhenix toolkit plugin and `cofhe-contracts` in an isolated `contracts-fhenix/`.
2. Implement `FhenixReserveLedger` with Foundry mock tests (reserve < outstanding must give false).
3. Wire the `covered` result into the proof-of-reserve page.
