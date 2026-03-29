import { DollarSign, TrendingUp, Calendar, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useMockData } from '@/hooks/useMockData';
import { formatCurrency, formatDate } from '@/data/mockData';

export function Deals() {
  const { allPurchaseOrders } = useMockData();
  const activeDeals = allPurchaseOrders.filter(po => ['funded', 'in_progress', 'fulfilled'].includes(po.status));
  const completedDeals = allPurchaseOrders.filter(po => po.status === 'repaid');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Active Deals</h1>
        <p className="text-tawf-muted">Track funded purchase orders and repayment progress</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-green-10 rounded-xl">
              <DollarSign className="w-5 h-5 text-tawf-green" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Active Deals</p>
              <p className="font-serif text-xl text-tawf-green">{activeDeals.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-gold-10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-tawf-gold" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total Funded</p>
              <p className="font-serif text-xl text-tawf-green">
                {formatCurrency(activeDeals.reduce((sum, po) => sum + po.amount, 0))}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Repaid</p>
              <p className="font-serif text-xl text-tawf-green">{completedDeals.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">This Month</p>
              <p className="font-serif text-xl text-tawf-green">$45,000</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Deals */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">Active Deals</h3>
        <div className="space-y-4">
          {activeDeals.map((deal) => {
            const progress = deal.status === 'fulfilled' ? 100 :
                             deal.status === 'in_progress' ? 65 :
                             deal.status === 'funded' ? 25 : 0;

            return (
              <div key={deal.id} className="border border-tawf-green-10 rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-tawf-green">{deal.businessName}</h3>
                      <Badge
                        variant={deal.status === 'funded' ? 'success' :
                                deal.status === 'in_progress' ? 'indigo' :
                                deal.status === 'fulfilled' ? 'teal' : 'default'}
                        size="sm"
                      >
                        {deal.status === 'funded' ? 'Funded' :
                         deal.status === 'in_progress' ? 'In Progress' :
                         deal.status === 'fulfilled' ? 'Fulfilled' : deal.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-tawf-muted">PO: {deal.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-xl text-tawf-green">{formatCurrency(deal.amount)}</p>
                    <p className="text-xs text-tawf-muted">Funded {formatDate(deal.fundedAt || '')}</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <ProgressBar
                    value={progress}
                    max={100}
                    size="sm"
                    color="green"
                    showLabel
                  />
                </div>

                {/* Timeline */}
                <div className="flex items-center justify-between text-xs text-tawf-muted">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Due: {deal.repaymentDue ? formatDate(deal.repaymentDue) : 'TBD'}
                    </span>
                    {deal.vendorName && (
                      <span>Vendor: {deal.vendorName}</span>
                    )}
                  </div>
                  <span>{deal.items.length} items</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Completed Deals */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">Completed Deals</h3>
        <div className="space-y-3">
          {completedDeals.map((deal) => (
            <div key={deal.id} className="flex items-center justify-between p-4 bg-tawf-sand-30 rounded-xl">
              <div>
                <h4 className="font-medium text-tawf-green">{deal.businessName}</h4>
                <p className="text-xs text-tawf-muted">
                  Repaid {formatDate(deal.repaidAt || '')} · {formatCurrency(deal.amount)}
                </p>
              </div>
              <Badge variant="success" size="sm">Repaid</Badge>
            </div>
          ))}
          {completedDeals.length === 0 && (
            <div className="text-center py-8 text-tawf-muted">No completed deals yet</div>
          )}
        </div>
      </Card>
    </div>
  );
}
