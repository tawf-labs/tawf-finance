import { Truck, Package, CheckCircle, Clock, FileText, Upload, Search, DollarSign, Banknote } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { useMockData } from '@/hooks/useMockData';
import { formatCurrency, formatDate } from '@/data/mockData';

export function Fulfillment() {
  const { purchaseOrders } = useMockData();

  const fulfillmentOrders = purchaseOrders.filter(po =>
    ['funded', 'in_progress', 'fulfilled'].includes(po.status)
  );

  const getFulfillmentProgress = (status: string) => {
    switch (status) {
      case 'funded': return 10;
      case 'in_progress': return 50;
      case 'fulfilled': return 90;
      case 'repaid': return 100;
      default: return 0;
    }
  };

  const timeline = [
    { status: 'draft', label: 'Draft', icon: <FileText className="w-4 h-4" /> },
    { status: 'submitted', label: 'Submitted', icon: <Upload className="w-4 h-4" /> },
    { status: 'verifying', label: 'Verifying', icon: <Search className="w-4 h-4" /> },
    { status: 'funded', label: 'Funded', icon: <DollarSign className="w-4 h-4" /> },
    { status: 'in_progress', label: 'In Progress', icon: <Package className="w-4 h-4" /> },
    { status: 'fulfilled', label: 'Fulfilled', icon: <CheckCircle className="w-4 h-4" /> },
    { status: 'repaid', label: 'Repaid', icon: <Banknote className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Order Fulfillment</h1>
        <p className="text-tawf-muted">Track delivery status and confirm orders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">In Transit</p>
              <p className="font-serif text-xl text-tawf-green">2</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Delivered</p>
              <p className="font-serif text-xl text-tawf-green">1</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-xl">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Pending</p>
              <p className="font-serif text-xl text-tawf-green">1</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-gold-10 rounded-xl">
              <Truck className="w-5 h-5 text-tawf-gold" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total</p>
              <p className="font-serif text-xl text-tawf-green">{fulfillmentOrders.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {fulfillmentOrders.map((order) => (
          <Card key={order.id} className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-serif text-xl text-tawf-green">{order.id}</h3>
                  <Badge
                    variant={order.status === 'fulfilled' ? 'teal' : order.status === 'in_progress' ? 'indigo' : 'success'}
                    size="sm"
                  >
                    {order.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-sm text-tawf-muted">
                  {order.items.length} items · {formatCurrency(order.amount)}
                </p>
              </div>
              <div className="text-right">
                {order.vendorName && (
                  <p className="text-sm text-tawf-muted">Vendor: {order.vendorName}</p>
                )}
                {order.expectedFulfillment && (
                  <p className="text-sm text-tawf-muted">
                    Expected: {formatDate(order.expectedFulfillment)}
                  </p>
                )}
              </div>
            </div>

            {/* Progress Timeline */}
            <div className="mb-6">
              <ProgressBar
                value={getFulfillmentProgress(order.status)}
                max={100}
                size="sm"
                color="green"
                showLabel={false}
              />
              <div className="flex justify-between mt-2">
                {timeline.map((step, index) => {
                  const stepIndex = timeline.findIndex(t => t.status === order.status);
                  const isComplete = index <= stepIndex;
                  return (
                    <div key={step.status} className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        isComplete ? 'bg-tawf-green text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {step.icon}
                      </div>
                      <span className={`text-xs mt-1 ${isComplete ? 'text-tawf-green' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Items */}
            <div className="mb-4">
              <p className="text-sm text-tawf-muted mb-2">Items:</p>
              <div className="flex flex-wrap gap-2">
                {order.items.map((item, index) => (
                  <span key={index} className="px-3 py-1 bg-tawf-sand-30 rounded-full text-sm">
                    {item.name} × {item.quantity}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-tawf-green-10">
              <Button variant="ghost" size="sm">View Details</Button>
              {order.status === 'in_progress' && (
                <Button variant="primary" size="sm">Confirm Delivery</Button>
              )}
              {order.status === 'fulfilled' && (
                <Button variant="secondary" size="sm" disabled>Delivered</Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {fulfillmentOrders.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <h3 className="font-serif text-xl text-tawf-green mb-2">No Orders Yet</h3>
          <p className="text-tawf-muted mb-6">Create a purchase order to get started</p>
          <Button variant="primary">Create Purchase Order</Button>
        </Card>
      )}
    </div>
  );
}
