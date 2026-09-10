# How tawf.finance compares (Tennet, Securitize)

This page frames Tawf Finance against the platforms judges and partners will
name first. The important one for the Indonesian market is **Tennet**, because
anyone who knows the space will ask about it.

## Tennet is custody. Tawf is origination.

[Tennet](https://tennet.id) is a digital asset custody, transfer, and settlement
platform built on MPC-CMP wallet technology. They hold keys for assets that
already exist. They do not underwrite anything, do not structure an akad, and do
not create an instrument.

Tawf's entire thesis is bringing an asset into existence that has no on-chain
form yet: a **BPRS financing pool** made investable through a compliant sell-down
akad. Tennet sits *below* Tawf in the stack. Realistically they are a dependency
or a partner, not a rival. OJK recorded Tennet's non-trading digital financial
asset custody model as passing the regulatory sandbox on 11 June 2026, opening a
registration path — which puts them on a short list of licensed Indonesian
custodians Tawf might eventually need.

Note also Tennet's own history: OJK revoked PT Tennet Depository Indonesia's
business licence as a provider of depository facilities for digital financial
assets earlier that year, before the sandbox route. A funded custody company
with existing licences still had to go back through the sandbox. Budget for that
reality in any timeline.

### Different regulatory perimeter

Tennet lives inside POJK 27/2024, the digital financial asset and crypto
perimeter. Exposure to bank financing assets is not a crypto asset, so Tawf's
product sits outside that perimeter (see `regulation.md` for the tokenised-asset
licensing triggers that do apply).

## Comparison table

| Dimension | Tennet | Tawf Finance |
|---|---|---|
| Layer in the stack | Custody, transfer, settlement | Origination + sell-down structuring |
| Core function | Holds keys for assets that already exist | Brings a BPRS financing pool into on-chain existence |
| Underwriting | None | The BPRS originates and services; Tawf structures the sell-down |
| Shariah structuring | None (no DPS, no akad, no DSN-MUI relationship) | Sell-down akad (wakalah bil istithmar / musyarakah) a partner DPS will sign |
| Regulatory perimeter | POJK 27/2024 (digital financial assets / crypto) | Bank financing exposure; tokenised-offering rules per counsel |
| Relationship to Tawf | Dependency or partner, not a competitor | — |

## Where the moat actually is

Custody is a commodity that will be competed to near zero. The defensible parts
are the two things Tennet does not have:

1. **A Shariah sell-down structure a bank's DPS will sign.** No akad, no DPS, no
   DSN-MUI relationship on the custody side.
2. **Zero-knowledge pool verification.** A real BPRS pool where anyone can verify
   the pool size, the NPF ratio, and the akad compliance of the underlying
   financing — continuously, without the bank exposing a single borrower identity
   or contract. That is a ZK problem, and no bank will publish its financing book
   without it. Tokenization itself is the boring part everyone can copy.

## Secondary note: Securitize

Securitize tokenizes large private securities (PE, credit, funds, real estate)
for accredited and institutional investors, with its own ATS and broker-dealer.
It is institutional tokenized-securities infrastructure at the opposite end of
the market from Tawf's originator-side, emerging-market Islamic financing focus.
Different league, different segment, not a direct competitor.

## One line for judges

Tennet holds the keys; Tawf creates the asset. The wow is not tokenization — it
is a continuously verifiable BPRS financing pool (pool size, NPF, akad
compliance) that no bank could publish without zero-knowledge proofs.
