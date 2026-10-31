import { motion } from 'framer-motion';
import { ShieldCheck, Building, Store, Network } from 'lucide-react';
import { Section } from '../ui/Section';

const partnerCategories = [
  {
    icon: Building,
    title: 'Asset originators',
    description: 'Licensed originators keep the assets, the licence and the customer relationship. Tawf is their tokenization and verification partner, not an originator.',
    partners: ['Licensed SCF platforms', 'Shariah deposito aggregators', 'BPRS'],
    status: 'Originator Partnerships',
  },
  {
    icon: ShieldCheck,
    title: 'Licensed banks',
    description: 'Licensed Shariah rural banks (BPRS) hold each customer\'s deposito in the customer\'s own name. They are OJK-supervised, and LPS covers bank depositors under its own rules.',
    partners: ['BPRS', 'Shariah commercial bank'],
    status: 'Deposito Pool',
  },
  {
    icon: Store,
    title: 'Shariah Governance',
    description: 'Each offering is reviewed by the originator\'s Dewan Pengawas Syariah and an independent DSN-MUI-aligned board.',
    partners: ['Originator DPS', 'DSN-MUI Aligned', 'Independent Board'],
    status: 'Akad Reviewed Before Code',
  },
  {
    icon: Network,
    title: 'Ecosystem',
    description: 'Integrated with TID for identity, a licensed custodian for the digital-asset leg, and Arbitrum for settlement.',
    partners: ['TID', 'Licensed Custody', 'Arbitrum'],
    status: 'Full Stack Integration',
  },
];

export function Partners() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <Section id="partners" className="bg-tawf-sand">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <p className="label mb-4">Partners</p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-tawf-green mb-6">
            Built on Trusted
            <span className="block text-tawf-gold">Infrastructure</span>
          </h2>
          <p className="text-tawf-muted text-lg">
            We are not an originator. Licensed originators keep the assets and the
            customer relationship, and Tawf tokenizes and verifies each position on chain.
          </p>
        </motion.div>

        {/* Partner Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          {partnerCategories.map((category) => (
            <motion.div
              key={category.title}
              variants={itemVariants}
              className="p-8 rounded-2xl bg-white border border-tawf-green-10"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-tawf-green/10 flex items-center justify-center">
                  <category.icon className="w-7 h-7 text-tawf-green" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-xl text-tawf-green mb-2">
                    {category.title}
                  </h3>
                  <p className="text-tawf-muted text-sm leading-relaxed">
                    {category.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {category.partners.map((partner) => (
                  <span
                    key={partner}
                    className="px-4 py-2 rounded-full bg-tawf-sand text-tawf-green text-sm font-medium"
                  >
                    {partner}
                  </span>
                ))}
              </div>

              <p className="label text-tawf-gold">{category.status}</p>
            </motion.div>
          ))}
        </div>

        {/* Trust Statement */}
        <motion.div
          variants={itemVariants}
          className="text-center p-8 rounded-2xl bg-tawf-green/5 border border-tawf-green/10"
        >
          <p className="text-tawf-ink font-medium text-lg">
            &quot;We don&apos;t originate, underwrite or hold assets. We tokenize
            and verify what licensed originators offer.&quot;
          </p>
          <p className="text-tawf-muted mt-4">tawf.finance Operating Principle</p>
        </motion.div>
      </motion.div>
    </Section>
  );
}
