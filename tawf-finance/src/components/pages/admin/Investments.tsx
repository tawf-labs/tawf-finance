import { TrendingUp, DollarSign, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { mockInvestments } from '@/data/mockData';
import { formatCurrency, formatDate } from '@/data/mockData';

export function AdminInvestments() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Investment Management</h1>
        <p className="text-tawf-muted">Monitor and manage all platform investments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-green-10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-tawf-green" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total Investments</p>
              <p className="font-serif text-xl text-tawf-green">{mockInvestments.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Active</p>
              <p className="font-serif text-xl text-tawf-green">{mockInvestments.filter(i => i.status === 'active').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-gold-10 rounded-xl">
              <DollarSign className="w-5 h-5 text-tawf-gold" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total Invested</p>
              <p className="font-serif text-xl text-tawf-green">
                {formatCurrency(mockInvestments.reduce((sum, i) => sum + i.amount, 0))}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl">
              <span className="text-lg">%</span>
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Avg APY</p>
              <p className="font-serif text-xl text-tawf-green">
                {(mockInvestments.reduce((sum, i) => sum + i.apy, 0) / mockInvestments.length).toFixed(1)}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Investments List */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">All Investments</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-tawf-green-10">
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">ID</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Pool</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Amount</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">APY</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Returns</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Status</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Date</th>
              </tr>
            </thead>
            <tbody>
              {mockInvestments.map((investment) => (
                <tr key={investment.id} className="border-b border-tawf-green-5 hover:bg-tawf-sand-30 transition-colors">
                  <td className="py-4 px-4 text-sm font-medium text-tawf-green">{investment.id}</td>
                  <td className="py-4 px-4 text-sm">{investment.poolName}</td>
                  <td className="py-4 px-4 text-sm font-medium">{formatCurrency(investment.amount)}</td>
                  <td className="py-4 px-4 text-sm">{investment.apy}%</td>
                  <td className="py-4 px-4 text-sm">
                    <span className="text-tawf-gold">{formatCurrency(investment.currentReturn)}</span>
                    <span className="text-tawf-muted"> / {formatCurrency(investment.expectedReturn)}</span>
                  </td>
                  <td className="py-4 px-4">
                    <Badge
                      variant={investment.status === 'active' ? 'success' : investment.status === 'completed' ? 'info' : 'warning'}
                      size="sm"
                    >
                      {investment.status}
                    </Badge>
                  </td>
                  <td className="py-4 px-4 text-sm text-tawf-muted">{formatDate(investment.investedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
