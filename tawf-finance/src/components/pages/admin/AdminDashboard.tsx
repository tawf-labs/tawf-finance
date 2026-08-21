import { Link } from 'react-router-dom';
import {
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useMockData } from '@/hooks/useMockData';
import { formatCurrency } from '@/data/mockData';

export function AdminDashboard() {
  const { adminStats, systemAlerts } = useMockData();

  const recentActivity = [
    { action: 'New user registered', user: 'Tani Makmur', time: '5 min ago', type: 'user' },
    { action: 'PO approved', user: 'BMT Berkat', time: '15 min ago', type: 'po' },
    { action: 'Investment made', user: 'Ahmad Rahman', time: '1 hour ago', type: 'investment' },
    { action: 'Verification completed', user: 'Koperasi Sejahtera', time: '2 hours ago', type: 'verification' },
    { action: 'Funding disbursed', user: 'Warung Berkah', time: '3 hours ago', type: 'funding' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Admin Dashboard</h1>
        <p className="text-tawf-muted">Platform overview and system management</p>
      </div>

      {/* Critical Alerts */}
      {systemAlerts.filter(a => !a.resolved && a.severity === 'critical').length > 0 && (
        <Card className="p-5 bg-red-50 border-red-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-red-800">Critical Alerts</h3>
              <p className="text-sm text-red-700">
                {systemAlerts.filter(a => !a.resolved && a.severity === 'critical').length} critical issue(s) require attention
              </p>
            </div>
            <Link to="/admin/compliance">
              <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                View Alerts
              </button>
            </Link>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={adminStats?.totalUsers || 0}
          change={12}
          icon={<Users className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Platform TVL"
          value={formatCurrency(adminStats?.platformTVL || 0)}
          change={8}
          icon={<DollarSign className="w-5 h-5" />}
          color="gold"
        />
        <StatCard
          title="Active Deals"
          value={adminStats?.activeDeals || 0}
          change={3}
          changeType="absolute"
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Pending Approvals"
          value={adminStats?.pendingApprovals || 0}
          icon={<Activity className="w-5 h-5" />}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-tawf-green">Recent Activity</h2>
            <Link to="/admin/investments" className="text-sm text-tawf-gold hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  activity.type === 'user' ? 'bg-blue-50' :
                  activity.type === 'po' ? 'bg-green-50' :
                  activity.type === 'investment' ? 'bg-tawf-gold-10' :
                  activity.type === 'verification' ? 'bg-purple-50' :
                  'bg-gray-50'
                }`}>
                  {activity.type === 'user' && <Users className="w-4 h-4 text-blue-600" />}
                  {activity.type === 'po' && <CheckCircle className="w-4 h-4 text-green-600" />}
                  {activity.type === 'investment' && <DollarSign className="w-4 h-4 text-tawf-gold" />}
                  {activity.type === 'verification' && <Activity className="w-4 h-4 text-purple-600" />}
                  {activity.type === 'funding' && <TrendingUp className="w-4 h-4 text-gray-600" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium text-tawf-green">{activity.action}</span>
                    {' '}by <span className="font-medium">{activity.user}</span>
                  </p>
                  <p className="text-xs text-tawf-muted">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* System Alerts */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-tawf-green">System Alerts</h2>
            <Link to="/admin/compliance" className="text-sm text-tawf-gold hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {systemAlerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className={`p-4 rounded-xl border ${
                alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
                alert.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                'bg-tawf-sand-30 border-tawf-green-10'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`font-medium ${
                      alert.severity === 'critical' ? 'text-red-800' :
                      alert.severity === 'high' ? 'text-orange-800' :
                      alert.severity === 'medium' ? 'text-yellow-800' :
                      'text-tawf-green'
                    }`}>
                      {alert.title}
                    </p>
                    <p className={`text-sm ${
                      alert.severity === 'critical' ? 'text-red-600' :
                      alert.severity === 'high' ? 'text-orange-600' :
                      alert.severity === 'medium' ? 'text-yellow-600' :
                      'text-tawf-muted'
                    }`}>
                      {alert.message}
                    </p>
                  </div>
                  {!alert.resolved && (
                    <Badge variant={alert.severity === 'critical' ? 'error' : alert.severity === 'high' ? 'warning' : 'default'} size="sm">
                      {alert.severity}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* User Distribution */}
      <Card className="p-6">
        <h2 className="font-serif text-xl text-tawf-green mb-4">User Distribution by Role</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { role: 'Investors', count: 1520, color: 'bg-tawf-green' },
            { role: 'Businesses', count: 680, color: 'bg-tawf-gold' },
            { role: 'Cooperatives', count: 45, color: 'bg-blue-500' },
            { role: 'Licensed Issuers', count: 8, color: 'bg-purple-500' },
            { role: 'Admins', count: 15, color: 'bg-gray-500' },
          ].map((item) => (
            <div key={item.role} className="p-4 border border-tawf-green-10 rounded-xl">
              <div className={`w-3 h-3 ${item.color} rounded-full mb-2`} />
              <p className="text-2xl font-serif text-tawf-green">{item.count}</p>
              <p className="text-sm text-tawf-muted">{item.role}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/admin/users"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-green-10 rounded-xl">
            <Users className="w-5 h-5 text-tawf-green" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Manage Users</p>
            <p className="text-xs text-tawf-muted">View all users</p>
          </div>
        </Link>

        <Link
          to="/admin/pools"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-gold-10 rounded-xl">
            <TrendingUp className="w-5 h-5 text-tawf-gold" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Manage Pools</p>
            <p className="text-xs text-tawf-muted">Edit pools</p>
          </div>
        </Link>

        <Link
          to="/admin/compliance"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-blue-50 rounded-xl">
            <CheckCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Compliance</p>
            <p className="text-xs text-tawf-muted">Review queue</p>
          </div>
        </Link>

        <Link
          to="/admin/settings"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-purple-50 rounded-xl">
            <Activity className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Settings</p>
            <p className="text-xs text-tawf-muted">Platform config</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
