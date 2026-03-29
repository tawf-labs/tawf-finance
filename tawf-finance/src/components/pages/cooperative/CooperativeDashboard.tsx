import { Link } from 'react-router-dom';
import {
  CheckCircle,
  Building2,
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useMockData } from '@/hooks/useMockData';
import { formatCurrency, formatDate } from '@/data/mockData';

export function CooperativeDashboard() {
  const { cooperativeStats, allPurchaseOrders, allBusinessProfiles } = useMockData();

  const pendingVerifications = allPurchaseOrders.filter(po => po.status === 'verifying' || po.status === 'submitted');
  const recentBusinesses = allBusinessProfiles.slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Cooperative Dashboard</h1>
        <p className="text-tawf-muted">Manage business verifications and partnerships</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Deals"
          value={cooperativeStats?.activeDeals || 0}
          change={2}
          changeType="absolute"
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Verified Businesses"
          value={cooperativeStats?.verifiedBusinesses || 0}
          change={3}
          changeType="absolute"
          icon={<Building2 className="w-5 h-5" />}
          color="gold"
        />
        <StatCard
          title="Total Disbursed"
          value={formatCurrency(cooperativeStats?.totalDisbursed || 0)}
          change={12}
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Member Count"
          value={cooperativeStats?.memberCount || 0}
          icon={<Users className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Pending Verifications Alert */}
      {(cooperativeStats?.pendingVerifications || 0) > 0 && (
        <Card className="p-5 bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-xl">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-yellow-800">Pending Verifications</h3>
              <p className="text-sm text-yellow-700">
                You have {cooperativeStats?.pendingVerifications} purchase orders awaiting verification
              </p>
            </div>
            <Link to="/cooperative/verification">
              <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 transition-colors">
                Review Now
              </button>
            </Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Verification Requests */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-tawf-green">Verification Queue</h2>
            <Link to="/cooperative/verification" className="text-sm text-tawf-gold hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {pendingVerifications.slice(0, 3).map((po) => (
              <div key={po.id} className="p-4 border border-tawf-green-10 rounded-xl hover:border-tawf-green-20 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-tawf-green">{po.businessName}</h3>
                    <p className="text-xs text-tawf-muted">{po.items.length} items · {formatCurrency(po.amount)}</p>
                  </div>
                  <Badge variant={po.status === 'verifying' ? 'purple' : 'warning'} size="sm">
                    {po.status === 'verifying' ? 'In Review' : 'Submitted'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-tawf-muted">Submitted {formatDate(po.createdAt)}</span>
                  <Link to={`/cooperative/verification?id=${po.id}`}>
                    <button className="text-sm text-tawf-gold hover:underline">Review →</button>
                  </Link>
                </div>
              </div>
            ))}
            {pendingVerifications.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-tawf-green mx-auto mb-2" />
                <p className="text-tawf-muted">All caught up! No pending verifications.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Recently Verified Businesses */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-tawf-green">Verified Businesses</h2>
            <Link to="/cooperative/businesses" className="text-sm text-tawf-gold hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentBusinesses.map((business) => (
              <div key={business.id} className="p-4 border border-tawf-green-10 rounded-xl hover:border-tawf-green-20 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-tawf-green">{business.businessName}</h3>
                    <p className="text-xs text-tawf-muted">{business.businessType} · {business.location}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-tawf-gold">{business.tawfScore}</span>
                    <span className="text-xs text-tawf-muted">Tawf Score</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-tawf-muted" />
                    <span className="text-xs text-tawf-muted">{business.employees} employees</span>
                  </div>
                  <Link to={`/cooperative/businesses?id=${business.userId}`}>
                    <button className="text-sm text-tawf-gold hover:underline">View Details →</button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="font-serif text-xl text-tawf-green mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[
            { action: 'Verified PO', business: 'Warung Berkah', time: '2 hours ago', type: 'success' },
            { action: 'New business registered', business: 'Tani Makmur', time: '5 hours ago', type: 'info' },
            { action: 'Funded PO', business: 'Jamu Herbal Sehat', time: '1 day ago', type: 'success' },
            { action: 'Disbursed funds', business: 'Kerajinan Nusantara', time: '2 days ago', type: 'info' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${activity.type === 'success' ? 'bg-green-50' : 'bg-blue-50'}`}>
                {activity.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <DollarSign className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium text-tawf-green">{activity.action}</span>
                  {' '}for <span className="font-medium">{activity.business}</span>
                </p>
                <p className="text-xs text-tawf-muted">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/cooperative/verification"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-green-10 rounded-xl">
            <CheckCircle className="w-5 h-5 text-tawf-green" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Verification</p>
            <p className="text-xs text-tawf-muted">Review POs</p>
          </div>
        </Link>

        <Link
          to="/cooperative/businesses"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-gold-10 rounded-xl">
            <Building2 className="w-5 h-5 text-tawf-gold" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Businesses</p>
            <p className="text-xs text-tawf-muted">View MSMEs</p>
          </div>
        </Link>

        <Link
          to="/cooperative/deals"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-blue-50 rounded-xl">
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Active Deals</p>
            <p className="text-xs text-tawf-muted">Track funding</p>
          </div>
        </Link>

        <Link
          to="/cooperative/members"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-purple-50 rounded-xl">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Members</p>
            <p className="text-xs text-tawf-muted">Manage team</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
