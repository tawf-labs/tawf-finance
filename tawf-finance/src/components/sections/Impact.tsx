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
    icon: Users,
    value: '64M+',
    label: 'Southeast Asian MSMEs',
    description: 'Potential beneficiaries across the archipelago.',
  },
  {
    icon: Building2,
    value: '4,500+',
    label: 'BMT Cooperatives',
    description: 'BMT cooperatives for origination.',
  },
  {
    icon: TrendingUp,
    value: '20M+',
    label: 'Cooperative Members',
    description: 'Existing BMT members ready for ethical finance.',
  },
  {
    icon: Globe,
    value: '$10',
    label: 'Minimum Investment',
    description: 'Democratizing access to real yield for everyone.',
  },
];

const impacts = [
  {
    icon: HeartHandshake,
    title: 'Economic Inclusion',
    description: 'Bring financial access to the businesses traditional banks ignore. Millions of small businesses across Southeast Asia still lack access to fair credit.',
  },
  {
    icon: Sprout,
    title: 'Green Finance',
    description: 'Every deal supports ethical, sustainable businesses aligned with responsible finance principles.',
  },
  {
    icon: Building2,
    title: 'Cooperative Empowerment',
    description: 'Local cooperatives keep their relationships with businesses while tawf.finance handles the technology. Everyone wins.',
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
            We&apos;re not building another DeFi yield farm. We&apos;re rebuilding
            Baitul Tamwil for the digital age: community finance that actually
            serves communities.
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
