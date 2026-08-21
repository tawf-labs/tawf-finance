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
      term: 'BMT (Baitul Maal wat Tamwil)',
      definition: 'Islamic cooperative financial institution in Indonesia that combines savings and financing activities. BMTs serve as crucial intermediaries for MSME financing.',
      category: 'Organizations',
    },
    {
      term: 'Gharar',
      definition: 'Uncertainty or ambiguity in a contract. Islamic finance prohibits excessive uncertainty to ensure fairness and transparency.',
      category: 'Prohibitions',
    },
    {
      term: 'Halal',
      definition: 'Permissible or lawful according to Islamic law. All investments on Tawf Finance are halal-compliant.',
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
      definition: 'Micro, Small, and Medium Enterprises. Tawf Finance focuses on supporting these businesses which often lack access to traditional banking services.',
      category: 'Business',
    },
    {
      term: 'Musharakah',
      definition: 'A joint partnership where all parties contribute capital and share profits and losses according to their capital contribution ratio.',
      category: 'Contracts',
    },
    {
      term: 'NBP (Non-Bank Financial Institution)',
      definition: 'Financial institutions that are not banks but provide financial services. BMTs fall under this category in Indonesia.',
      category: 'Organizations',
    },
    {
      term: 'PO (Purchase Order)',
      definition: 'A commercial document issued by a buyer to a seller indicating types, quantities, and agreed prices for products or services. MSMEs use POs to request funding.',
      category: 'Business',
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
      definition: 'Islamic bonds that represent ownership in a tangible asset or a specific project. Tawf Finance may offer sukuk-like structures in the future.',
      category: 'Products',
    },
    {
      term: 'Tawf Score',
      definition: 'A proprietary credit scoring system for MSMEs based on alternative data like transaction history, cooperative relationships, and business performance.',
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
                <p className="text-sm text-tawf-sand-80">OJK regulates, BMTs serve as key intermediaries for MSMEs</p>
              </div>
            </div>
          </Card>
        </div>
      </Section>
    </div>
  );
}
