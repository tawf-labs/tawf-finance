import { useState } from 'react';
import { Download, Search, Filter } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { TransactionRow } from '@/components/ui/TransactionRow';
import { useMockData } from '@/hooks/useMockData';
import { cn } from '@/utils/cn';

export function Transactions() {
  const { transactions, formatCurrency } = useMockData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || tx.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || tx.status === selectedStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate totals
  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalInvestments = transactions
    .filter(t => t.type === 'invest')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalReturns = transactions
    .filter(t => t.type === 'repayment')
    .reduce((sum, t) => sum + t.amount, 0);

  const tabs = [
    { id: 'all', label: 'All', content: null },
    { id: 'deposit', label: 'Deposits', content: null },
    { id: 'invest', label: 'Investments', content: null },
    { id: 'repayment', label: 'Returns', content: null },
    { id: 'withdraw', label: 'Withdrawals', content: null },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Transactions</h1>
          <p className="text-tawf-muted">View your complete transaction history</p>
        </div>
        <Button variant="primary" size="md">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Total Deposited</p>
          <p className="font-serif text-xl text-tawf-green">{formatCurrency(totalDeposits)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Total Invested</p>
          <p className="font-serif text-xl text-tawf-green">{formatCurrency(totalInvestments)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Total Returns</p>
          <p className="font-serif text-xl text-tawf-gold">{formatCurrency(totalReturns)}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        {/* Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tawf-muted" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <Button variant="secondary" size="md">
            <Filter className="w-4 h-4 mr-2" />
            More Filters
          </Button>
        </div>

        {/* Type Tabs */}
        <Tabs
          tabs={tabs}
          defaultTab="all"
          variant="pills"
          onChange={(tabId) => setSelectedType(tabId)}
        />

        {/* Status Filter */}
        <div className="flex items-center gap-3 mt-4">
          <span className="text-sm text-tawf-muted">Status:</span>
          <div className="flex gap-1">
            {['all', 'completed', 'pending', 'failed'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                  selectedStatus === status
                    ? 'bg-tawf-green text-white'
                    : 'bg-tawf-sand-30 text-tawf-muted hover:text-tawf-green'
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Transaction List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-tawf-muted">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </p>
        </div>

        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-tawf-muted">No transactions found</p>
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <TransactionRow key={tx.id} {...tx} />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
