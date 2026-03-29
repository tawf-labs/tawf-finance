import { Building2, MapPin, Users, TrendingUp, Search, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useMockData } from '@/hooks/useMockData';
import { formatCurrency } from '@/data/mockData';
import { Link } from 'react-router-dom';

export function Businesses() {
  const { allBusinessProfiles } = useMockData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Registered Businesses</h1>
          <p className="text-tawf-muted">View and manage MSMEs in your network</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tawf-muted" />
            <input
              type="text"
              placeholder="Search businesses..."
              className="pl-12 pr-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-green-10 rounded-xl">
              <Building2 className="w-5 h-5 text-tawf-green" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total</p>
              <p className="font-serif text-xl text-tawf-green">{allBusinessProfiles.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Verified</p>
              <p className="font-serif text-xl text-tawf-green">
                {allBusinessProfiles.filter(b => b.verifiedBy.length > 0).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-gold-10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-tawf-gold" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Avg Score</p>
              <p className="font-serif text-xl text-tawf-green">
                {(allBusinessProfiles.reduce((sum, b) => sum + b.tawfScore, 0) / allBusinessProfiles.length).toFixed(0)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total Jobs</p>
              <p className="font-serif text-xl text-tawf-green">
                {allBusinessProfiles.reduce((sum, b) => sum + b.employees, 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Business List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allBusinessProfiles.map((business) => (
          <Card key={business.id} hover className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-tawf-green">{business.businessName}</h3>
                  {business.verifiedBy.length > 0 && (
                    <Badge variant="success" size="sm">Verified</Badge>
                  )}
                </div>
                <p className="text-xs text-tawf-muted">{business.businessType}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-tawf-gold">{business.tawfScore}</p>
                <p className="text-xs text-tawf-muted">Tawf Score</p>
              </div>
            </div>

            <p className="text-sm text-tawf-muted mb-4 line-clamp-2">{business.description}</p>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-tawf-muted">
                <MapPin className="w-3.5 h-3.5" />
                <span>{business.location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-tawf-muted">
                <Users className="w-3.5 h-3.5" />
                <span>{business.employees} employees</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-tawf-muted">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{formatCurrency(business.annualRevenue)}/yr revenue</span>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to={`/cooperative/businesses?id=${business.userId}`}>
                <button className="text-sm text-tawf-gold hover:underline">View Details →</button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
