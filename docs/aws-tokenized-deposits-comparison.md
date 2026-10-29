# AWS tokenized deposits sample vs Tawf: bank-signed attestations

Status: **comparison and design sketch only.** No code, contract or config changes come with this doc.

Source: [aws-samples/sample-tokenized-deposits](https://github.com/aws-samples/sample-tokenized-deposits) (README, `tokenized-cash/contracts/SettlementConsumer.sol`, `KeyRegistry.sol`, `Token.sol`, `tokenized-cash/lib/csi.ts`, `kmsSigner.ts`). Tawf side: `contracts/src/deposito/DepositoPoolLedger.sol` and `contracts/src/lib/LedgerLeaf.sol`.

## 1. What the AWS sample is

A reference sample in which two branches of one bank (Bank ABC Canada and Bank ABC Mexico) settle cross-border payments in seconds with tokenized deposits (tCAD) on a private Besu IBFT chain.

- **Instruction.** Every mint, transfer and burn is a Canonical Settlement Instruction (CSI). Its fields are the instruction id, a message digest, the asset, amount, from and to parties, value time, created and expiry times, an intent (`MINT_ONLY`, `BURN_AND_MINT`, `BURN_ONLY`), the chain id and a nonce.
- **Signing.** The bank signs the CSI with EIP-712 using an AWS KMS key (secp256k1). The key never leaves the HSM. There are three KMS roles: the CA signer, the MX signer and the relayer.
- **Verification.** `SettlementConsumer.settle()` is callable only by an allowlisted relayer. It checks the chain id, the expiry, that the instruction id was not executed before, the derived instruction id, and the EIP-712 signature. The recovered signer must be registered in `KeyRegistry` with a role bit for that intent. Only then does it call `Token.mint` or `Token.burn`.
- **Lifecycle.** An instruction moves through FUNDED, SUBMITTED, then MINTED, TRANSFERRED or BURNED (or FAILED). Lambdas on DynamoDB streams submit and watch it. `/mint` and `/redeem` accept an idempotency key.
- **Off chain.** The backing cash is locked in a collateral account in core banking, so the chain never sees it. The signature is what attests "the backing is locked". Collateral locks are released FIFO on burn, a redemption snapshots the FX rate, and a reconciliation record compares burn amount, released collateral and posted payout (`MATCHED` or `MISMATCH`).
- **Known gaps the sample admits.** Registry and relayer governance (the admin is a one-time deployer key, production should use a retained KMS key or a multisig), no pre-mint cap check against core banking, a weak API key, and no Nitro Enclave attestation for signing.

## 2. Side by side

| Topic | AWS sample | Tawf |
|---|---|---|
| Chain | Private Besu IBFT, one bank group | Public Arbitrum Sepolia, so investors and auditors can verify on a public chain |
| Asset | tCAD, a cash token backed one to one | A mudharabah deposito pool share (ERC-3643) backed by Tawf's accounts at several BPRS |
| Who attests the backing | The bank, through its KMS signer. The contract verifies the signature | The Tawf operator. `postReserve`, `postProfit` and `postMaturity` are `onlyOperator` and the natspec says "the operator attests the balances" |
| Key custody | AWS KMS HSM, three roles | A server environment key (`DEMO_OPERATOR_KEY`) that is also the operator role |
| Identity | None in the contracts, the signer registry is the only gate | ONCHAINID claims through the T-REX identity registry (KYC topic 1, TAWF_SCREENED topic 2, OJK sandbox topic 3) checked by the sandbox module |
| Lifecycle and idempotency | CSI states, an idempotency key, a unique instruction id marked executed on chain | Direct admin calls. Each reserve post opens a new epoch. Re-posting a stale snapshot is rejected (`StaleSnapshot`), there is no per request idempotency key |
| FX | Rate snapshot at redemption, stored on the instruction | Posted rate per settlement coin, rejected when older than `maxRateAge` in `TawfDepositoSeries` |
| Reconciliation | Reconciliation records, `MATCHED` or `MISMATCH`, per burn | Read-only on-chain invariant checks that the QA agents run by hand and diff between runs (pool total equals the sum of bank balances, supply not above reserve, SCF raised within cap, rates fresh, treasury covers claims) |
| Sharia layer | None | Nisbah fixed before the sale, per-investor screening, no principal charge, framed against DSN-MUI guidance |

## 3. Where Tawf is already stronger or different

- **Public verifiability.** The reserve, supply, profit and claims are readable on a public chain. The AWS design is a closed network.
- **Per-bank breakdown.** Every reserve post stores one `DEPOSITO_BANK_BALANCE` leaf per bank next to the aggregate `DEPOSITO_RESERVE` leaf, so anyone can see each bank's share of the total.
- **Compliance in the token.** ERC-3643 modules enforce investor caps, screened-group mode and the OJK sandbox rules at transfer time, instead of an off-chain check.
- **Identity registry.** Eligibility is a claim on the investor's own ONCHAINID, issued by a trusted issuer, not a list held by the operator.
- **Activity history.** The activity feed and the on-chain events give investors and the admin a readable history of subscriptions, allocations, profit and claims.

The weak spot is the one row above that is the reverse: the AWS sample proves **who said** the backing exists, Tawf only proves that the operator said so.

## 4. Deep dive: bank-signed attestations for `DepositoPoolLedger`

### The gap today

`postReserve(at, bankIds, balances)` stores each balance, adds them up, opens an epoch and records one leaf per bank plus the aggregate leaf. `TawfDepositoSeries` then verifies the aggregate leaf through `ILedgerAnchor.verify(epoch, leaf, proof)` on allocation. A compromised or careless operator key can therefore record any reserve, and the series will mint against it. The chain shows that the operator posted a number, not that a BPRS confirmed it.

### The AWS idea applied

Make each bank sign its own balance. The contract accepts a balance for a bank only with a valid signature from that bank's registered signer. The operator stays as the relayer that pays gas and submits, as the relayer does in the AWS sample.

### Message

One EIP-712 typed struct per fact. For the reserve:

| Field | Type | Meaning |
|---|---|---|
| `seriesId` | bytes32 | The pool series the balance backs |
| `bankId` | bytes32 | The listed bank, as in `addBank` |
| `snapshotAt` | uint64 | Snapshot time, must not be in the future and not older than the latest snapshot |
| `balanceSen` | uint256 | Tawf's balance at that bank in sen |
| `nonce` | uint256 | Per bank counter, so a signed statement cannot be replayed |
| `expiry` | uint64 | Latest block time at which the signature is accepted |

The domain binds `name`, `version`, the chain id and the ledger address as `verifyingContract`, the same four fields as the AWS `EIP712Domain`. The checks mirror the CSI ones: chain id match, expiry not passed, nonce unused, signature in low-s form with `v` of 27 or 28, signer registered for that bank.

Profit and maturity get their own structs in the same style. A profit attestation carries `seriesId`, `bankId`, `period`, `profitSen`, `nonce` and `expiry`. A maturity attestation carries `seriesId`, `bankId`, `maturityAt`, `principalSen`, `nonce` and `expiry`. The aggregate maturity leaf then needs one signature per bank, or one from a bank group signer if the banks agree on one.

### Signer registry

- `addBank` also takes the bank's signer address, stored next to `Bank`. This replaces the AWS `KeyRegistry` mapping with a per bank mapping, which fits because Tawf already keys everything by `bankId`.
- Adding, rotating or revoking a signer is a governance action. The operator alone should not be able to do it, because that would let the operator name itself the signer and undo the whole point. Use a timelock or a multisig for these calls. This is the gap the AWS README names for its own `KeyRegistry` and `SettlementConsumer` admin.
- Rotation needs an overlap window, so a bank can sign with the new key while the old one is still valid, and an explicit revoke that rejects signatures made after the revoke time.

### Contract change

Add `postReserveSigned(uint64 at, bytes32[] bankIds, uint256[] balances, uint256[] nonces, uint64[] expiries, bytes[] signatures)`.

- The caller may still be the operator or any relayer. What matters is that every listed balance carries a valid signature from the signer registered for that bank.
- The rest of the function stays as `postReserve` today: update `balanceOf`, sum all banks, open the epoch, record one `DEPOSITO_BANK_BALANCE` leaf per bank and the aggregate `DEPOSITO_RESERVE` leaf, emit `BankBalance` and `ReserveRecorded`.
- Leaf layout, `LedgerLeaf.hash` and `verify` are unchanged. `TawfDepositoSeries` keeps calling `ILedgerAnchor.verify` and needs no change, so the pool series, the proof-of-reserve page and the activity feed keep working.
- The unsigned `postReserve` would be removed from the deployed ledger, or restricted to a `demoMode` flag that is switched off for the pilot, otherwise the operator path remains an open door.
- Gas: one `ecrecover` per bank per post. On Arbitrum this is small next to the storage writes the post already does.

What this buys: one compromised operator key can no longer invent a reserve. To forge one, an attacker also needs the key of every bank whose balance they want to change.

### Where the bank signs

- **Pilot BPRS.** The bprs-connector inside each bank reads the balance from core banking and signs the typed message with a key the bank holds. That key sits in an HSM or a cloud KMS under the bank's control, as the AWS sample does with KMS and `kmsSigner.ts`. The connector hands the signed statement to Tawf, which relays it.
- **Demo.** One test signer key per demo bank, generated locally and kept out of the repo, registered through `addBank` at deploy. The BPRS Demo connector signs with it so the full path is exercised on Sepolia.

### Trade-offs

| Topic | Effect |
|---|---|
| Bank onboarding | Each BPRS must run key custody and change its IT. This is the main cost and may be a hard ask for small banks |
| Liveness | One bank that does not sign blocks a full reserve post. Partial posts that keep the last signed balance for silent banks (as `postReserve` already does for omitted banks) soften this, at the cost of an older snapshot for that bank |
| Freshness | `snapshotAt` and `expiry` bound how old a signed balance can be, and the series should treat a reserve whose oldest bank leaf is too old as stale |
| Gas | One signature check per bank per post, small on Arbitrum |
| Key loss or compromise at a bank | Needs the revoke and rotate path above, plus a pause of allocation until a fresh signed post exists |
| Privacy | Balances stay public in the leaves, as today. The Fhenix design in `docs/fhenix-ledger-design.md` addresses that separately and is compatible with signed inputs |
| Regulation | A signed balance statement from the bank is closer to an auditable confirmation for OJK and the DPS than an operator's own record |

### Phasing

1. **Demo.** Test bank keys, `postReserveSigned` on the Sepolia ledger, operator relays. The unsigned path is kept only behind a demo flag.
2. **Pilot.** The pilot BPRS signs from its bprs-connector with a bank-held key. Signer changes go through a timelock or multisig. The unsigned path is off.
3. **Later.** Signatures are replaced by anchored Tawf Network ledger roots, as the current `DepositoPoolLedger` natspec already plans. The signed statements remain useful as the evidence behind those roots.

## 5. Other ideas noted, not chosen now

- **KMS-held operator key.** Move `DEMO_OPERATOR_KEY` from an environment variable to a cloud KMS key, so the operator key never sits in server memory.
- **Instruction lifecycle with idempotency keys.** Give each admin action an instruction id and an idempotency key, with an audit trail, like the CSI states and `idempotencyKey` in `csi.ts`.
- **Reconciliation page.** Turn the on-chain invariant checks the QA agents run (pool total equals the sum of bank balances, supply not above reserve, SCF raised within cap, treasury covers claims) into a scheduled run that writes a MATCHED or MISMATCH record per period and shows it to the admin.

## 6. Sources

- AWS sample: https://github.com/aws-samples/sample-tokenized-deposits (`README.md`, `tokenized-cash/contracts/SettlementConsumer.sol`, `tokenized-cash/contracts/KeyRegistry.sol`, `tokenized-cash/contracts/Token.sol`, `tokenized-cash/lib/csi.ts`, `tokenized-cash/lib/kmsSigner.ts`)
- Tawf: `contracts/src/deposito/DepositoPoolLedger.sol`, `contracts/src/lib/LedgerLeaf.sol`, `contracts/src/sukuk/ILedgerAnchor.sol`, `contracts/src/deposito/TawfDepositoSeries.sol`, `docs/fhenix-ledger-design.md`, `docs/regulation.md`
