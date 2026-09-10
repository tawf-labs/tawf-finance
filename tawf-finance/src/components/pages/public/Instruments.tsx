import { motion } from 'framer-motion';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import {
  instrumentCatalog,
  type AkadFamily,
  type InstrumentStatus,
} from '@/data/mockData';

const familyOrder: AkadFamily[] = ['Debt-based', 'Equity-based', 'Tradable', 'Social'];

const familyBlurb: Record<AkadFamily, string> = {
  'Debt-based': 'Sale and lease structures with a defined return. Debt-like risk, lower band.',
  'Equity-based': 'Partnership and agency structures that share real profit and loss.',
  'Tradable': 'Certificate structures built for transfer once the licensing path is clear.',
  'Social': 'Benevolent, principal-only structures funded through the Baitul Maal side.',
};

function statusStyle(status: InstrumentStatus): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'Live':
      return { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' };
    case 'Structured':
      return { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' };
    case 'Pipeline':
      return { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' };
    case 'Roadmap':
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  }
}

export function Instruments() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <div className="min-h-screen bg-tawf-sand">
      {/* Hero */}
      <Section className="py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto text-center"
        >
          <span className="text-tawf-gold uppercase tracking-widest text-sm font-medium">
            The Platform
          </span>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-tawf-green leading-[1.1] mt-4 mb-6">
            One Infrastructure for Every
            <span className="block text-tawf-gold">Islamic Finance Akad</span>
          </h1>
          <p className="text-tawf-muted text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            Tawf is the all-in-one tokenization infrastructure a BPRS builds on. Every akad
            it originates can be structured, represented, and settled on one primitive.
            Returns start from 5 percent, priced to the real economics of each structure.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <span className="px-4 py-2 rounded-full bg-white text-tawf-green text-sm font-medium">
              9 instruments
            </span>
            <span className="px-4 py-2 rounded-full bg-white text-tawf-green text-sm font-medium">
              4 akad families
            </span>
            <span className="px-4 py-2 rounded-full bg-white text-tawf-green text-sm font-medium">
              From 5 percent
            </span>
          </div>
          <p className="text-tawf-muted text-sm mt-6 max-w-2xl mx-auto">
            Status labels are honest about what is live today. The financing sell-down
            (Murabaha and Musyarakah) is the entry product. Others are structured, in the
            pipeline, or on the roadmap.
          </p>
        </motion.div>
      </Section>

      {/* Instrument families */}
      {familyOrder.map((family) => {
        const items = instrumentCatalog.filter((i) => i.family === family);
        if (items.length === 0) return null;
        return (
          <Section key={family} className="py-12 border-t border-tawf-green/10">
            <div className="max-w-6xl mx-auto">
              <div className="mb-8">
                <h2 className="font-serif text-2xl md:text-3xl text-tawf-green mb-2 flex items-center gap-3">
                  <span className="w-2 h-2 bg-tawf-gold rounded-full" />
                  {family}
                </h2>
                <p className="text-tawf-muted">{familyBlurb[family]}</p>
              </div>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {items.map((inst) => {
                  const s = statusStyle(inst.status);
                  return (
                    <motion.div key={inst.id} variants={itemVariants}>
                      <Card className="p-6 h-full flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-serif text-xl text-tawf-green">{inst.name}</h3>
                            <p className="text-tawf-muted text-sm" lang="ar" dir="rtl">
                              {inst.arabic}
                            </p>
                          </div>
                          <span
                            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {inst.status}
                          </span>
                        </div>

                        <p className="text-tawf-muted text-sm leading-relaxed mb-4 flex-1">
                          {inst.summary}
                        </p>

                        <div className="space-y-2 text-sm border-t border-tawf-green/10 pt-4">
                          <div className="flex justify-between gap-4">
                            <span className="text-tawf-muted">Typical use</span>
                            <span className="text-tawf-green text-right">{inst.useCase}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-tawf-muted">Return band</span>
                            <span className="text-tawf-green font-medium text-right">
                              {inst.yieldBand}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-tawf-muted">Reference</span>
                            <span className="text-tawf-green text-right">{inst.dsnRef}</span>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </Section>
        );
      })}

      {/* Honest footer note */}
      <Section className="py-16 border-t border-tawf-green/10">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8 bg-tawf-green text-tawf-sand">
            <h2 className="font-serif text-xl mb-3">How to read the status labels</h2>
            <ul className="space-y-3 text-sm text-tawf-sand/90">
              <li>
                <span className="font-medium text-tawf-gold">Live.</span> Structured with a
                partner DPS and running in the demo today.
              </li>
              <li>
                <span className="font-medium text-tawf-gold">Structured.</span> Akad drafted
                and modeled, awaiting a design-partner bank to validate.
              </li>
              <li>
                <span className="font-medium text-tawf-gold">Pipeline.</span> Scoped for a
                specific segment, not yet drafted.
              </li>
              <li>
                <span className="font-medium text-tawf-gold">Roadmap.</span> Planned once the
                capital and licensing conditions are met (Sukuk needs IDR 80bn core capital).
              </li>
            </ul>
          </Card>
        </div>
      </Section>
    </div>
  );
}
