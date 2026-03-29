import { Building2, Star, TrendingUp, Calendar, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useMockData } from '@/hooks/useMockData';
import { formatDate, formatCurrency } from '@/data/mockData';

export function Partnerships() {
  const { vendorPartnerships } = useMockData();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'paused': return 'default';
      case 'ended': return 'info';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Partnerships</h1>
        <p className="text-tawf-muted">Your partnerships with cooperatives</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-green-10 rounded-xl">
              <Building2 className="w-5 h-5 text-tawf-green" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total Partners</p>
              <p className="font-serif text-xl text-tawf-green">{vendorPartnerships.length}</p>
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
              <p className="font-serif text-xl text-tawf-green">{vendorPartnerships.filter(p => p.status === 'active').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-gold-10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-tawf-gold" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total Value</p>
              <p className="font-serif text-xl text-tawf-green">
                {formatCurrency(vendorPartnerships.reduce((sum, p) => sum + p.totalValue, 0))}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-xl">
              <Star className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Avg Rating</p>
              <p className="font-serif text-xl text-tawf-green">
                {(vendorPartnerships.reduce((sum, p) => sum + p.performanceRating, 0) / vendorPartnerships.length).toFixed(1)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Partnerships List */}
      <div className="space-y-4">
        {vendorPartnerships.map((partnership) => (
          <Card key={partnership.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-serif text-xl text-tawf-green">{partnership.cooperativeName}</h3>
                  <Badge variant={getStatusColor(partnership.status)} size="sm">
                    {partnership.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-tawf-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Since {formatDate(partnership.startedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-tawf-gold fill-tawf-gold" />
                    {partnership.performanceRating}/5.0
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-tawf-muted">Total Value</p>
                <p className="font-serif text-2xl text-tawf-green">{formatCurrency(partnership.totalValue)}</p>
              </div>
            </div>

            {/* Services */}
            <div className="mb-4">
              <p className="text-sm text-tawf-muted mb-2">Services Provided:</p>
              <div className="flex flex-wrap gap-2">
                {partnership.services.map((service, index) => (
                  <span key={index} className="px-3 py-1 bg-tawf-sand-30 rounded-full text-sm">
                    {service}
                  </span>
                ))}
              </div>
            </div>

            {/* Performance */}
            <div className="border-t border-tawf-green-10 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-tawf-muted">Performance Score</p>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < Math.floor(partnership.performanceRating) ? 'text-tawf-gold fill-tawf-gold' : 'text-gray-300'}`}
                      />
                    ))}
                    <span className="ml-2 text-sm font-medium text-tawf-green">{partnership.performanceRating}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 border border-tawf-green-10 rounded-lg text-sm hover:bg-tawf-green-5 transition-colors">
                    View Details
                  </button>
                  <button className="px-4 py-2 bg-tawf-green text-tawf-sand rounded-lg text-sm hover:bg-tawf-green-light transition-colors">
                    Contact
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
