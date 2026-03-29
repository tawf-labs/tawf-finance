import { useState } from 'react';
import { CheckCircle, X, FileText, Search, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { useMockData } from '@/hooks/useMockData';
import { formatCurrency, formatDate, getStatusColor } from '@/data/mockData';

export function Verification() {
  const { allPurchaseOrders } = useMockData();
  const [selectedPO, setSelectedPO] = useState<typeof allPurchaseOrders[0] | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const pendingPOs = allPurchaseOrders.filter(po => po.status === 'verifying' || po.status === 'submitted');
  const approvedPOs = allPurchaseOrders.filter(po => po.status === 'funded' || po.status === 'in_progress');
  const rejectedPOs = allPurchaseOrders.filter(po => po.status === 'rejected');

  const tabs = [
    { id: 'pending', label: 'Pending', content: null, badge: pendingPOs.length },
    { id: 'approved', label: 'Approved', content: null, badge: approvedPOs.length },
    { id: 'rejected', label: 'Rejected', content: null, badge: rejectedPOs.length },
  ];

  const [activeTab, setActiveTab] = useState('pending');

  const getTabPOs = () => {
    switch (activeTab) {
      case 'pending': return pendingPOs;
      case 'approved': return approvedPOs;
      case 'rejected': return rejectedPOs;
      default: return pendingPOs;
    }
  };

  const handleApprove = () => {
    setShowApproveModal(false);
    // In real app, would update the PO status
    setSelectedPO(null);
  };

  const handleReject = () => {
    setShowRejectModal(false);
    // In real app, would update the PO status
    setSelectedPO(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Purchase Order Verification</h1>
          <p className="text-tawf-muted">Review and verify purchase orders from MSMEs</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tawf-muted" />
          <input
            type="text"
            placeholder="Search POs..."
            className="pl-12 pr-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold w-64"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 rounded-xl">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Pending Review</p>
              <p className="font-serif text-xl text-tawf-green">{pendingPOs.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Approved Today</p>
              <p className="font-serif text-xl text-tawf-green">3</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total Processed</p>
              <p className="font-serif text-xl text-tawf-green">{approvedPOs.length + rejectedPOs.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="p-6">
        <Tabs tabs={tabs} defaultTab="pending" variant="pills" onChange={(tabId) => setActiveTab(tabId)} />

        {/* PO List */}
        <div className="mt-6 space-y-4">
          {getTabPOs().length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
              <p className="text-tawf-muted">No purchase orders found</p>
            </div>
          ) : (
            getTabPOs().map((po) => (
              <div key={po.id} className="border border-tawf-green-10 rounded-xl p-5 hover:border-tawf-green-20 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-tawf-green">{po.businessName}</h3>
                      <Badge variant={getStatusColor(po.status).bg === 'bg-yellow-50' ? 'warning' : getStatusColor(po.status).bg === 'bg-green-50' ? 'success' : 'default'} size="sm">
                        {po.status === 'verifying' ? 'In Review' : po.status === 'submitted' ? 'Submitted' : po.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-tawf-muted">PO: {po.id} · Submitted {formatDate(po.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-xl text-tawf-green">{formatCurrency(po.amount)}</p>
                    <p className="text-xs text-tawf-muted">{po.items.length} items</p>
                  </div>
                </div>

                {/* Items */}
                <div className="mb-4 p-3 bg-tawf-sand-30 rounded-lg">
                  <p className="text-xs text-tawf-muted mb-2">Items:</p>
                  <div className="space-y-1">
                    {po.items.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{item.name} × {item.quantity}</span>
                        <span className="text-tawf-muted">{formatCurrency(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {activeTab === 'pending' && (
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSelectedPO(po); setShowRejectModal(true); }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => { setSelectedPO(po); setShowApproveModal(true); }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve & Fund
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Purchase Order"
        size="md"
      >
        {selectedPO && (
          <div className="space-y-4">
            <div className="p-4 bg-tawf-sand-30 rounded-xl">
              <p className="text-sm text-tawf-muted mb-1">Business</p>
              <p className="font-medium text-tawf-green">{selectedPO.businessName}</p>
              <p className="text-sm text-tawf-muted mt-3 mb-1">Amount</p>
              <p className="font-serif text-xl text-tawf-green">{formatCurrency(selectedPO.amount)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Funding Source</label>
              <select className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold">
                <option>Pool: Warung Pool</option>
                <option>Pool: Kurban Farms Pool</option>
                <option>Pool: Jamu & Herbal Pool</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Notes (optional)</label>
              <textarea
                rows={2}
                placeholder="Add any notes for this approval..."
                className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowApproveModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleApprove}>Approve & Fund</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Purchase Order"
        size="md"
      >
        {selectedPO && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-xl">
              <p className="text-sm text-red-600 mb-1">Business</p>
              <p className="font-medium text-red-700">{selectedPO.businessName}</p>
              <p className="text-sm text-red-600 mt-3 mb-1">Amount</p>
              <p className="font-serif text-xl text-red-700">{formatCurrency(selectedPO.amount)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Reason for Rejection</label>
              <select className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold">
                <option>Incomplete documentation</option>
                <option>Amount exceeds approved limit</option>
                <option>Vendor not verified</option>
                <option>Business not verified</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Additional Notes</label>
              <textarea
                rows={3}
                placeholder="Provide details for the business..."
                className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowRejectModal(false)}>Cancel</Button>
              <Button variant="secondary" onClick={handleReject} className="border-red-200 text-red-600 hover:bg-red-50">
                Reject PO
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
