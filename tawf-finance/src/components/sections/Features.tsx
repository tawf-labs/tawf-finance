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
    title: 'Ethical Investing',
    description: 'Take exposure to a licensed Shariah bank\'s financing pool through a compliant akad, not speculation.',
    label: 'Core Product',
  },
  {
    icon: Receipt,
    title: 'Tamper-Proof Digital Receipts',
    description: 'Every investment is recorded as a soulbound receipt tied to a specific financing pool. It stays with you until principal and profit are returned.',
    label: 'Technology',
  },
  {
    icon: Coins,
    title: 'From $10 Minimum',
    description: 'Anyone can participate. Pool your money with others to take exposure to a defined pool of BPRS financing and earn a share of the profit.',
    label: 'Accessibility',
  },
  {
    icon: TrendingUp,
    title: 'Returns From Serviced Financing',
    description: 'Returns come from the bank servicing and remitting real financing repayments. When the pool performs, you get paid.',
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
    title: 'Verifiable Pool. Borrowers Stay Private.',
    description: 'Verify pool size, NPF ratio, and akad compliance continuously, without the bank exposing a single borrower identity or contract.',
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
            Ethical Investing. Real Impact.
            <span className="block text-tawf-gold">Real Yield + Good Deeds.</span>
          </h2>
          <p className="text-tawf-muted text-lg">
            A licensed Shariah bank originates and services the financing. You take exposure to a defined pool of it, on-chain.
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
