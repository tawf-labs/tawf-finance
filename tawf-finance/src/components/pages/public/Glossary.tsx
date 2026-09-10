import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';

export function Glossary() {
  const terms = [
    {
      term: 'Akad (Aqd)',
      definition: 'A contract or agreement in Islamic finance. In Tawf Finance, this refers to the agreement between investor and MSME for profit-sharing investment.',
      category: 'General',
    },
    {
      term: 'Bai Al-Inah',
      definition: 'A financing arrangement where the financier buys an asset from the customer on a deferred payment basis and immediately sells it back to the customer on a cash basis at a lower price.',
      category: 'Contracts',
    },
    {
      term: 'BPRS (Bank Pembiayaan Rakyat Syariah)',
      definition: 'A licensed Islamic rural bank in Indonesia. Unlike a BMT, a BPRS is OJK-supervised, LPS-insured, and may raise in the capital market under POJK 7/2024 Art 35. Tawf Finance\'s first customer segment.',
      category: 'Organizations',
    },
    {
      term: 'BMT (Baitul Maal wat Tamwil)',
      definition: 'Islamic cooperative financial institution in Indonesia combining social (Baitul Maal) and commercial (Baitul Tamwil) finance. Tawf\'s own organisational identity, and a later distribution channel for ZISWAF modules, not the first paying customer.',
      category: 'Organizations',
    },
    {
      term: 'Gharar',
      definition: 'Uncertainty or ambiguity in a contract. Islamic finance prohibits excessive uncertainty to ensure fairness and transparency.',
      category: 'Prohibitions',
    },
    {
      term: 'Halal',
      definition: 'Permissible or lawful according to Islamic law. All investments on Tawf Finance are halal-aligned.',
      category: 'General',
    },
    {
      term: 'Ijarah',
      definition: 'A leasing arrangement where the financier owns an asset and leases it to the user for a specified period and rental payment.',
      category: 'Contracts',
    },
    {
      term: 'Mudharabah',
      definition: 'A profit-sharing partnership where one party provides capital and the other provides expertise. Profits are shared according to a pre-agreed ratio, while losses are borne by the capital provider (unless due to misconduct).',
      category: 'Contracts',
    },
    {
      term: 'MSME',
      definition: 'Micro, Small, and Medium Enterprises. The underlying borrowers a BPRS finances. Tawf takes exposure to a pool of that financing, not to individual MSMEs directly.',
      category: 'Business',
    },
    {
      term: 'Musharakah',
      definition: 'A joint partnership where all parties contribute capital and share profits and losses according to their capital contribution ratio. One of the two candidate sell-down akad structures Tawf uses.',
      category: 'Contracts',
    },
    {
      term: 'NPF (Non-Performing Financing)',
      definition: 'The Shariah-finance equivalent of a non-performing loan ratio. A key, continuously verifiable metric of a BPRS financing pool\'s health on Tawf Finance.',
      category: 'Business',
    },
    {
      term: 'DPS (Dewan Pengawas Syariah)',
      definition: 'The Shariah Supervisory Board every BPRS is required to have. It reviews and signs off on the sell-down akad, making the structure the defensible asset.',
      category: 'Organizations',
    },
    {
      term: 'Financing Sell-Down',
      definition: 'Tawf\'s first product: a BPRS sells down economic exposure to a defined pool of its financing to an outside investor pool through a compliant akad, releasing balance-sheet capacity while retaining origination and servicing.',
      category: 'Products',
    },
    {
      term: 'Wakalah bil Istithmar',
      definition: 'An investment-agency akad in which an agent invests capital on behalf of a principal for a fee. One of the two candidate sell-down structures Tawf uses.',
      category: 'Contracts',
    },
    {
      term: 'Riba',
      definition: 'Interest or usury, strictly prohibited in Islamic finance. Tawf Finance uses profit-sharing models instead of interest-based lending.',
      category: 'Prohibitions',
    },
    {
      term: 'Shariah',
      definition: 'Islamic law derived from the Quran and Hadith. All financial products on Tawf Finance adhere to Shariah principles.',
      category: 'General',
    },
    {
      term: 'Soulbound NFT',
      definition: 'A digital receipt and proof of investment on Tawf Finance. Receipts are non-transferable at issuance. Transferable instruments are on the roadmap.',
      category: 'Technology',
    },
    {
      term: 'Sukuk',
      definition: 'Islamic bonds representing ownership in a tangible asset or project. For a BPRS, issuance under POJK 7/2024 Art 35 requires IDR 80bn+ core capital, so it is Tawf\'s tier-2 product, not the first.',
      category: 'Products',
    },
    {
      term: 'Tawf Score',
      definition: 'A proprietary scoring system for BPRS financing pools based on pool composition, NPF ratio, servicing track record, and akad compliance.',
      category: 'Platform',
    },
    {
      term: 'Tijarah',
      definition: 'Trade or commerce. Islam encourages trade and business activities that are fair and beneficial to society.',
      category: 'General',
    },
    {
      term: 'Wadiah',
      definition: 'A safe-keeping arrangement where goods or funds are deposited with someone else for safekeeping. Used for savings accounts in Islamic banking.',
      category: 'Contracts',
    },
    {
      term: 'Zakat',
      definition: 'A mandatory charitable contribution for eligible Muslims, typically 2.5% of accumulated wealth. Tawf Finance may integrate zakat calculation features.',
      category: 'General',
    },
  ];

  const categories = [...new Set(terms.map(t => t.category))];

  return (
    <div className="min-h-screen bg-tawf-sand">
      <Section className="py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-serif text-4xl md:text-5xl text-tawf-green text-center mb-4">
            Glossary
          </h1>
          <p className="text-tawf-muted text-center mb-12">
            Key terms and concepts in Islamic finance and the Tawf Finance platform
          </p>

          {/* Categories */}
          <div className="mb-8">
            <h2 className="font-serif text-2xl text-tawf-green mb-6">Categories</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <a
                  key={category}
                  href={`#${category.toLowerCase().replace(' ', '-')}`}
                  className="px-4 py-2 bg-white border border-tawf-green-10 rounded-full text-sm hover:border-tawf-green hover:bg-tawf-green-5 transition-colors"
                >
                  {category}
                </a>
              ))}
            </div>
          </div>

          {/* Terms by Category */}
          {categories.map((category) => (
            <div key={category} id={category.toLowerCase().replace(' ', '-')} className="mb-12">
              <h2 className="font-serif text-xl text-tawf-green mb-6 flex items-center gap-3">
                <span className="w-2 h-2 bg-tawf-gold rounded-full" />
                {category}
              </h2>
              <div className="space-y-4">
                {terms.filter(t => t.category === category).map((term, index) => (
                  <Card key={index} className="p-6">
                    <h3 className="font-serif text-lg text-tawf-green mb-2">{term.term}</h3>
                    <p className="text-tawf-muted">{term.definition}</p>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {/* Quick Reference */}
          <Card className="p-8 mt-12 bg-tawf-green text-white">
            <h2 className="font-serif text-xl mb-4">Quick Reference</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-medium mb-2">Prohibited</h3>
                <p className="text-sm text-tawf-sand-80">Riba (interest), Gharar (excessive uncertainty), Maysir (gambling)</p>
              </div>
              <div>
                <h3 className="font-medium mb-2">Key Principles</h3>
                <p className="text-sm text-tawf-sand-80">Profit-sharing, risk-sharing, asset-backing, ethical investment</p>
              </div>
              <div>
                <h3 className="font-medium mb-2">In Indonesia</h3>
                <p className="text-sm text-tawf-sand-80">OJK regulates. A BPRS is a licensed, LPS-insured Shariah bank and the first originator segment</p>
              </div>
            </div>
          </Card>
        </div>
      </Section>
    </div>
  );
}
