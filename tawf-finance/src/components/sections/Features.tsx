import { motion } from 'framer-motion';
import {
  Shield,
  Receipt,
  Coins,
  TrendingUp,
  Users,
  Lock,
} from 'lucide-react';
import { FeatureCard } from '../ui/FeatureCard';
import { Section } from '../ui/Section';

const features = [
  {
    icon: Shield,
    title: 'Ethical Staking',
    description: 'Earn real returns the halal way. We fund real businesses, not speculation.',
    label: 'Core Product',
  },
  {
    icon: Receipt,
    title: 'Tamper-Proof Digital Receipts',
    description: 'Every investment is recorded as a digital receipt. It stays with you until your money is returned with profit. No trading, no games.',
    label: 'Technology',
  },
  {
    icon: Coins,
    title: 'From $10 Minimum',
    description: 'Anyone can participate. Pool your money with others to fund a local business and earn a share of the profit.',
    label: 'Accessibility',
  },
  {
    icon: TrendingUp,
    title: '8-18% Annualized Yield',
    description: 'Returns come from real business repayments only. When the business gets paid, you get paid.',
    label: 'Returns',
  },
  {
    icon: Users,
    title: 'Simple Verification',
    description: 'Sign in with your Tawf ID. No complicated setup. Your identity stays private.',
    label: 'Identity',
  },
  {
    icon: Lock,
    title: 'Real Assets. Real Demand. Sharia-Compliant.',
    description: 'We only fund businesses selling real, everyday products — food, herbal goods, and more. Nothing speculative.',
    label: 'Core Principle',
  },
];

export function Features() {
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
    <Section id="features" className="bg-white">
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
          <p className="label mb-4">Why tawf.finance</p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-tawf-green mb-6">
            Ethical Staking. Real Impact.
            <span className="block text-tawf-gold">Real Yield + Good Deeds.</span>
          </h2>
          <p className="text-tawf-muted text-lg">
            We fund real trade between local businesses and major retailers across Southeast Asia.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((feature) => (
            <motion.div key={feature.title} variants={itemVariants} className="h-full">
              <FeatureCard {...feature} />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </Section>
  );
}
