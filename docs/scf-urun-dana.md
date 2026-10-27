# Securities crowdfunding platforms as Tawf issuers

Tawf's first issuer type is the BPRS, a licensed Islamic rural bank. The second is the **securities crowdfunding platform** (SCF, in Indonesian "Layanan Urun Dana"). An SCF platform is licensed by OJK to list securities of small and medium businesses (UMKM) and sell them to the public. Sharia platforms such as LBS Urun Dana list sukuk and sharia shares. Tawf tokenizes each offering as an ERC-3643 token, and the token itself enforces the investor limit that the regulation sets.

Every rule number and threshold below must be checked with local counsel before any filing. The demo uses fictional names ("Demo Urun Dana Syariah" and "CV Kopi Nusantara Demo") and does not refer to any real platform or company.

## 1. The segment

- **Regulation.** POJK 57/2020 on securities offerings through information-technology based crowdfunding services, amended by POJK 16/2021. It replaced the 2018 equity crowdfunding rule (POJK 37/2018) and widened it from shares to debt securities and sukuk.
- **Who issues.** An SME (UMKM), not yet a public company, through a licensed platform (the "Penyelenggara"). The SME can raise up to Rp10 billion through SCF.
- **Who invests.** Retail investors, within a yearly limit tied to income (section 3).
- **Sharia platforms.** They list sukuk (for example mudharabah or musyarakah) and sharia shares, overseen by the platform's Dewan Pengawas Syariah. LBS Urun Dana is one example. Others list both conventional and sharia offerings.
- **Why Tawf fits.** The platform keeps its licence and its relationship with the SME. Tawf adds the rails: an on-chain register of holders limited to verified investors, the limit check, profit distribution that follows the holder of record, and proof of every payment.

## 2. Roles

| Role | Entity | Responsibility |
|---|---|---|
| Licensed operator | SCF platform | Lists the offering, checks investor suitability, holds the OJK licence, oversees the SME |
| Issuer | SME (UMKM) | Raises the funds, runs the business, reports profit, redeems at maturity |
| Shariah review | Platform DPS | Approves the akad and each profit declaration |
| Tech vendor | Tawf | Tokenization, the investor-limit module, settlement and verification UI |

## 3. How the rules map to the contracts

| Rule | How it is enforced |
|---|---|
| Only verified investors may hold | The shared ERC-3643 IdentityRegistry. Every holder needs an ONCHAINID with a KYC claim. |
| Income up to Rp500m a year: invest at most 5% of income a year in SCF | `ScfInvestorLimitModule`: the platform records the investor's yearly limit on chain and the token rejects any mint or transfer that would take the investor past it. |
| Income above Rp500m: at most 10% a year | Same module, with the 10% limit. |
| Exempt: legal entities, and investors with a capital-market account held for two years or more | The profile carries an exemption, and an exempt investor has no limit. |
| The limit spans all of a platform's offerings | One module instance is bound to every offering token of the platform, and usage is counted per investor across all of them. |
| One investor, several wallets | Usage is keyed by the ONCHAINID, so all of an investor's registered wallets share one limit. |
| SME raise cap (Rp10bn) | The offering cap in the module and the face value in `SukukDistributor`. The demo offering is 50,000 USDC, about Rp812 million. |
| Funds reach the issuer only if the raise succeeds | `SukukDistributor.closeSubscription` releases the proceeds only above the minimum raise, otherwise investors claim a refund. |
| Profit is shared from realized profit, with no promised return | Each distribution is a fact the issuer declares and funds. A period can be declared at zero. |

Only the yearly limit and a bracket code go on chain. The investor's income stays off chain.

## 4. Architecture

```
Investor wallet ── signs suitability declaration ──> /api/tokenization/scf/profile
                                                         │ (platform agent)
                                                         ▼
                                            ScfInvestorLimitModule.setProfile
Investor wallet ── subscribe(USDC) ──> SukukDistributor ── mint ──> SCF sukuk token (ERC-3643)
                                                                       │ ModularCompliance
                                                                       ├─ ScfInvestorLimitModule (limit, cap)
                                                                       └─ DistributionCheckpointModule (profit follows holder)
Platform / SME ── facts ──> LedgerAnchor (operator-gated) ──> SukukDistributor verifies
```

- **`contracts/src/scf/ScfInvestorLimitModule.sol`.** A T-REX compliance module.
  - Each offering is configured before binding, with `initOffering(compliance, treasury, cap)`.
  - Platform agents set investor profiles with `setProfile(onchainId, limit, bracket, exemption)`.
  - Mints and transfers add to the receiver's usage for the current 365-day period. Burns never reduce it, because the limit counts money invested, not holdings.
  - An agent can reset a period's usage with `resetUsage`, for example after a cancelled raise was refunded.
  - `remainingOf(wallet)` feeds the UI.
- **`SukukDistributor`, unchanged.** It is the same contract as the BPRS sukuk.
  - The SCF offering has its own operator-gated `LedgerAnchor`.
  - Each fact (approval, reserve, profit distribution, redemption) is pushed as a single-leaf root, so the proof is empty.
  - In production the facts come from the platform's records, signed off by its Shariah board.
- **API** (one Vercel function, `api/tokenization-router.ts`):
  - **`scf/profile` (POST, no passcode).**
    - The investor signs a declaration of their annual income or exemption, stamped with the signing time.
    - The server accepts it only within 10 minutes of signing, and only if it is newer than the profile on chain, so an old signature cannot be replayed.
    - The server verifies the signature and the identity (as the faucet does), then computes the limit.
    - It converts the limit from IDR to USDC at the deployment's USDC rate and records it.
  - **`scf/status` (GET).** The offering state, plus a wallet's limit when one is given.
  - **`scf/admin` (POST, passcode).** Takes one of `reserve`, `close`, `distribute` or `settle`.
- **Frontend:**
  - `/investor/scf` has three parts: verify and fund, the suitability declaration with a limit meter, and the offering with invest, claim, redeem and refund. The invest amount is capped at the lower of the remaining limit and the offering room.
  - `/admin/scf` shows the platform and SME profiles, the contracts, the issuer actions and an investor limit lookup.
  - The issuer model lives in `src/data/issuers.ts`, with `issuerType: 'bprs' | 'scf'`.

## 5. Deployed on Arbitrum Sepolia

| Contract | Address |
|---|---|
| ScfInvestorLimitModule | `0x4d7126A053a7a04bb76dB5ddc001165FF1e84BD5` |
| SCF SukukDistributor | `0x751896413AC330F3895F2387b5Fc0C66e4078fb0` |
| SCF sukuk token `tSCF-UMKM-2026` | `0xCfeAAeEFC9b4320c77AF478bA69740e66B7eb39f` |
| SCF compliance | `0x091311AE766Ae3d9554303e71c18C051F6a9DB16` |
| SCF LedgerAnchor (operator-gated) | `0xda325a9B272419cb0fA3646E7C4698aE892eeE5e` |

Deploy another offering with:

```bash
cd contracts
PRIVATE_KEY=$OPERATOR_KEY forge script script/DeployScf.s.sol:DeployScf --sig "runScf()" \
  --rpc-url arbitrum_sepolia --broadcast
```

The script reuses the shared identity registry and mUSDC from `tokenization.deployments.json`. It opens the subscription right away and writes the `scf*` keys. A second offering of the same platform should bind the existing module rather than a new one, so the limit spans both. That step is not in the script yet.

## 6. Demo script

1. Open `/investor/scf` and connect a wallet on Arbitrum Sepolia.
2. Step 1: "Verify with test KYC", then "Get test USDC".
3. Try to invest: the button stays off until the suitability step is done, because a limit of zero blocks every purchase.
4. Step 2: enter an annual income of 100000000 (Rp100 million), then sign. The limit becomes 5% of it, Rp5 million, about 307 USDC.
5. Invest 300 USDC: it succeeds and the meter shows about 7 USDC left. A further 20 USDC is refused, by the page and by the token itself.
6. Admin (`/admin/scf`, demo passcode), once the subscription window ends:
   1. Close the subscription.
   2. Distribute a profit amount. The investor then claims it on `/investor/scf`.
   3. Settle the maturity at par. The investor then redeems.

## 7. Known limits of the demo

- **Self-declared declarations.** Income and exemptions are self-declared and only signed by the wallet. A licensed platform verifies them (for example the age of the capital-market account) before it admits an exemption.
- **Fixed periods.** A period is a fixed 365-day bucket from the module deployment, not a calendar year.
- **Fixed FX rate.** The IDR to USDC rate is fixed when the profile is recorded. A later rate change does not move the stored limit.
- **Trusted operator.** The operator is trusted to push facts to the SCF anchor, the same trust model as the standalone Robinhood deployment. In production the facts would come from the platform and its Shariah board, through the Tawf Network ledger.
- **No secondary market.** Transfers are allowed between verified wallets within the receiver's limit, but there is no trading venue. POJK 57/2020 allows a platform to run a secondary market under its own rules.
