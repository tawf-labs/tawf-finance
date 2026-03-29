import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, TrendingUp, Wallet, Shield, Sparkles } from 'lucide-react';
import { InvestmentCard } from '@/components/ui/InvestmentCard';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { mockPools } from '@/data/mockData';
import { useMockData } from '@/hooks/useMockData';
import { cn } from '@/utils/cn';
import type { Pool } from '@/data/mockData';

type FilterCategory = 'all' | 'agriculture' | 'retail' | 'health' | 'crafts' | 'manufacturing';
type SortOption = 'apy' | 'duration' | 'tvl' | 'name';

const categoryMap: Record<string, FilterCategory> = {
  'Agriculture': 'agriculture',
  'Retail': 'retail',
  'Health & Wellness': 'health',
  'Crafts & Heritage': 'crafts',
  'Manufacturing': 'manufacturing',
};

export function InvestorPools() {
  const { formatCurrency, investments } = useMockData();
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [sortBy, setSortBy] = useState<SortOption>('apy');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [investAmount, setInvestAmount] = useState(100);
  const [selectedWallet, setSelectedWallet] = useState<'coinbase' | 'privy' | 'phantom' | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Filter and sort pools
  const filteredPools = useMemo(() => {
    let pools = [...mockPools];

    // Filter by category
    if (selectedCategory !== 'all') {
      pools = pools.filter(pool => categoryMap[pool.category] === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      pools = pools.filter(pool =>
        pool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pool.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort pools
    pools.sort((a, b) => {
      switch (sortBy) {
        case 'apy':
          return b.apy.max - a.apy.max;
        case 'duration':
          return a.duration.min - b.duration.min;
        case 'tvl':
          return b.tvl - a.tvl;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return pools;
  }, [selectedCategory, sortBy, searchQuery]);

  const handleInvestClick = (poolId: string) => {
    const pool = mockPools.find(p => p.id === poolId);
    if (pool) {
      setSelectedPool(pool);
      setInvestAmount(pool.minInvestment);
      setShowInvestModal(true);
    }
  };

  const handleDetailsClick = (poolId: string) => {
    const pool = mockPools.find(p => p.id === poolId);
    if (pool) {
      setSelectedPool(pool);
      setShowInvestModal(true);
    }
  };

  const handleConfirmInvest = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowInvestModal(false);
      setShowSuccess(false);
      setSelectedPool(null);
      setInvestAmount(100);
      setSelectedWallet(null);
    }, 3000);
  };

  // Calculate expected return
  const expectedReturn = selectedPool
    ? (investAmount * (selectedPool.apy.min + selectedPool.apy.max) / 2) / 100
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Investment Pools</h1>
        <p className="text-tawf-muted">Choose from our curated pools of vetted MSMEs</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-tawf-green-10 p-6">
        {/* Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tawf-muted" />
            <input
              type="text"
              placeholder="Search pools by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <Button variant="secondary" size="md">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Advanced Filters
          </Button>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['all', 'agriculture', 'retail', 'health', 'crafts', 'manufacturing'] as const).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium capitalize transition-all',
                selectedCategory === category
                  ? 'bg-tawf-green text-tawf-sand'
                  : 'bg-tawf-sand-30 text-tawf-green hover:bg-tawf-green-10'
              )}
            >
              {category === 'all' ? 'All Pools' : category}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-tawf-muted">Sort by:</span>
          <div className="flex gap-1">
            {(['apy', 'duration', 'tvl', 'name'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setSortBy(option)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                  sortBy === option
                    ? 'bg-tawf-gold text-white'
                    : 'bg-tawf-sand-30 text-tawf-muted hover:text-tawf-green'
                )}
              >
                {option === 'apy' ? 'APY' : option === 'tvl' ? 'TVL' : option}
              </button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-tawf-muted mt-4">
          Showing <span className="font-medium text-tawf-green">{filteredPools.length}</span> pools
        </p>
      </div>

      {/* Pool Grid */}
      {filteredPools.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredPools.map((pool) => {
            const userInvestment = investments.find(i => i.poolId === pool.id);
            return (
              <InvestmentCard
                key={pool.id}
                {...pool}
                investedAmount={userInvestment?.amount}
                showInvestment={!!userInvestment}
                onInvestClick={handleInvestClick}
                onDetailsClick={handleDetailsClick}
              />
            );
          })}
        </motion.div>
      ) : (
        <div className="text-center py-16">
          <TrendingUp className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <h3 className="font-serif text-xl text-tawf-green mb-2">No pools found</h3>
          <p className="text-tawf-muted">Try adjusting your filters or search query</p>
        </div>
      )}

      {/* Investment Modal */}
      <Modal
        isOpen={showInvestModal}
        onClose={() => {
          setShowInvestModal(false);
          setShowSuccess(false);
          setSelectedPool(null);
        }}
        title={showSuccess ? 'Investment Successful!' : selectedPool?.name}
        size="md"
      >
        {showSuccess ? (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-2">Investment Confirmed!</h3>
            <p className="text-tawf-muted mb-6">
              You have successfully invested {formatCurrency(investAmount)} in {selectedPool?.name}
            </p>
            <div className="bg-tawf-sand-30 rounded-xl p-4 mb-6">
              <p className="text-sm text-tawf-muted mb-1">Transaction Hash</p>
              <p className="font-mono text-sm text-tawf-green break-all">
                0x{Math.random().toString(16).substr(2, 40)}
              </p>
            </div>
            <p className="text-sm text-tawf-muted">
              A digital receipt (soulbound NFT) has been generated and added to your portfolio.
            </p>
          </div>
        ) : (
          selectedPool && (
            <div className="space-y-6">
              {/* Pool Summary */}
              <div className="flex items-start gap-4 p-4 bg-tawf-sand-30 rounded-xl">
                <div className="p-3 bg-tawf-green-10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-tawf-green" />
                </div>
                <div className="flex-1">
                  <Badge variant="info" size="sm" className="mb-2">{selectedPool.category}</Badge>
                  <p className="text-sm text-tawf-muted">{selectedPool.description}</p>
                </div>
              </div>

              {/* Investment Amount */}
              <div>
                <label className="block text-sm font-medium text-tawf-ink mb-2">
                  Investment Amount
                </label>
                <div className="flex items-center gap-4 mb-4">
                  <input
                    type="number"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(Math.max(selectedPool.minInvestment, Number(e.target.value)))}
                    min={selectedPool.minInvestment}
                    className="flex-1 px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                  />
                  <span className="text-sm text-tawf-muted">USD</span>
                </div>
                <input
                  type="range"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(Number(e.target.value))}
                  min={selectedPool.minInvestment}
                  max={10000}
                  step={50}
                  className="w-full accent-tawf-green"
                />
                <div className="flex justify-between text-xs text-tawf-muted mt-1">
                  <span>{formatCurrency(selectedPool.minInvestment)}</span>
                  <span>{formatCurrency(10000)}</span>
                </div>
              </div>

              {/* Expected Returns */}
              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-tawf-muted">Expected Return (APY)</span>
                  <span className="font-semibold text-tawf-green">{selectedPool.apy.min}-{selectedPool.apy.max}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-tawf-muted">Est. Return</span>
                  <span className="font-semibold text-tawf-green text-lg">
                    {formatCurrency(expectedReturn)}
                  </span>
                </div>
              </div>

              {/* Wallet Selection */}
              <div>
                <label className="block text-sm font-medium text-tawf-ink mb-3">
                  Select Wallet
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'coinbase', name: 'Coinbase Wallet', icon: <Wallet className="w-6 h-6 text-blue-600" /> },
                    { id: 'privy', name: 'Privy', icon: <Shield className="w-6 h-6 text-purple-600" /> },
                    { id: 'phantom', name: 'Phantom', icon: <Sparkles className="w-6 h-6" /> },
                  ].map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => setSelectedWallet(wallet.id as any)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                        selectedWallet === wallet.id
                          ? 'border-tawf-green bg-tawf-green-5'
                          : 'border-tawf-green-10 hover:border-tawf-green-20'
                      )}
                    >
                      {wallet.icon}
                      <span className="font-medium">{wallet.name}</span>
                      {selectedWallet === wallet.id && (
                        <svg className="w-5 h-5 text-tawf-green ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confirm Button */}
              <Button
                size="lg"
                className="w-full"
                disabled={!selectedWallet || investAmount < selectedPool.minInvestment}
                onClick={handleConfirmInvest}
              >
                Confirm Investment of {formatCurrency(investAmount)}
              </Button>

              <p className="text-xs text-tawf-muted text-center">
                By confirming, you agree to the terms and conditions of the investment pool.
              </p>
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
