import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { TrendingUp, Clock, DollarSign, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
import { cn } from '@/utils/cn';

interface Pool {
  id: string;
  name: string;
  description: string;
  apy: string;
  duration: string;
  minInvestment: string;
  tvl: string;
  available: boolean;
  comingSoon?: boolean;
  category: string;
}

const pools: Pool[] = [
  {
    id: 'kurban-farms',
    name: 'Kurban Farms Pool',
    description: 'Support livestock farmers with ethical financing for cattle, goats, and sheep. Earn returns from seasonal demand cycles.',
    apy: '12-18%',
    duration: '30-60 days',
    minInvestment: '$10',
    tvl: '$125,000',
    available: true,
    comingSoon: false,
    category: 'Agriculture',
  },
  {
    id: 'warung',
    name: 'Warung Pool',
    description: 'Fund neighborhood convenience stores (warungs) across Indonesia. Help small retailers restock inventory and grow their business.',
    apy: '10-15%',
    duration: '30-45 days',
    minInvestment: '$10',
    tvl: '$89,000',
    available: false,
    comingSoon: true,
    category: 'Retail',
  },
  {
    id: 'jamu-herbal',
    name: 'Jamu & Herbal Pool',
    description: "Finance traditional herbal medicine producers. Support Indonesia's natural wellness industry while earning steady yields.",
    apy: '14-20%',
    duration: '45-90 days',
    minInvestment: '$25',
    tvl: '$67,000',
    available: false,
    comingSoon: true,
    category: 'Health & Wellness',
  },
  {
    id: 'organic-food',
    name: 'Organic Food Pool',
    description: 'Back organic farmers and sustainable food producers. Your investment supports chemical-free agriculture and healthy food access.',
    apy: '10-16%',
    duration: '60-90 days',
    minInvestment: '$15',
    tvl: '$45,000',
    available: false,
    comingSoon: true,
    category: 'Agriculture',
  },
  {
    id: 'artisan-goods',
    name: 'Artisan Goods Pool',
    description: 'Fund traditional craftsmen and women creating batik, pottery, woodwork, and other cultural heritage products.',
    apy: '12-17%',
    duration: '45-75 days',
    minInvestment: '$20',
    tvl: '$38,000',
    available: false,
    comingSoon: true,
    category: 'Crafts & Heritage',
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

function PoolCard({ pool }: { pool: Pool }) {
  const navigate = useNavigate();
  return (
    <motion.div variants={itemVariants}>
      <Card hover className={cn('h-full p-6', pool.comingSoon && 'opacity-60')}>
        <div className="flex items-start justify-between mb-4">
          <span className="text-xs uppercase tracking-wide text-tawf-green font-medium">{pool.category}</span>
          {pool.available ? (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Open
            </span>
          ) : (
            <span className="text-xs text-tawf-muted bg-tawf-sand-50 px-2 py-1 rounded-full">Full</span>
          )}
        </div>
        <h3 className="font-serif text-xl text-tawf-green mb-2">{pool.name}</h3>
        <p className="text-tawf-muted text-sm leading-relaxed mb-6">{pool.description}</p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-tawf-gold" />
            <div><p className="text-xs text-tawf-muted">APY</p><p className="font-medium text-tawf-green">{pool.apy}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-tawf-gold" />
            <div><p className="text-xs text-tawf-muted">Duration</p><p className="font-medium text-tawf-green">{pool.duration}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-tawf-gold" />
            <div><p className="text-xs text-tawf-muted">Min Investment</p><p className="font-medium text-tawf-green">{pool.minInvestment}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-tawf-gold" />
            <div><p className="text-xs text-tawf-muted">TVL</p><p className="font-medium text-tawf-green">{pool.tvl}</p></div>
          </div>
        </div>
        <Button size="md" className="w-full" disabled={!pool.available} onClick={() => navigate('/investor/dashboard')}>
          {pool.comingSoon ? 'Coming Soon' : pool.available ? 'Stake Now' : 'Pool Full'}
        </Button>
      </Card>
    </motion.div>
  );
}

export function InvestmentPools() {
  return (
    <Section className="py-20" id="pools">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto text-center mb-16"
      >
        <h2 className="font-serif text-4xl md:text-5xl text-tawf-green leading-[1.1] mb-6">
          Earn Real Yield,
          <span className="block text-tawf-gold">Create Real Impact</span>
        </h2>
        <p className="text-tawf-muted text-lg leading-relaxed max-w-2xl mx-auto">
          Choose from our curated pools of vetted MSMEs across Southeast Asia.
          Each investment supports real businesses and generates real returns.
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
      >
        {pools.map((pool) => (
          <PoolCard key={pool.id} pool={pool} />
        ))}
      </motion.div>
    </Section>
  );
}
