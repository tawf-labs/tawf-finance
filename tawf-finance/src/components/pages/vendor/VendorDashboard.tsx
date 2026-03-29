import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Package,
  TrendingUp,
  DollarSign,
  Star,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useMockData } from '@/hooks/useMockData';
import { formatDate } from '@/data/mockData';

export function VendorDashboard() {
  const { vendorStats, vendorPartnerships, vendorServices, formatCurrency } = useMockData();

  const recentPartnerships = vendorPartnerships.slice(0, 3);
  const topServices = vendorServices.slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Vendor Dashboard</h1>
        <p className="text-tawf-muted">Manage your services and partnerships</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Services"
          value={vendorStats?.activeServices || 0}
          icon={<Package className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Total Orders Fulfilled"
          value={vendorStats?.totalOrders || 0}
          change={15}
          icon={<TrendingUp className="w-5 h-5" />}
          color="gold"
        />
        <StatCard
          title="Total Earnings"
          value={formatCurrency(vendorStats?.totalEarnings || 0)}
          change={8}
          icon={<DollarSign className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Average Rating"
          value={vendorStats?.averageRating?.toFixed(1) || '0.0'}
          icon={<Star className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Partnerships & Services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Partnerships */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-tawf-green">Active Partnerships</h2>
            <Link to="/vendor/partnerships" className="text-sm text-tawf-gold hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentPartnerships.map((partnership) => (
              <div key={partnership.id} className="p-4 border border-tawf-green-10 rounded-xl hover:border-tawf-green-20 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-tawf-green">{partnership.cooperativeName}</h3>
                    <p className="text-xs text-tawf-muted">Since {formatDate(partnership.startedAt)}</p>
                  </div>
                  <Badge variant={partnership.status === 'active' ? 'success' : 'default'} size="sm">
                    {partnership.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-tawf-muted">Total Value</span>
                  <span className="font-medium text-tawf-green">{formatCurrency(partnership.totalValue)}</span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < Math.floor(partnership.performanceRating) ? 'text-tawf-gold fill-tawf-gold' : 'text-gray-300'}`}
                    />
                  ))}
                  <span className="text-xs text-tawf-muted ml-1">{partnership.performanceRating}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Services */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-tawf-green">Top Services</h2>
            <Link to="/vendor/services" className="text-sm text-tawf-gold hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {topServices.map((service) => (
              <div key={service.id} className="p-4 border border-tawf-green-10 rounded-xl hover:border-tawf-green-20 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-tawf-green">{service.name}</h3>
                      {service.active ? (
                        <Badge variant="success" size="sm">Active</Badge>
                      ) : (
                        <Badge variant="default" size="sm">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-xs text-tawf-muted">{service.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-tawf-green">{formatCurrency(service.price)}</p>
                    <p className="text-xs text-tawf-muted">per {service.unit}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-tawf-gold fill-tawf-gold" />
                    <span className="text-tawf-muted">{service.rating}</span>
                  </div>
                  <span className="text-tawf-muted">{service.ordersFulfilled} orders</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Performance Chart (Mock) */}
      <Card className="p-6">
        <h2 className="font-serif text-xl text-tawf-green mb-4">Performance Overview</h2>
        <div className="h-48 flex items-end justify-between gap-2">
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, index) => {
            const values = [65, 75, 80, 90, 85, 95];
            const value = values[index] || 50;
            return (
              <div key={month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-tawf-green-10 rounded-t-lg relative h-full">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${value}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 }}
                    className="absolute bottom-0 left-0 right-0 bg-tawf-green rounded-t-lg"
                  />
                </div>
                <span className="text-xs text-tawf-muted">{month}</span>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-tawf-muted mt-4 text-center">Orders fulfilled per month</p>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/vendor/services"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-green-10 rounded-xl">
            <Package className="w-5 h-5 text-tawf-green" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Add Service</p>
            <p className="text-xs text-tawf-muted">List new service</p>
          </div>
          <ArrowRight className="w-4 h-4 text-tawf-muted" />
        </Link>

        <Link
          to="/vendor/partnerships"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-gold-10 rounded-xl">
            <Building2 className="w-5 h-5 text-tawf-gold" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Partnerships</p>
            <p className="text-xs text-tawf-muted">View partners</p>
          </div>
          <ArrowRight className="w-4 h-4 text-tawf-muted" />
        </Link>

        <Link
          to="/vendor/compliance"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-blue-50 rounded-xl">
            <Star className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Compliance</p>
            <p className="text-xs text-tawf-muted">View status</p>
          </div>
          <ArrowRight className="w-4 h-4 text-tawf-muted" />
        </Link>

        <Link
          to="/vendor/settings"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-purple-50 rounded-xl">
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Reports</p>
            <p className="text-xs text-tawf-muted">View analytics</p>
          </div>
          <ArrowRight className="w-4 h-4 text-tawf-muted" />
        </Link>
      </div>
    </div>
  );
}
