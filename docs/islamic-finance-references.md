# Islamic Finance References and Design Rationale

This note records the two reference works that inform tawf.finance's design and
maps their key principles to specific product and positioning decisions. It
exists so the pivot's choices are defensible against the standard academic
critiques of Islamic finance, and so a reviewer (or a design-partner bank's DPS)
can trace why the product is built the way it is.

## Sources

1. **Hayat, Usman & Malik, Adeel (2014).** *Islamic Finance: Ethics, Concepts,
   Practice.* CFA Institute Research Foundation. ISBN 978-1-934667-79-8.
2. **COMCEC Coordination Office (2022).** *Standardization Efforts in Islamic
   Finance.* Prepared by an academic team coordinated by Prof. Dr. Ahmet Faruk
   Aysan. ISBN 978-605-7751-05-8.

Both are cited here for principles, not verbatim text.

## Principle to design mapping

### 1. Form versus substance is the risk to beat
Hayat & Malik return repeatedly to the central critique: Islamic finance is
often "Islamic in legal form only, conventional in economic substance" (the
murabaha syndrome, organized tawarruq, asset-based sukuk that mimic bonds,
fatwa shopping).

**Design response.**
- The instrument catalog carries an honest lifecycle status (Live / Structured /
  Pipeline / Roadmap) so nothing is presented as more validated than it is.
- The `/instruments` page carries an explicit "Substance over form" note.
- A "Form vs Substance" glossary entry names the critique directly.
- Contracts encode no akad logic; the on-chain layer is a generic escrow and
  soulbound receipt primitive until a partner DPS validates the structure. This
  is deliberate: we do not claim substance we have not earned.

### 2. Risk sharing (equity) is preferred over debt
The paper treats equity-like, profit-and-loss-sharing structures (musyarakah,
mudarabah, wakalah) as closer to the substance of Islamic finance than debt-like
credit sales and leases (murabaha, ijarah).

**Design response.**
- Return bands reflect this: debt-like 5 to 9 percent, equity-like 7 to 11
  percent (variable).
- The financing sell-down wedge is structured as musyarakah or wakalah bil
  istithmar (equity-based), not a debt sale.
- Marketing copy frames returns as coming from real serviced financing, not a
  fixed interest-like yield.

### 3. Sukuk should be asset-backed, not asset-based
Usmani's 2007 critique (reported in Hayat & Malik) held that most sukuk of the
period failed Shariah because they used legal devices to behave like
conventional bonds. Asset-backed (true-sale) sukuk are closer to the intended
substance than asset-based sukuk.

**Design response.**
- The Sukuk catalog entry and glossary entry both state Tawf targets
  asset-backed (true-sale) sukuk, and an "Asset-Backed vs Asset-Based Sukuk"
  glossary entry explains the distinction.
- Sukuk is kept as a Roadmap, tier-2 product (requires IDR 80bn core capital
  under POJK 7/2024 Art 35), consistent with the thesis that the sell-down, not
  issuance, is the entry product.

### 4. Avoid legal stratagems (bai al-inah, organized tawarruq)
Both sources flag bai al-inah and organized tawarruq as stratagems that
reproduce interest. The COMCEC report highlights Oman's regulatory ban on all
forms of tawarruq as a point of integrity, and notes the OIC Fiqh Academy's 2009
ruling against organized tawarruq.

**Design response.**
- Glossary entries for Bai Al-Inah and Tawarruq state plainly that Tawf does not
  use them, citing the Oman precedent and the OIC Fiqh Academy ruling.

### 5. Standardization versus harmonization
The COMCEC report concludes that harmonization (minimizing differences while
allowing local variation) is generally healthier than full standardization,
which can stifle innovation. Indonesia's ecosystem runs on DSN-MUI fatwas plus
OJK regulation.

**Design response.**
- Every akad in the catalog is referenced to a specific DSN-MUI fatwa (verified
  numbers below) rather than to a single global standard.
- The two-tier Shariah governance framing (partner-bank DPS plus an independent
  board) matches the COMCEC report's centralized-plus-institutional model while
  leaving room for jurisdictional interpretation.

### 6. Governance and attestation
The COMCEC report describes AAOIFI (Shariah, accounting, governance), IFSB
(prudential), and IIFM (documentation) as the international standard setters, and
two-tier Shariah governance as the norm. The tawf thesis leans on OJK
supervision, LPS insurance, and SLIK reporting as the off-chain attestation
layer that resolves the tokenization oracle problem.

**Design response.**
- The regulation doc frames the BPRS regulator (OJK) as the attestation layer.
- The DPS review of the sell-down akad is treated as the defensible asset, not
  the contracts.

## Verified DSN-MUI fatwa references

Verified against the DSN-MUI fatwa register (compilations published by Dompet
Dhuafa's Pusat Data dan Penerbitan, and corroborated by academic sources).

| Akad | DSN-MUI fatwa |
|---|---|
| Murabahah | No. 04/DSN-MUI/IV/2000 |
| Salam | No. 05/DSN-MUI/IV/2000 |
| Istisna' | No. 06/DSN-MUI/IV/2000 |
| Mudharabah | No. 07/DSN-MUI/IV/2000 |
| Musyarakah | No. 08/DSN-MUI/IV/2000 |
| Ijarah | No. 09/DSN-MUI/IV/2000 |
| Wakalah (base for Wakalah bil Istithmar) | No. 10/DSN-MUI/IV/2000 |
| Qardh | No. 19/DSN-MUI/IV/2001 |
| Sukuk (Obligasi Syariah) | No. 32/DSN-MUI/IX/2002 |

Note on Wakalah bil Istithmar: No. 10 is the general Wakalah fatwa. The catalog
cites it as the base reference and labels it as such rather than implying a
dedicated istithmar fatwa. If a design-partner bank's DPS points to a more
specific fatwa for the investment-agency sell-down, update the catalog entry
accordingly.

## What this note is not

This is a design-rationale reference, not legal or Shariah advice. Fatwa numbers
and thresholds must be re-verified with counsel and the partner bank's DPS before
any live product. Consistent with the thesis (Section 7), the central commercial
assumption still needs validation with one bank before code that encodes any akad
is written.
