import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  Wallet,
  Heart,
  ArrowUpRight,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { TransactionRow } from '@/components/ui/TransactionRow';
import { Badge } from '@/components/ui/Badge';
import { InvestmentCard } from '@/components/ui/InvestmentCard';
import { useMockData } from '@/hooks/useMockData';
import { mockPools } from '@/data/mockData';

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
    transition: { duration: 0.5 },
  },
};

export function InvestorDashboard() {
  const { portfolioStats, transactions, investments, formatCurrency } = useMockData();

  // Calculate portfolio value chart data (mock)
  const portfolioChartData = useMemo(() => {
    return [
      { month: 'Jan', value: 4500 },
      { month: 'Feb', value: 4750 },
      { month: 'Mar', value: 5100 },
      { month: 'Apr', value: 5250 },
      { month: 'May', value: 5550 },
      { month: 'Jun', value: 5800 },
    ];
  }, []);

  const maxChartDataValue = Math.max(...portfolioChartData.map(d => d.value));

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Investor Dashboard</h1>
        <p className="text-tawf-muted">Welcome back! Here's your investment overview.</p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Invested"
          value={formatCurrency(portfolioStats?.totalInvested || 0)}
          change={12.5}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Active Earnings"
          value={formatCurrency(portfolioStats?.totalReturns || 0)}
          change={8.2}
          icon={<DollarSign className="w-5 h-5" />}
          color="gold"
        />
        <StatCard
          title="Available Balance"
          value={formatCurrency(portfolioStats?.availableBalance || 0)}
          icon={<Wallet className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Active Investments"
          value={portfolioStats?.activeInvestments || 0}
          change={1}
          changeType="absolute"
          icon={<Heart className="w-5 h-5" />}
          color="green"
        />
      </motion.div>

      {/* Portfolio Chart */}
      <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-tawf-green-10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-serif text-xl text-tawf-green">Portfolio Value</h2>
            <p className="text-sm text-tawf-muted">Last 6 months</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" size="sm">+12.5%</Badge>
          </div>
        </div>

        {/* Simple Bar Chart */}
        <div className="h-48 flex items-end justify-between gap-2">
          {portfolioChartData.map((data, index) => (
            <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-tawf-green-10 rounded-t-lg relative group">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(data.value / maxChartDataValue) * 100}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  className="absolute bottom-0 left-0 right-0 bg-tawf-green rounded-t-lg group-hover:bg-tawf-gold transition-colors"
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-tawf-ink text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {formatCurrency(data.value)}
                </div>
              </div>
              <span className="text-xs text-tawf-muted">{data.month}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Active Investments & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Investments */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-tawf-green">Active Investments</h2>
            <Link to="/investor/portfolio" className="text-sm text-tawf-gold hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {investments.filter(i => i.status === 'active').slice(0, 3).map((investment) => (
              <div key={investment.id} className="bg-white rounded-xl border border-tawf-green-10 p-4 hover:border-tawf-green-20 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-tawf-green">{investment.poolName}</h3>
                    <p className="text-xs text-tawf-muted">Invested {formatCurrency(investment.amount)}</p>
                  </div>
                  <Badge variant="success" size="sm">Active</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-tawf-muted">APY:</span>
                    <span className="text-tawf-green font-medium ml-1">{investment.apy}%</span>
                  </div>
                  <div>
                    <span className="text-tawf-muted">Returns:</span>
                    <span className="text-tawf-gold font-medium ml-1">{formatCurrency(investment.currentReturn)}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-tawf-muted mb-1">
                    <span>Progress</span>
                    <span>{Math.round((investment.currentReturn / investment.expectedReturn) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-tawf-green-10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-tawf-green rounded-full"
                      style={{ width: `${(investment.currentReturn / investment.expectedReturn) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-tawf-green">Recent Transactions</h2>
            <Link to="/investor/transactions" className="text-sm text-tawf-gold hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-2">
            {transactions.slice(0, 4).map((tx) => (
              <TransactionRow key={tx.id} compact {...tx} />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Featured Pools */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl text-tawf-green">Featured Investment Pools</h2>
          <Link to="/investor/pools" className="text-sm text-tawf-gold hover:underline">
            Browse All Pools
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockPools.slice(0, 3).map((pool) => (
            <InvestmentCard
              key={pool.id}
              {...pool}
              onInvestClick={(id) => console.log('Invest in pool:', id)}
              onDetailsClick={(id) => console.log('View pool details:', id)}
            />
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/investor/pools"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-green-10 rounded-xl">
            <TrendingUp className="w-5 h-5 text-tawf-green" />
          </div>
          <div>
            <p className="font-medium text-tawf-green">New Investment</p>
            <p className="text-xs text-tawf-muted">Browse pools</p>
          </div>
        </Link>

        <Link
          to="/investor/portfolio"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-gold-10 rounded-xl">
            <Wallet className="w-5 h-5 text-tawf-gold" />
          </div>
          <div>
            <p className="font-medium text-tawf-green">My Portfolio</p>
            <p className="text-xs text-tawf-muted">View investments</p>
          </div>
        </Link>

        <Link
          to="/investor/transactions"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-blue-50 rounded-xl">
            <ArrowUpRight className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-tawf-green">Withdraw</p>
            <p className="text-xs text-tawf-muted">Get returns</p>
          </div>
        </Link>

        <Link
          to="/investor/impact"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-purple-50 rounded-xl">
            <Heart className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-tawf-green">Your Impact</p>
            <p className="text-xs text-tawf-muted">See the difference</p>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}
