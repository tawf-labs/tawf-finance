import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { TrendingUp, Clock, DollarSign, Lock } from 'lucide-react';
import { Card } from '../ui/Card';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';

interface Pool {
  id: string;
  name: string;
  description: string;
  apy: string;
  duration: string;
  minInvestment: string;
  tvl: string;
  available: boolean;
  category: string;
}

const pools: Pool[] = [
  {
    id: 'bprs-amanah-microtrade',
    name: 'BPRS Amanah Micro-Trade',
    description: 'Take exposure to a pool of micro-trade financing originated and serviced by a licensed Shariah bank, under a wakalah bil istithmar akad.',
    apy: '12-16%',
    duration: '30-60 days',
    minInvestment: '$10',
    tvl: '$125,000',
    available: true,
    category: 'Micro-Trade',
  },
  {
    id: 'bprs-barokah-agri',
    name: 'BPRS Barokah Agri Financing',
    description: 'A pool of seasonal agricultural financing serviced by the originating BPRS. NPF ratio and akad compliance are verifiable on-chain.',
    apy: '13-17%',
    duration: '45-90 days',
    minInvestment: '$25',
    tvl: '$89,000',
    available: true,
    category: 'Agriculture',
  },
  {
    id: 'bprs-sejahtera-sme',
    name: 'BPRS Sejahtera SME',
    description: 'Exposure to a pool of small-enterprise financing, structured as a musyarakah sell-down. The bank retains origination and servicing.',
    apy: '11-15%',
    duration: '60-90 days',
    minInvestment: '$25',
    tvl: '$67,000',
    available: true,
    category: 'SME Financing',
  },
  {
    id: 'bprs-amanah-consumer',
    name: 'BPRS Amanah Consumer',
    description: 'A pool of Shariah consumer financing. Verify pool size, NPF ratio, and akad compliance without any borrower being exposed.',
    apy: '10-14%',
    duration: '60-90 days',
    minInvestment: '$15',
    tvl: '$45,000',
    available: true,
    category: 'Consumer Financing',
  },
  {
    id: 'bprs-barokah-trade',
    name: 'BPRS Barokah Trade',
    description: 'Exposure to a pool of working-capital trade financing serviced locally by the originating BPRS, funded outside its deposit market.',
    apy: '12-16%',
    duration: '45-75 days',
    minInvestment: '$20',
    tvl: '$38,000',
    available: true,
    category: 'Trade Financing',
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

function PoolCard({ pool }: { pool: Pool }) {
  return (
    <motion.div variants={itemVariants}>
      <Card hover className="h-full p-6">
        <div className="flex items-start justify-between mb-4">
          <span className="text-xs uppercase tracking-wide text-tawf-green font-medium">
            {pool.category}
          </span>
          {pool.available ? (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Open
            </span>
          ) : (
            <span className="text-xs text-tawf-muted bg-tawf-sand-50 px-2 py-1 rounded-full">
              Full
            </span>
          )}
        </div>

        <h3 className="font-serif text-xl text-tawf-green mb-2">{pool.name}</h3>
        <p className="text-tawf-muted text-sm leading-relaxed mb-6">
          {pool.description}
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-tawf-gold" />
            <div>
              <p className="text-xs text-tawf-muted">APY</p>
              <p className="font-medium text-tawf-green">{pool.apy}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-tawf-gold" />
            <div>
              <p className="text-xs text-tawf-muted">Duration</p>
              <p className="font-medium text-tawf-green">{pool.duration}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-tawf-gold" />
            <div>
              <p className="text-xs text-tawf-muted">Min Investment</p>
              <p className="font-medium text-tawf-green">{pool.minInvestment}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-tawf-gold" />
            <div>
              <p className="text-xs text-tawf-muted">TVL</p>
              <p className="font-medium text-tawf-green">{pool.tvl}</p>
            </div>
          </div>
        </div>

        {pool.available ? (
          <a href="https://app.tawf.finance/login" className="block">
            <Button size="md" className="w-full">
              Invest Now
            </Button>
          </a>
        ) : (
          <Button size="md" className="w-full" disabled>
            Pool Full
          </Button>
        )}
      </Card>
    </motion.div>
  );
}

export function Earn() {
  return (
    <div className="min-h-screen bg-tawf-sand">
      <Section className="py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center mb-16"
        >
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-tawf-green leading-[1.1] mb-6">
            Earn Real Yield,
            <span className="block text-tawf-gold">Create Real Impact</span>
          </h1>
          <p className="text-tawf-muted text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            Choose from live pools of financing originated and serviced by licensed Indonesian BPRS.
            Each pool is a compliant sell-down akad, verifiable on-chain.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
        >
          {pools.map((pool) => (
            <PoolCard key={pool.id} pool={pool} />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="max-w-3xl mx-auto mt-16"
        >
          <Card className="p-8 bg-tawf-green/5">
            <h3 className="font-serif text-2xl text-tawf-green mb-4">How It Works</h3>
            <ol className="space-y-4 text-tawf-muted">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-tawf-green text-white flex items-center justify-center font-medium">
                  1
                </span>
                <div>
                  <p className="font-medium text-tawf-green">Select a Pool</p>
                  <p className="text-sm">Choose from live BPRS financing pools by segment, NPF ratio, and target profit.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-tawf-green text-white flex items-center justify-center font-medium">
                  2
                </span>
                <div>
                  <p className="font-medium text-tawf-green">Connect & Take Exposure</p>
                  <p className="text-sm">Connect your wallet and take exposure from $10. Your funds go into a secure escrow.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-tawf-green text-white flex items-center justify-center font-medium">
                  3
                </span>
                <div>
                  <p className="font-medium text-tawf-green">Earn Returns</p>
                  <p className="text-sm">The BPRS services and remits collections. Redeem principal and profit at maturity.</p>
                </div>
              </li>
            </ol>
          </Card>
        </motion.div>
      </Section>
    </div>
  );
}
