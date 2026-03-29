import { Link } from 'react-router-dom';
import {
  FileText,
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useMockData } from '@/hooks/useMockData';
import { formatCurrency, formatDate, daysRemaining } from '@/data/mockData';

export function BusinessDashboard() {
  const { businessStats, purchaseOrders, businessProfile } = useMockData();

  const activePOs = purchaseOrders.filter(po => ['funded', 'in_progress'].includes(po.status));
  const pendingPOs = purchaseOrders.filter(po => ['draft', 'submitted', 'verifying'].includes(po.status));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Business Dashboard</h1>
          <p className="text-tawf-muted">Manage purchase orders and funding</p>
        </div>
        <Link to="/business/purchase-orders">
          <button className="flex items-center gap-2 px-4 py-3 bg-tawf-green text-tawf-sand rounded-full text-sm font-medium hover:bg-tawf-green-light transition-colors">
            <Plus className="w-4 h-4" />
            New PO
          </button>
        </Link>
      </div>

      {/* Tawf Score Banner */}
      {businessProfile && (
        <Card className="p-5 bg-gradient-to-r from-tawf-green to-tawf-green-light text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 rounded-xl">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-serif text-xl">Your Tawf Score</h3>
                <p className="text-tawf-sand-80 text-sm">Higher score = better funding terms</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-serif text-4xl">{businessProfile.tawfScore}</p>
              <p className="text-tawf-sand-80 text-sm">out of 100</p>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active POs"
          value={businessStats?.activePOs || 0}
          icon={<FileText className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Total Funding"
          value={formatCurrency(businessStats?.totalFunding || 0)}
          icon={<DollarSign className="w-5 h-5" />}
          color="gold"
        />
        <StatCard
          title="Pending POs"
          value={businessStats?.pendingPOs || 0}
          icon={<AlertCircle className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Tawf Score"
          value={businessStats?.tawfScore || 0}
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
        />
      </div>

      {/* Next Payment Alert */}
      {businessStats?.nextPaymentDue && (
        <Card className="p-5 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-amber-800">Upcoming Payment Due</h3>
              <p className="text-sm text-amber-700">
                Payment of {formatCurrency(5000)} due on {formatDate(businessStats.nextPaymentDue)}
                ({daysRemaining(businessStats.nextPaymentDue)} days remaining)
              </p>
            </div>
            <Link to="/business/purchase-orders">
              <button className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
                View Details
              </button>
            </Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Purchase Orders */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-tawf-green">Active Purchase Orders</h2>
            <Link to="/business/purchase-orders" className="text-sm text-tawf-gold hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {activePOs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-tawf-muted mx-auto mb-2" />
                <p className="text-tawf-muted">No active purchase orders</p>
              </div>
            ) : (
              activePOs.slice(0, 3).map((po) => (
                <div key={po.id} className="p-4 border border-tawf-green-10 rounded-xl">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-tawf-green">{po.id}</h3>
                      <p className="text-xs text-tawf-muted">{po.items.length} items</p>
                    </div>
                    <Badge variant={po.status === 'funded' ? 'success' : 'indigo'} size="sm">
                      {po.status === 'funded' ? 'Funded' : 'In Progress'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-tawf-muted">Amount</span>
                    <span className="font-medium text-tawf-green">{formatCurrency(po.amount)}</span>
                  </div>
                  {po.repaymentDue && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-tawf-muted">Due</span>
                      <span className="text-tawf-muted">{formatDate(po.repaymentDue)}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Pending Purchase Orders */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-tawf-green">Pending POs</h2>
            <Link to="/business/purchase-orders" className="text-sm text-tawf-gold hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {pendingPOs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-tawf-muted">No pending purchase orders</p>
              </div>
            ) : (
              pendingPOs.slice(0, 3).map((po) => (
                <div key={po.id} className="p-4 border border-tawf-green-10 rounded-xl">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-tawf-green">{po.id}</h3>
                      <p className="text-xs text-tawf-muted">{po.items.length} items</p>
                    </div>
                    <Badge
                      variant={po.status === 'verifying' ? 'purple' : po.status === 'submitted' ? 'info' : 'default'}
                      size="sm"
                    >
                      {po.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-tawf-muted">Amount</span>
                    <span className="font-medium text-tawf-green">{formatCurrency(po.amount)}</span>
                  </div>
                  {po.status === 'draft' && (
                    <Link to={`/business/purchase-orders?edit=${po.id}`}>
                      <button className="text-sm text-tawf-gold hover:underline mt-2">Continue Editing →</button>
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/business/purchase-orders"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-green-10 rounded-xl">
            <Plus className="w-5 h-5 text-tawf-green" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Create PO</p>
            <p className="text-xs text-tawf-muted">New order</p>
          </div>
        </Link>

        <Link
          to="/business/funding"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-gold-10 rounded-xl">
            <DollarSign className="w-5 h-5 text-tawf-gold" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Get Funding</p>
            <p className="text-xs text-tawf-muted">Apply now</p>
          </div>
        </Link>

        <Link
          to="/business/fulfillment"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-blue-50 rounded-xl">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Track Orders</p>
            <p className="text-xs text-tawf-muted">View status</p>
          </div>
        </Link>

        <Link
          to="/business/performance"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-purple-50 rounded-xl">
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Performance</p>
            <p className="text-xs text-tawf-muted">View metrics</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
