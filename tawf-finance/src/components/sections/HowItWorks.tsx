import { motion } from 'framer-motion';
import {
  Building,
  FileCheck,
  Wallet,
  ChevronRight,
  Store,
  CheckCircle,
} from 'lucide-react';
import { Section } from '../ui/Section';

const steps = [
  {
    number: '01',
    icon: Building,
    title: 'BPRS Originates Financing',
    description: 'A licensed Shariah bank (BPRS) originates and services Shariah financing locally, the way it already does today.',
    role: 'BPRS',
  },
  {
    number: '02',
    icon: FileCheck,
    title: 'DPS Reviews the Sell-Down Akad',
    description: 'The bank\'s Dewan Pengawas Syariah reviews the sell-down structure (wakalah bil istithmar or musyarakah). The akad is the defensible asset.',
    role: 'DPS',
  },
  {
    number: '03',
    icon: Store,
    title: 'Financing Pool Registered',
    description: 'A defined pool of the bank\'s financing is registered on-chain. tawf.finance creates your soulbound receipt tied to this specific pool.',
    role: 'Tawf',
  },
  {
    number: '04',
    icon: Wallet,
    title: 'You Take Exposure',
    description: 'Sign in, pick a pool, and invest from $10. Your money goes into a secure escrow, not to tawf.finance.',
    role: 'Investor',
  },
  {
    number: '05',
    icon: Building,
    title: 'The Bank Services and Remits',
    description: 'The BPRS keeps servicing the underlying financing and remits collections. It releases balance-sheet capacity while keeping origination revenue.',
    role: 'BPRS',
  },
  {
    number: '06',
    icon: CheckCircle,
    title: 'You Get Paid',
    description: 'Once the pool matures, your principal and profit are released to your wallet and the receipt is burned. Done.',
    role: 'Investor',
  },
];

export function HowItWorks() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <Section id="how-it-works" className="bg-tawf-sand">
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
          <p className="label mb-4">The Flow</p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-tawf-green mb-6">
            How Ethical Investing
            <span className="block text-tawf-gold">Actually Works</span>
          </h2>
          <p className="text-tawf-muted text-lg">
            Simple, transparent, and fair. Every deal is traceable from start to finish.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              variants={itemVariants}
              className="relative"
            >
              {/* Connector Line (not on last item) */}
              {index < steps.length - 1 && (
                <div className="absolute left-8 md:left-12 top-20 w-0.5 h-full bg-tawf-green/10 -z-10" />
              )}

              <div
                className={`flex flex-col md:flex-row items-start md:items-center gap-6 p-6 rounded-2xl transition-all duration-300 ${
                  index % 2 === 0
                    ? 'bg-white'
                    : 'bg-white/50'
                }`}
              >
                {/* Number Badge */}
                <div className="flex-shrink-0 w-16 h-16 md:w-24 md:h-24 rounded-full bg-tawf-green flex items-center justify-center">
                  <span className="font-serif text-2xl md:text-3xl text-tawf-sand">
                    {step.number}
                  </span>
                </div>

                {/* Icon (hidden on small screens, shown on medium+) */}
                <div className="hidden md:flex flex-shrink-0 w-14 h-14 rounded-full bg-tawf-gold/10 items-center justify-center">
                  <step.icon className="w-7 h-7 text-tawf-gold" strokeWidth={1.5} />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                    <h3 className="font-serif text-xl md:text-2xl text-tawf-green">
                      {step.title}
                    </h3>
                    <span className="inline-block px-3 py-1 rounded-full bg-tawf-gold/10 text-tawf-gold text-xs font-medium uppercase tracking-wider w-fit">
                      {step.role}
                    </span>
                  </div>
                  <p className="text-tawf-muted leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Arrow (hidden on mobile) */}
                {index < steps.length - 1 && (
                  <ChevronRight className="hidden lg:block w-6 h-6 text-tawf-gold/30" />
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          variants={itemVariants}
          className="mt-16 text-center"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-tawf-green border border-tawf-green-20">
            <p className="text-tawf-sand font-medium">
              Ready to take exposure to real Islamic bank financing?
            </p>
            <a
              href="#"
              className="px-6 py-3 rounded-full bg-tawf-gold text-tawf-green font-medium text-sm uppercase tracking-wide hover:bg-white transition-colors whitespace-nowrap"
            >
              View Financing Pools
            </a>
          </div>
        </motion.div>
      </motion.div>
    </Section>
  );
}
