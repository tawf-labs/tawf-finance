import { Reveal } from '@/components/landing/Reveal';
import { Chapter, PageHero, PublicPage, Tile, type Tint } from '@/components/landing/PublicPage';

export function Glossary() {
  const terms = [
    {
      term: 'Akad (Aqd)',
      definition: 'A contract or agreement in Islamic finance. In the Tawf pilot, an SME sukuk rests on a mudharabah akad between the investors and the SME.',
      category: 'General',
    },
    {
      term: 'Bai Al-Inah',
      definition: 'A financing arrangement where the financier buys an asset from the customer on a deferred payment basis and immediately sells it back to the customer on a cash basis at a lower price.',
      category: 'Contracts',
    },
    {
      term: 'BPRS (Bank Pembiayaan Rakyat Syariah)',
      definition: 'A licensed Islamic rural bank in Indonesia. Unlike a BMT, a BPRS is OJK-supervised and LPS-insured. LPS covers bank depositors under its own rules, not the Tawf token. The partner banks of the later Tawf Deposito Pool would be BPRS.',
      category: 'Organizations',
    },
    {
      term: 'BMT (Baitul Maal wat Tamwil)',
      definition: 'Islamic cooperative financial institution in Indonesia combining social (Baitul Maal) and commercial (Baitul Tamwil) finance. A possible later distribution channel for ZISWAF modules, not part of the pilot.',
      category: 'Organizations',
    },
    {
      term: 'Deposito Pool',
      definition: 'A later product, for investors in Indonesia. Tawf would hold mudharabah deposito at several licensed BPRS in one region and wrap it into one ERC-3643 token, with each bank\'s balance shown in the proof of reserve. Not part of the first pilot.',
      category: 'Products',
    },
    {
      term: 'Gharar',
      definition: 'Uncertainty or ambiguity in a contract. Islamic finance prohibits excessive uncertainty to ensure fairness and transparency.',
      category: 'Prohibitions',
    },
    {
      term: 'Halal',
      definition: 'Permissible or lawful according to Islamic law.',
      category: 'General',
    },
    {
      term: 'Ijarah',
      definition: 'A leasing arrangement where the financier owns an asset and leases it to the user for a specified period and rental payment.',
      category: 'Contracts',
    },
    {
      term: 'Mudharabah',
      definition: 'A profit-sharing partnership where one party provides capital and the other provides expertise. Profits are shared according to a pre-agreed ratio, while losses are borne by the capital provider (unless due to misconduct). The akad behind SME sukuk mudharabah and, later, the Deposito Pool.',
      category: 'Contracts',
    },
    {
      term: 'MSME',
      definition: 'Micro, Small, and Medium Enterprises. In the pilot they are the SMEs that raise funds through sharia crowdfunding (urun dana) on a licensed partner platform.',
      category: 'Business',
    },
    {
      term: 'Musharakah',
      definition: 'A joint partnership where all parties contribute capital and share profits and losses according to their capital contribution ratio. A candidate structure for the later financing sell-down, not in the pilot.',
      category: 'Contracts',
    },
    {
      term: 'Nisbah',
      definition: 'The pre-agreed profit-sharing ratio in a mudharabah. It is fixed before a subscription is made.',
      category: 'Contracts',
    },
    {
      term: 'NPF (Non-Performing Financing)',
      definition: 'The Shariah-finance equivalent of a non-performing loan ratio, a measure of the health of a bank\'s financing book. The Deposito Pool does not report NPF, since it holds deposito and not financing.',
      category: 'Business',
    },
    {
      term: 'DPS (Dewan Pengawas Syariah)',
      definition: 'The Shariah Supervisory Board every BPRS is required to have. It oversees the bank\'s akad and products.',
      category: 'Organizations',
    },
    {
      term: 'ERC-3643',
      definition: 'A token standard for permissioned assets. The pool token can only be held by wallets whose ONCHAINID carries a verified identity claim, and it cannot be minted above the recorded bank balances.',
      category: 'Technology',
    },
    {
      term: 'Financing Sell-Down',
      definition: 'A later product, not in the pilot: a BPRS sells down economic exposure to a defined pool of its financing to an outside investor pool through a compliant akad.',
      category: 'Products',
    },
    {
      term: 'ONCHAINID',
      definition: 'An on-chain identity contract that holds claims about a wallet\'s owner, such as a completed identity check. The identity registry reads it to decide who may hold the token.',
      category: 'Technology',
    },
    {
      term: 'Proof of reserve',
      definition: 'A public page that shows each partner bank\'s recorded deposito balance next to the token supply, read live from the contracts.',
      category: 'Platform',
    },
    {
      term: 'Wakalah bil Istithmar',
      definition: 'An investment-agency akad in which an agent invests capital on behalf of a principal for a fee. A candidate structure for the later financing sell-down, not in the pilot.',
      category: 'Contracts',
    },
    {
      term: 'Riba',
      definition: 'Interest or usury, strictly prohibited in Islamic finance. Profit-sharing models take its place.',
      category: 'Prohibitions',
    },
    {
      term: 'Shariah',
      definition: 'Islamic law derived from the Quran and Hadith.',
      category: 'General',
    },
    {
      term: 'Sukuk',
      definition: 'Islamic bonds representing ownership in a tangible asset or project. SME sukuk through the SCF partner platform are in the pilot. Sukuk issued by a BPRS under POJK 7/2024 Art 35 require IDR 80bn+ core capital and come later.',
      category: 'Products',
    },
    {
      term: 'Tijarah',
      definition: 'Trade or commerce. Islam encourages trade and business activities that are fair and beneficial to society.',
      category: 'General',
    },
    {
      term: 'Urun dana',
      definition: 'Sharia securities crowdfunding in Indonesia, where SMEs raise funds from the public through a licensed platform. Tawf connects to it through a licensed partner platform.',
      category: 'Products',
    },
    {
      term: 'Wadiah',
      definition: 'A safe-keeping arrangement where goods or funds are deposited with someone else for safekeeping. Used for savings accounts in Islamic banking.',
      category: 'Contracts',
    },
    {
      term: 'Zakat',
      definition: 'A mandatory charitable contribution for eligible Muslims, typically 2.5% of accumulated wealth.',
      category: 'General',
    },
  ];

  const categories = [...new Set(terms.map(t => t.category))];

  const slug = (c: string) => c.toLowerCase().replace(' ', '-');

  return (
    <PublicPage>
      <PageHero
        eyebrow="Glossary"
        title="The words behind"
        accent="the pilot."
        lead="Key terms in Islamic finance and on the Tawf platform. Entries marked as later are reference and not part of the pilot."
        actions={
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <a key={category} href={`#${slug(category)}`} className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-medium text-ink ring-1 ring-ink/15 transition-colors hover:bg-ink hover:text-white">
                {category}
              </a>
            ))}
          </div>
        }
      />

      {categories.map((category, ci) => {
        const tints: Tint[] = ['paper', 'mint', 'butter', 'stone', 'peach'];
        const tint = tints[ci % tints.length];
        const prev = ci === 0 ? 'stone' : tints[(ci - 1) % tints.length];
        return (
          <Chapter key={category} id={slug(category)} tint={tint} from={prev} eyebrow="Category" title={category} className="!pt-20 md:!pt-24">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {terms.filter((t) => t.category === category).map((term, i) => (
                <Reveal key={term.term} delay={(i % 2) * 0.06}>
                  <Tile tint={tint === 'paper' ? 'stone' : 'white'} className="h-full">
                    <h3 className="display text-xl">{term.term}</h3>
                    <p className="mt-3 leading-relaxed text-ink/70">{term.definition}</p>
                  </Tile>
                </Reveal>
              ))}
            </div>
          </Chapter>
        );
      })}

      <Chapter tint="mint" from={(['paper', 'mint', 'butter', 'stone', 'peach'] as Tint[])[(categories.length - 1) % 5]} eyebrow="Quick reference" title="Three" accent="things to remember.">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            ['Prohibited', 'Riba (interest), Gharar (excessive uncertainty), Maysir (gambling)'],
            ['Key principles', 'Profit-sharing, risk-sharing, asset-backing, ethical investment'],
            ['In Indonesia', 'OJK regulates. A BPRS is a licensed Shariah bank and would be a partner bank in the later Deposito Pool. LPS covers bank depositors under its own rules, not the Tawf token'],
          ].map(([h, b]) => (
            <Tile key={h}>
              <h3 className="display text-xl">{h}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">{b}</p>
            </Tile>
          ))}
        </div>
      </Chapter>
    </PublicPage>
  );
}
