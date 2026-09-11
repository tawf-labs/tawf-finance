import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  Users,
  Building2,
  TrendingUp,
  Globe,
  HeartHandshake,
  Sprout,
} from 'lucide-react';
import { Section } from '../ui/Section';

const stats = [
  {
    icon: Building2,
    value: '~175',
    label: 'Indonesian BPRS',
    description: 'Licensed Shariah rural banks, the first customer segment.',
  },
  {
    icon: TrendingUp,
    value: '250bp',
    label: 'Funding Cost Gap',
    description: 'LPS caps BPRS deposits at 6.25% vs 3.75% for commercial banks.',
  },
  {
    icon: Users,
    value: 'SLIK',
    label: 'Regulator Attestation',
    description: 'BPRS are OJK-supervised, LPS-insured, audited, and report into SLIK.',
  },
  {
    icon: Globe,
    value: '$10',
    label: 'Minimum Investment',
    description: 'Democratizing access to real serviced financing for everyone.',
  },
];

const impacts = [
  {
    icon: HeartHandshake,
    title: 'Wider Funding Channel',
    description: 'A BPRS pays the highest deposit rates in the system and can only fund inside its own district. We open a funding channel priced outside its local deposit market.',
  },
  {
    icon: Sprout,
    title: 'Balance-Sheet Capacity',
    description: 'Selling down a financing pool releases CAR and BMPK capacity so the bank can keep growing its book, while retaining origination and servicing revenue.',
  },
  {
    icon: Building2,
    title: 'Bank Keeps the Relationship',
    description: 'The BPRS keeps originating and servicing its own financing while tawf.finance provides the structuring, rails, and verification. Everyone wins.',
  },
];

export function Impact() {
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

  const counterVariants: Variants = {
    hidden: { scale: 0.5, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <Section id="impact" className="bg-tawf-green text-tawf-sand">
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
          <p className="label mb-4 text-tawf-gold">Impact</p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl mb-6">
            From Profit into
            <span className="block text-tawf-gold">Purpose</span>
          </h2>
          <p className="text-tawf-sand/70 text-lg">
            We&apos;re not building another DeFi yield farm. We give a licensed
            Shariah bank a wider funding channel, and give everyday investors
            verifiable exposure to real serviced financing. Tawf&apos;s own
            identity stays Baitul Tamwil.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              className="text-center p-6 rounded-2xl bg-tawf-green-light/30 border border-tawf-green-20"
            >
              <motion.div variants={counterVariants} className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-tawf-gold/20 flex items-center justify-center">
                  <stat.icon className="w-7 h-7 text-tawf-gold" strokeWidth={1.5} />
                </div>
              </motion.div>
              <p className="font-serif text-4xl md:text-5xl text-tawf-gold mb-2">
                {stat.value}
              </p>
              <p className="font-medium text-tawf-sand mb-2">{stat.label}</p>
              <p className="text-sm text-tawf-sand/60">{stat.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Impact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {impacts.map((impact) => (
            <motion.div
              key={impact.title}
              variants={itemVariants}
              className="p-8 rounded-2xl bg-tawf-sand/10 border border-tawf-green-20"
            >
              <div className="w-14 h-14 rounded-full bg-tawf-gold/20 flex items-center justify-center mb-6">
                <impact.icon className="w-7 h-7 text-tawf-gold" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-xl text-tawf-gold mb-3">
                {impact.title}
              </h3>
              <p className="text-tawf-sand/70 leading-relaxed">
                {impact.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </Section>
  );
}
