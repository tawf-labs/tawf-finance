import { useState } from 'react';
import { Plus, Search, Edit, Trash2, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { useMockData } from '@/hooks/useMockData';
import { formatCurrency, formatDate, getStatusColor } from '@/data/mockData';

export function PurchaseOrders() {
  const { purchaseOrders } = useMockData();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<typeof purchaseOrders[0] | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { id: 'all', label: 'All', content: null },
    { id: 'draft', label: 'Draft', content: null },
    { id: 'pending', label: 'Pending', content: null },
    { id: 'active', label: 'Active', content: null },
    { id: 'completed', label: 'Completed', content: null },
  ];

  const getFilteredPOs = () => {
    switch (activeTab) {
      case 'draft': return purchaseOrders.filter(po => po.status === 'draft');
      case 'pending': return purchaseOrders.filter(po => ['submitted', 'verifying'].includes(po.status));
      case 'active': return purchaseOrders.filter(po => ['funded', 'in_progress', 'fulfilled'].includes(po.status));
      case 'completed': return purchaseOrders.filter(po => po.status === 'repaid');
      default: return purchaseOrders;
    }
  };

  const filteredPOs = getFilteredPOs();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Purchase Orders</h1>
          <p className="text-tawf-muted">Create and manage your purchase orders</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Purchase Order
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tawf-muted" />
            <input
              type="text"
              placeholder="Search purchase orders..."
              className="w-full pl-12 pr-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <Button variant="secondary" size="md">
            Filters
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <Card className="p-6">
        <Tabs tabs={tabs} defaultTab="all" variant="pills" onChange={(tabId) => setActiveTab(tabId)} />

        {/* PO List */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-tawf-green-10">
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">PO ID</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Items</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Amount</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Status</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Created</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Due</th>
                <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wider text-tawf-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map((po) => (
                <tr key={po.id} className="border-b border-tawf-green-5 hover:bg-tawf-sand-30 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-tawf-green" />
                      <span className="font-medium text-tawf-green">{po.id}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-tawf-muted">{po.items.length} items</td>
                  <td className="py-4 px-4 font-medium text-tawf-green">{formatCurrency(po.amount)}</td>
                  <td className="py-4 px-4">
                    <Badge variant={getStatusColor(po.status).bg === 'bg-green-50' ? 'success' :
                                      getStatusColor(po.status).bg === 'bg-yellow-50' ? 'warning' :
                                      getStatusColor(po.status).bg === 'bg-purple-50' ? 'purple' :
                                      getStatusColor(po.status).bg === 'bg-indigo-50' ? 'indigo' :
                                      getStatusColor(po.status).bg === 'bg-teal-50' ? 'teal' : 'default'} size="sm">
                      {po.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="py-4 px-4 text-sm text-tawf-muted">{formatDate(po.createdAt)}</td>
                  <td className="py-4 px-4 text-sm text-tawf-muted">
                    {po.repaymentDue ? formatDate(po.repaymentDue) : '-'}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedPO(po)}
                        className="p-2 hover:bg-tawf-green-10 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <FileText className="w-4 h-4 text-tawf-green" />
                      </button>
                      {po.status === 'draft' && (
                        <button
                          className="p-2 hover:bg-tawf-green-10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-tawf-muted" />
                        </button>
                      )}
                      {po.status === 'draft' && (
                        <button
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPOs.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
              <p className="text-tawf-muted">No purchase orders found</p>
            </div>
          )}
        </div>
      </Card>

      {/* Create PO Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Purchase Order"
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Vendor</label>
            <select className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold">
              <option>Select a vendor...</option>
              <option>PT Indonesia Teknologi</option>
              <option>CV Sukses Jaya</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-tawf-ink">Items</label>
              <button type="button" className="text-sm text-tawf-gold hover:underline">+ Add Item</button>
            </div>
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" placeholder="Item name" className="flex-1 px-3 py-2 border border-tawf-green-10 rounded-lg text-sm" />
                  <input type="number" placeholder="Qty" className="w-20 px-3 py-2 border border-tawf-green-10 rounded-lg text-sm" />
                  <input type="number" placeholder="Price" className="w-28 px-3 py-2 border border-tawf-green-10 rounded-lg text-sm" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Expected Delivery</label>
            <input
              type="date"
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>

          <div className="p-4 bg-tawf-sand-30 rounded-xl">
            <div className="flex justify-between text-sm">
              <span className="text-tawf-muted">Estimated Total</span>
              <span className="font-medium text-tawf-green">$0.00</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Save as Draft</Button>
            <Button variant="primary" onClick={() => setShowCreateModal(false)}>Submit for Verification</Button>
          </div>
        </div>
      </Modal>

      {/* PO Detail Modal */}
      <Modal
        isOpen={!!selectedPO}
        onClose={() => setSelectedPO(null)}
        title={`PO ${selectedPO?.id}`}
        size="lg"
      >
        {selectedPO && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Badge variant={getStatusColor(selectedPO.status).bg === 'bg-green-50' ? 'success' : 'default'} size="md">
                {selectedPO.status.replace('_', ' ')}
              </Badge>
              <span className="text-sm text-tawf-muted">Created {formatDate(selectedPO.createdAt)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-tawf-sand-30 rounded-xl">
                <p className="text-xs text-tawf-muted mb-1">Total Amount</p>
                <p className="font-serif text-xl text-tawf-green">{formatCurrency(selectedPO.amount)}</p>
              </div>
              <div className="p-4 bg-tawf-sand-30 rounded-xl">
                <p className="text-xs text-tawf-muted mb-1">Items</p>
                <p className="font-serif text-xl text-tawf-green">{selectedPO.items.length}</p>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-tawf-green mb-3">Items</h3>
              <div className="space-y-2">
                {selectedPO.items.map((item, index) => (
                  <div key={index} className="flex justify-between p-3 bg-tawf-sand-30 rounded-lg">
                    <span>{item.name}</span>
                    <span className="text-tawf-muted">{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedPO.status === 'funded' && selectedPO.repaymentDue && (
              <div className="p-4 bg-amber-50 rounded-xl">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">Repayment Due:</span> {formatDate(selectedPO.repaymentDue)}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              {selectedPO.status === 'draft' && (
                <>
                  <Button variant="ghost" onClick={() => setSelectedPO(null)}>Edit</Button>
                  <Button variant="primary" onClick={() => setSelectedPO(null)}>Submit</Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
