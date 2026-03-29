import { TrendingUp, DollarSign, BarChart3, Award } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useMockData } from '@/hooks/useMockData';
import { formatCurrency } from '@/data/mockData';

export function Performance() {
  const { businessProfile, purchaseOrders } = useMockData();

  const completedPOs = purchaseOrders.filter(po => po.status === 'repaid');
  const totalFunded = purchaseOrders
    .filter(po => ['funded', 'in_progress', 'fulfilled', 'repaid'].includes(po.status))
    .reduce((sum, po) => sum + po.amount, 0);

  const monthlyRevenue = [
    { month: 'Jan', revenue: 45000 },
    { month: 'Feb', revenue: 52000 },
    { month: 'Mar', revenue: 48000 },
    { month: 'Apr', revenue: 61000 },
    { month: 'May', revenue: 58000 },
    { month: 'Jun', revenue: 67000 },
  ];

  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.revenue));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Business Performance</h1>
        <p className="text-tawf-muted">Track your growth and repayment history</p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Funded"
          value={formatCurrency(totalFunded)}
          change={15}
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Completed POs"
          value={completedPOs.length}
          change={1}
          changeType="absolute"
          icon={<BarChart3 className="w-5 h-5" />}
          color="gold"
        />
        <StatCard
          title="Tawf Score"
          value={businessProfile?.tawfScore || 0}
          change={5}
          icon={<Award className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="On-time Repayments"
          value="100%"
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
        />
      </div>

      {/* Revenue Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-xl text-tawf-green">Monthly Revenue</h2>
          <Badge variant="success" size="sm">+18% vs last period</Badge>
        </div>
        <div className="h-56 flex items-end justify-between gap-3">
          {monthlyRevenue.map((data) => (
            <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-tawf-green-10 rounded-t-lg relative h-full">
                <div
                  className="absolute bottom-0 left-0 right-0 bg-tawf-green rounded-t-lg transition-all hover:bg-tawf-gold"
                  style={{ height: `${(data.revenue / maxRevenue) * 100}%` }}
                />
              </div>
              <span className="text-xs text-tawf-muted">{data.month}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Repayment History */}
        <Card className="p-6">
          <h2 className="font-serif text-xl text-tawf-green mb-4">Repayment History</h2>
          <div className="space-y-3">
            {completedPOs.map((po) => (
              <div key={po.id} className="flex items-center justify-between p-4 bg-tawf-sand-30 rounded-xl">
                <div>
                  <p className="font-medium text-tawf-green">{po.id}</p>
                  <p className="text-xs text-tawf-muted">Repaid {po.repaidAt}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-tawf-green">{formatCurrency(po.amount)}</p>
                  <Badge variant="success" size="sm">On Time</Badge>
                </div>
              </div>
            ))}
            {completedPOs.length === 0 && (
              <p className="text-center text-tawf-muted py-4">No repayments yet</p>
            )}
          </div>
        </Card>

        {/* Score Breakdown */}
        <Card className="p-6">
          <h2 className="font-serif text-xl text-tawf-green mb-4">Tawf Score Breakdown</h2>
          <div className="space-y-4">
            {[
              { factor: 'Repayment History', score: 95, weight: '40%' },
              { factor: 'Business Stability', score: 82, weight: '25%' },
              { factor: 'Cooperative Relations', score: 88, weight: '20%' },
              { factor: 'Documentation', score: 70, weight: '15%' },
            ].map((item) => (
              <div key={item.factor}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-tawf-ink">{item.factor}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-tawf-green">{item.score}</span>
                    <span className="text-xs text-tawf-muted">({item.weight})</span>
                  </div>
                </div>
                <div className="h-2 bg-tawf-green-10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-tawf-green rounded-full"
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tips */}
      <Card className="p-6 bg-gradient-to-br from-tawf-gold-10 to-tawf-gold-5 border-tawf-gold-20">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-tawf-gold rounded-xl">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-tawf-green mb-1">Improve Your Score</h3>
            <p className="text-sm text-tawf-muted mb-3">
              Complete repayments on time, maintain good documentation, and strengthen cooperative relationships to improve your Tawf Score.
            </p>
            <div className="flex gap-2">
              <Badge variant="info" size="sm">Upload missing documents</Badge>
              <Badge variant="info" size="sm">Verify contact info</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
