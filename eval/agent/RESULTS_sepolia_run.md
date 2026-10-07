# Sepolia Run — Deployment + Full Lifecycle (production stack + disbursement prototype)

Network: Ethereum Sepolia (chainId 11155111). Deployer / all roles (single-key testnet
posture): `0x6155Aecb5eaB7719804F67De1E4ef878f0226f87`.

Status: COMPLETED and independently verified. All contract code and final state were
confirmed on two independent RPC providers (Alchemy and Infura).

## Deployed contracts (verified: real bytecode at head, functional reads)

| Contract | Address | code bytes |
|---|---|---|
| MockUSDC | `0x115216f135B0e104e7A7FC34EEF9370ca7DA036b` | 2006 |
| BondReceiptNFT | `0xF004Fdd071e4c73BC590994f7fFFF4Bb8D7fB8D5` | 11060 |
| DealRegistry | `0xc2fE570F1621A8FDc7c87442598B9797a765d4a6` | 7147 |
| RedemptionVault | `0x425E02AdeC0DFb68a70a7e7DDeCb70E9d0b33F82` | 6725 |
| IdentityRegistry | `0x291DCCA29C2f669eE0AbFaa9A79be174e8901cA2` | 1758 |
| Compliance | `0xb65D5454638e31747cDF75Fb98c6d7f782Cd595c` | 1888 |
| PooledFinancingVault | `0x5De2408B7471C4D753c4EaD9f731A4CaaD201026` | 5664 |
| DisbursementVerifier (prototype) | `0xbed93C018dba9684e78aAE3B0C76DC1C302dCf71` | 3752 |

Wiring verified: registry.vault, vault.registry/usdc/nft, nft/pool compliance all set.
Roles (ORIGINATOR, SHARIAH, OPS; and verifier AGENT/OFFICER/SHARIAH) granted to the single
deployer — a testnet simplification that, exactly as the chapter's own Sepolia run notes,
says NOTHING about role separation.

## Full lifecycle executed on-chain (12=c)

Production financing lifecycle (DealRegistry deal #1 → final status **5 = Completed**):
createDeal → approveDeal → markMintable → fund (faucet+approve+invest 50 USDC, target met)
→ markMatured → repay (principal+yield) → redeem → completeDeal.

Prototype disbursement-verification lifecycle (DisbursementVerifier):
- Milestone #1: registerMilestone → signed CLEAN agent verdict → **Released (status 2)**.
- Milestone #2: registerMilestone → signed FLAG agent verdict → **Flagged (status 3)** →
  human `officerOverrideRelease` → **OverrideReleased (status 4)**.
This demonstrates asymmetric automation live on a public testnet: the agent released on a
clean verdict and flagged otherwise, but never denied; only a human moved the flagged
milestone forward. The agent has no on-chain deny/default path (officerDeny is OFFICER-only).

## RPC reliability episode (recorded honestly)

Earlier deployment attempts via public endpoints and via `forge script` repeatedly reported
"success" while leaving no code at the canonical head. The precise, non-overclaiming finding:

> The initial RPC path did not provide trustworthy canonical transaction execution/state
> persistence. A supposedly successful 0.001 ETH self-transfer produced a success receipt
> while the sender's nonce and balance remained exactly unchanged, which is inconsistent
> with a real executed transaction.

Resolution and corrections:
- A follow-up control test revealed the self-transfer gasUsed (12,000) was NOT proof of a
  fake node — a self-transfer can legitimately differ from the 21,000 figure, so that
  specific rejection was withdrawn as an overclaim.
- The DEFINITIVE control test — a transfer between two DISTINCT EOAs — passed on both RPCs:
  recipient credited by exactly the sent value, sender debited value+fee, nonce +1, receipt
  retrievable on both providers. This confirmed real canonical execution.
- The actual deployment blocker was `forge script`'s batched broadcast in this environment,
  which never landed code regardless of gas settings or RPC. Deploying each contract with
  `forge create` (explicit gas price) and wiring via `cast send`, then verifying on Infura,
  worked. (Alchemy's read view lagged during the run but later agreed.)

## Caveats
- Synthetic/testnet only. MockUSDC, single deployer key, no real funds, no real users.
- Single-key posture says nothing about role separation or multisig (a known gap in the
  chapter's evaluation; not closed here).
- The DisbursementVerifier is a prototype of the chapter's designed-but-future-work layer,
  now exercised on testnet; it is not audited and not production.
- Exposed credentials used during this run (private key, Alchemy key, Etherscan key) should
  be rotated; the key was shared in plaintext and must be treated as compromised.
