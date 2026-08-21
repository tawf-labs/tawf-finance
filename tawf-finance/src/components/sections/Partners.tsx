import { motion } from 'framer-motion';
import { ShieldCheck, Building, Store, Network } from 'lucide-react';
import { Section } from '../ui/Section';

const partnerCategories = [
  {
    icon: ShieldCheck,
    title: 'Sekuritas Partners',
    description: 'Licensed financial firms who issue the investment instruments. They handle the regulation so you don\'t have to worry about it.',
    partners: ['Ina Sekuritas', 'Trimegah Sekuritas', 'Mandiri Sekuritas'],
    status: 'Plan A • Plan B • Plan C',
  },
  {
    icon: Building,
    title: 'Cooperative Network',
    description: 'BMTs and Islamic cooperatives provide the trusted relationship layer with businesses across Southeast Asia.',
    partners: ['PBMT Ventura', 'BMT UGT Sidogiri', '4,500+ Cooperatives'],
    status: 'Nationwide Coverage',
  },
  {
    icon: Store,
    title: 'Major Retailers',
    description: 'Southeast Asia\'s largest retailers provide reliable repayment through verified purchase orders.',
    partners: ['Indomaret', 'Alfamart', 'Ethical Distributors'],
    status: '46,000+ Stores Combined',
  },
  {
    icon: Network,
    title: 'Ecosystem',
    description: 'Integrated with TID for identity verification and Arbitrum for settlement.',
    partners: ['TID', 'Arbitrum'],
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
            We don&apos;t compete with banks or cooperatives. We give them better tools,
            and connect their businesses to investors who care.
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
            &quot;We don&apos;t hold your funds. We don&apos;t issue bonds.
            We build the technology that connects investors to real businesses.&quot;
          </p>
          <p className="text-tawf-muted mt-4">tawf.finance Operating Principle</p>
        </motion.div>
      </motion.div>
    </Section>
  );
}
