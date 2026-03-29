import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Calendar, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { useMockData } from '@/hooks/useMockData';
import { formatDate, daysRemaining } from '@/data/mockData';
import { cn } from '@/utils/cn';

export function Portfolio() {
  const { investments, formatCurrency } = useMockData();
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'pending'>('all');
  const [selectedInvestment, setSelectedInvestment] = useState<typeof investments[0] | null>(null);

  const filteredInvestments = investments.filter(inv => {
    if (filterStatus === 'all') return true;
    return inv.status === filterStatus;
  });

  const stats = {
    totalInvested: investments.reduce((sum, i) => sum + i.amount, 0),
    totalReturns: investments.reduce((sum, i) => sum + i.currentReturn, 0),
    activeCount: investments.filter(i => i.status === 'active').length,
    completedCount: investments.filter(i => i.status === 'completed').length,
  };

  const tabs = [
    {
      id: 'all',
      label: 'All Investments',
      content: null,
      badge: investments.length,
    },
    {
      id: 'active',
      label: 'Active',
      content: null,
      badge: investments.filter(i => i.status === 'active').length,
    },
    {
      id: 'completed',
      label: 'Completed',
      content: null,
      badge: investments.filter(i => i.status === 'completed').length,
    },
    {
      id: 'pending',
      label: 'Pending',
      content: null,
      badge: investments.filter(i => i.status === 'pending').length,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">My Portfolio</h1>
          <p className="text-tawf-muted">Track your investments and returns</p>
        </div>
        <Button variant="primary" size="md">
          <FileText className="w-4 h-4 mr-2" />
          Export Statement
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Total Invested</p>
          <p className="font-serif text-2xl text-tawf-green">{formatCurrency(stats.totalInvested)}</p>
          <p className="text-xs text-tawf-muted mt-2">{investments.length} investments</p>
        </Card>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Total Returns</p>
          <p className="font-serif text-2xl text-tawf-gold">{formatCurrency(stats.totalReturns)}</p>
          <p className="text-xs text-tawf-muted mt-2">All time earnings</p>
        </Card>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Active Investments</p>
          <p className="font-serif text-2xl text-tawf-green">{stats.activeCount}</p>
          <p className="text-xs text-tawf-muted mt-2">Currently earning</p>
        </Card>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Completed</p>
          <p className="font-serif text-2xl text-tawf-green">{stats.completedCount}</p>
          <p className="text-xs text-tawf-muted mt-2">Fully matured</p>
        </Card>
      </div>

      {/* Investment List */}
      <Card className="p-6">
        <Tabs
          tabs={tabs}
          defaultTab="all"
          variant="pills"
          onChange={(tabId) => setFilterStatus(tabId as any)}
        />

        <div className="space-y-4 mt-6">
          {filteredInvestments.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
              <p className="text-tawf-muted">No investments found</p>
            </div>
          ) : (
            filteredInvestments.map((investment) => {
              const daysLeft = investment.maturesAt
                ? daysRemaining(investment.maturesAt)
                : null;

              return (
                <motion.div
                  key={investment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-tawf-green-10 rounded-xl p-5 hover:border-tawf-green-20 transition-colors cursor-pointer"
                  onClick={() => setSelectedInvestment(investment)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-serif text-lg text-tawf-green">{investment.poolName}</h3>
                        <Badge
                          variant={
                            investment.status === 'active' ? 'success' :
                            investment.status === 'completed' ? 'info' :
                            'warning'
                          }
                          size="sm"
                        >
                          {investment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-tawf-muted">
                        Invested {formatCurrency(investment.amount)} · {investment.apy}% APY
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-xl text-tawf-gold">
                        {formatCurrency(investment.currentReturn)}
                      </p>
                      <p className="text-xs text-tawf-muted">
                        of {formatCurrency(investment.expectedReturn)} returns
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <ProgressBar
                      value={investment.currentReturn}
                      max={investment.expectedReturn}
                      size="sm"
                      color="green"
                      showLabel={false}
                    />
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-tawf-muted">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Invested {formatDate(investment.investedAt)}
                      </span>
                      {daysLeft !== null && (
                        <span className={cn(
                          daysLeft > 0 ? 'text-tawf-green' : 'text-red-600'
                        )}>
                          {daysLeft > 0 ? `${daysLeft} days left` : 'Matured'}
                        </span>
                      )}
                    </div>
                    {investment.txHash && (
                      <span className="font-mono text-tawf-muted-60">
                        Tx: {investment.txHash.slice(0, 10)}...
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </Card>

      {/* Investment Detail Modal */}
      <Modal
        isOpen={!!selectedInvestment}
        onClose={() => setSelectedInvestment(null)}
        title="Investment Details"
        size="lg"
      >
        {selectedInvestment && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-serif text-xl text-tawf-green mb-1">
                  {selectedInvestment.poolName}
                </h3>
                <p className="text-sm text-tawf-muted">
                  ID: {selectedInvestment.id}
                </p>
              </div>
              <Badge
                variant={
                  selectedInvestment.status === 'active' ? 'success' :
                  selectedInvestment.status === 'completed' ? 'info' :
                  'warning'
                }
              >
                {selectedInvestment.status}
              </Badge>
            </div>

            {/* Key Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-tawf-sand-30 rounded-xl">
                <p className="text-xs text-tawf-muted mb-1">Invested Amount</p>
                <p className="font-serif text-lg text-tawf-green">
                  {formatCurrency(selectedInvestment.amount)}
                </p>
              </div>
              <div className="p-4 bg-tawf-sand-30 rounded-xl">
                <p className="text-xs text-tawf-muted mb-1">APY</p>
                <p className="font-serif text-lg text-tawf-green">{selectedInvestment.apy}%</p>
              </div>
              <div className="p-4 bg-tawf-sand-30 rounded-xl">
                <p className="text-xs text-tawf-muted mb-1">Current Returns</p>
                <p className="font-serif text-lg text-tawf-gold">
                  {formatCurrency(selectedInvestment.currentReturn)}
                </p>
              </div>
              <div className="p-4 bg-tawf-sand-30 rounded-xl">
                <p className="text-xs text-tawf-muted mb-1">Expected Returns</p>
                <p className="font-serif text-lg text-tawf-green">
                  {formatCurrency(selectedInvestment.expectedReturn)}
                </p>
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-tawf-muted">Investment Date</span>
                <span className="text-sm font-medium">{formatDate(selectedInvestment.investedAt, 'long')}</span>
              </div>
              {selectedInvestment.maturesAt && (
                <div className="flex justify-between">
                  <span className="text-sm text-tawf-muted">Maturity Date</span>
                  <span className="text-sm font-medium">{formatDate(selectedInvestment.maturesAt, 'long')}</span>
                </div>
              )}
            </div>

            {/* Transaction Hashes */}
            {selectedInvestment.txHash && (
              <div className="p-4 bg-tawf-sand-30 rounded-xl">
                <p className="text-xs text-tawf-muted mb-2">Transaction Hash</p>
                <p className="font-mono text-sm text-tawf-green break-all">
                  {selectedInvestment.txHash}
                </p>
              </div>
            )}

            {selectedInvestment.receiptHash && (
              <div className="p-4 bg-tawf-gold-10 rounded-xl border border-tawf-gold-20">
                <p className="text-xs text-tawf-muted mb-2">Digital Receipt (Soulbound NFT)</p>
                <p className="font-mono text-sm text-tawf-gold break-all">
                  {selectedInvestment.receiptHash}
                </p>
                <Button variant="ghost" size="sm" className="mt-3">
                  View on Block Explorer
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="primary" className="flex-1" disabled={selectedInvestment.status !== 'completed'}>
                Withdraw Returns
              </Button>
              <Button variant="secondary" className="flex-1">
                Reinvest
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
