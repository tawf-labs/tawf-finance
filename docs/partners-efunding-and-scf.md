# Partnership assessment: efunding.id and a licensed SCF platform

Status: assessment only. No partnership exists with any party named here. Names are public companies and are cited as factual references, not endorsements. Anything not backed by a public source is marked "to confirm with the partner".

## 1. Summary

| Partner | Role for Tawf | Fit |
|---|---|---|
| efunding.id (PT Efunding Teknologi Keuangan) | Distribution and BPRS access for the Deposito Pool | Strong. Its current flow already matches the customer-named, rupiah-only model. Tawf adds the on-chain receipt and per-bank proof of reserve |
| A licensed SCF platform (LBS Urun Dana style, SHAFIQ as another example) | Issuer of record and investor onboarding for Urun Dana | Strong. Tawf is the tokenization and settlement rail, the platform keeps the licence |

Recommendation: start with model C in section 4 (co-branded proof of reserve on efunding's existing BPRS deposito), then move to model A. In parallel, open talks with one licensed SCF platform.

## 2. efunding.id profile

| Fact | Detail | Source |
|---|---|---|
| Legal entity | PT Efunding Teknologi Keuangan | efunding.id site bundle |
| Self-description | "Platform Agregator Syariah Pertama" | efunding.id |
| OJK status | Registered (terdaftar) and supervised by OJK under letter S-61/IK.01/2025 | efunding.id |
| Category | ITSK (Inovasi Teknologi Sektor Keuangan), cluster "Agregasi Informasi Produk dan Layanan Jasa Keuangan". The site also calls itself a Penyelenggara Agregasi Jasa Keuangan (PAJK) | efunding.id |
| Products | Sharia tabungan and deposito at BPRS (mudharabah muthlaqah), plus pembiayaan for motor, mobil and rumah | efunding.id |
| LPS wording | Deposito described as "aman dijamin LPS" | efunding.id |
| Named partners in its logo strip | BPRS Attaqwa, BPRS Botani, Bank Hijra, HIK Insan Cita, HIK Parahyangan. Deposito copy also names BPRS Gaido Indonesia Cianjur. A placeholder "[NAMA BPRS ANDA]" appears in financing copy | efunding.id |
| Rupiah only | "BPRS hanya akan menerima uang dalam mata uang rupiah" | efunding.id |
| Payment | Customer pays into a CIMB Niaga account in the name of PT Efunding Teknologi Keuangan and attaches proof of transfer | efunding.id |
| Bilyet | The site's back office has fields for bilyet number and upload, so the bilyet reaches the customer through the BPRS flow | efunding.id |
| Profit sharing | Paid to the depositor, timing depends on each BPRS | efunding.id |

Displayed figures on their site, quoted as theirs and not as Tawf's: Deposito Syariah Madani Premium 6 months shown as nisbah 62:38 and 6.75%, 12 months as 71:29 and 6.75%, and Deposito Berkah Plus 3 months at BPRS Gaido shown as 50:50 and 7.60%.

How the data was read: the lead and qa2 both read the text of the site's JavaScript app bundle at https://efunding.id/static/js/app.77624c3fc9c8828d9508.js. A web search for the company name returned no independent coverage, so every row above rests on efunding's own site.

To confirm with the partner:

1. The scope of the ITSK registration. Registration is not a licence, and an aggregation cluster is about information, not about taking customer funds.
2. Whether they act as an agent of the BPRS or only aggregate information.
3. Which BPRS have signed agreements with them, and on what terms.
4. The money flow. Today funds go to a company-name account, not a per-customer virtual account. Who holds the funds between payment and BPRS placement?
5. Whether the deposito is opened in the customer's name at the BPRS in every case.
6. The status of Bank Hijra and the HIK entries, which are not BPRS and may be listed for other products.

## 3. Fit with the Tawf Deposito Pool

Tawf's planned flow comes from `.herdr-briefs/deposito-idrx-receipt-plan.md` (customer-named update).

| Step | Tawf planned flow | efunding current flow | Gap or overlap |
|---|---|---|---|
| Entry | Verified wallet picks a BPRS offer in rupiah | Customer picks a BPRS product on the site | Same idea |
| Money in | Virtual account in the customer's own name at a Bank Umum Syariah | Transfer to a CIMB Niaga account in efunding's name | Differs. Needs confirmation that funds are safeguarded, see section 6 |
| Instruction | Tawf instructs the BUS to move money into BPRS deposito | efunding forwards the application to the BPRS | Similar |
| Deposito | Opened in the customer's name at the BPRS | Opened in the customer's name per the site flow | Same, to confirm |
| Receipt | Soulbound on-chain receipt per placement | Bilyet and receipt documents uploaded off chain | Tawf adds value here |
| Proof | `DepositoPoolLedger` per-bank totals and Proof of Reserve | None found | Tawf adds value here |
| Payout | BPRS pays principal and profit to the customer, receipt is burned | Profit sharing sent to the depositor | Same |
| Currency | Rupiah only, no USD stablecoin touches deposito | Rupiah only | Same |

## 4. Partnership models

| Model | Description | Pros | Cons |
|---|---|---|---|
| A. efunding as front end | efunding sells BPRS deposito to its users. Tawf is the infrastructure and on-chain proof behind it | Uses efunding's existing users and BPRS relationships. Tawf avoids BPRS onboarding work | Tawf depends on one distributor. Brand sits with efunding |
| B. Tawf as front end | Tawf faces the customer. efunding gives BPRS access and runs operations | Tawf owns the customer and the experience | Needs Tawf to satisfy more regulatory scope. efunding's aggregator status may not cover being an operator, to confirm |
| C. Co-branded proof of reserve | efunding's existing BPRS deposito gain Tawf on-chain receipts and a per-bank proof of reserve | Quick win. No new customers, no new money flow, low regulatory exposure | Smaller revenue at first. Needs efunding to share placement data |

Recommendation: C first as a pilot, then A once the receipt and reconciliation work in practice. B only if the regulatory scope is confirmed.

## 5. SCF platform partner

A licensed securities crowdfunding platform (Penyelenggara Layanan Urun Dana) holds the licence and the customer relationship. Tawf supplies the rail.

| The platform brings | Tawf brings |
|---|---|
| OJK licence under POJK 17/2025 | Multi-coin settlement (USDC, USDT, USDG) |
| Issuer due diligence and listing | On-chain investor limit across offerings (`ScfInvestorLimitModule`) |
| Investor KYC and limit self-assessment | Proof of reserve and on-chain audit trail |
| Sharia board and DSN-MUI alignment where the platform is sharia | Tokenized securities with transfer rules |

Candidates to approach, from public sources only:

| Platform | What public sources say | Source |
|---|---|---|
| LBS Urun Dana | States it holds an OJK licence as a securities crowdfunding operator under POJK 17/2025 | https://www.lbs.id/publication/artikel/pojk-17-2025-aturan-baru-securities-crowdfunding |
| SHAFIQ | Described in academic articles as the first sharia securities crowdfunding platform in Indonesia, licensed by OJK and supervised under DSN-MUI. Search snippets only, the full articles were not read | https://ejournal.yayasanbhz.org and https://jurnalnasional.ump.ac.id (search results, to verify) |

The full list of licensed platforms should be taken from OJK's own register before outreach.

## 6. Regulatory notes

1. **ITSK registration versus a licence.** Registration with OJK under POJK 3/2024 lets a company operate as an ITSK provider. It is not a banking, securities or deposit licence. An aggregator that compares and lists products is different from an entity that collects customer money. This is the main question for efunding (section 2, items 1 to 4). Source for POJK 3/2024: https://ojk.go.id (publication page on ITSK).
2. **POJK 17/2025 replaces POJK 57/2020.** POJK 17/2025 took effect on 25 July 2025 and revokes POJK 57/2020 (as amended by POJK 16/2021). Source: https://peraturan.bpk.go.id/Details/327332/peraturan-ojk-no-17-tahun-2025 and https://ojk.go.id/id/regulasi/Pages/POJK-17-Tahun-2025-Penawaran-Efek-Melalui-Layanan-Urun-Dana-Berbasis-Teknologi-Informasi.aspx. The LBS summary of Article 125 gives the individual investor cap as 5% of annual income up to Rp500 million and 10% above, applied across all platforms, with exceptions. This needs reading against the official PDF.
   - Action: update the copy and comments that still cite POJK 57/2020 in `contracts/src/scf/ScfInvestorLimitModule.sol`, `tawf-finance/src/lib/scf.ts`, `tawf-finance/src/data/issuers.ts`, `tawf-finance/api/_tokenization/scf/profile.ts` and `docs/scf-urun-dana.md`. Check each rule (investor cap, issuer raise cap, exemptions) against POJK 17/2025 and not only the citation.
3. **LPS wording.** efunding says "dijamin LPS". Tawf copy should keep to "LPS covers bank depositors under its own rules" with no amounts and no promise of cover for the on-chain receipt. The receipt is a reference to the customer's deposito, not a deposit.
4. **No USD into deposito.** Deposito stays rupiah only. No stablecoin or IDRX touches it. This also matches efunding's flow.
5. **Data sharing and PDP law (UU 27/2022).** A KYC handoff between Tawf, efunding, a BUS, a BPRS and an SCF platform is a transfer of personal data. It needs a lawful basis, a data processing agreement, and a clear controller and processor split. Only hashes go on chain.

## 7. Integration points in our code

| Area | Where | Use |
|---|---|---|
| Deposito flow and receipt | `.herdr-briefs/deposito-idrx-receipt-plan.md` | Customer-named flow and soulbound receipt. A partner's placement confirmation would drive the `place` step |
| Ledger and proof | `contracts/src/deposito/DepositoPoolLedger.sol`, Proof of Reserve page | Per-bank totals of customers' deposito. For model C, efunding's BPRS placements are posted here |
| Platform entries | `tawf-finance/src/data/issuers.ts` | A real SCF platform replaces the fictional demo entry. The licence text there must cite POJK 17/2025 |
| SCF API | `tawf-finance/api/_tokenization/scf/*` | Admin, profile and status endpoints. Profile carries the investor limit inputs |
| Investor limit | `contracts/src/scf/ScfInvestorLimitModule.sol` | Cross-offering on-chain limit. Rules to recheck under POJK 17/2025 |
| KYC and identity | ONCHAINID claims, trusted claim issuer | A partner's KYC result is attested by a trusted claim issuer. No raw identity data on chain |

## 8. Risks

| Risk | Detail | Mitigation |
|---|---|---|
| Partner concentration | One distributor or one SCF platform becomes a single point of failure | Keep the receipt and ledger partner-neutral. Sign more than one BPRS and platform over time |
| Displayed returns | efunding shows figures such as 6.75% and 7.60%. Tawf's rule is no return promises in its own voice | In co-branded copy, label figures as the BPRS's displayed nisbah, never as Tawf's claim. Legal review before launch |
| Reconciliation | Rupiah movements, bilyet and on-chain receipts must agree | Reference hash per placement. Daily reconciliation of ledger against BPRS statements |
| Reputation | Tawf is linked to the partner's conduct and complaints | Due diligence, a right to exit, and clear scope in the agreement |
| Regulatory scope | An aggregator registration may not cover collecting funds. SCF rules changed in 2025 | Written confirmation from the partner and legal advice before any live flow |
| Fund safeguarding | Funds in a company-name account before placement | Prefer per-customer virtual accounts at a BUS as planned |

## 9. Next steps

Questions for a first call with efunding:

1. What exactly does the ITSK registration S-61/IK.01/2025 cover?
2. Are you an agent of the BPRS or an information aggregator?
3. Which BPRS have signed agreements and can share placement data?
4. How are funds held between payment and BPRS placement?
5. Would you accept an on-chain receipt and per-bank proof of reserve at no cost for a pilot?

Questions for an SCF platform:

1. How do you onboard and limit investors under POJK 17/2025, and can an external system report cross-platform usage?
2. Would you list a tokenized offering with transfer restrictions and multi-coin settlement?
3. Who is the Sharia board and what approval does a tokenized structure need?
4. What do you need from us for security and audit review?

Pilot proposal: one BPRS, one tenor, proof of reserve only. No new customer money flow, no stablecoin, no return claims. Success means efunding's placements show up as receipts and per-bank totals that match the BPRS statement.

## 10. Sources

1. efunding.id site and JavaScript bundle: https://efunding.id and https://efunding.id/static/js/app.77624c3fc9c8828d9508.js
2. POJK 17/2025 on BPK JDIH: https://peraturan.bpk.go.id/Details/327332/peraturan-ojk-no-17-tahun-2025
3. POJK 17/2025 on OJK: https://ojk.go.id/id/regulasi/Pages/POJK-17-Tahun-2025-Penawaran-Efek-Melalui-Layanan-Urun-Dana-Berbasis-Teknologi-Informasi.aspx
4. LBS Urun Dana on POJK 17/2025: https://www.lbs.id/publication/artikel/pojk-17-2025-aturan-baru-securities-crowdfunding
5. LBS Urun Dana licence statement: https://www.lbs.id
6. SHAFIQ coverage: https://ejournal.yayasanbhz.org and https://jurnalnasional.ump.ac.id (search snippets)
7. POJK 3/2024 on ITSK: https://www.ojk.go.id (publication page)
