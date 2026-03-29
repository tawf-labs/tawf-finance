import { useState } from 'react';
import { Plus, Search, Star, Package, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useMockData } from '@/hooks/useMockData';
import { formatCurrency } from '@/data/mockData';

export function Services() {
  const { vendorServices } = useMockData();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredServices = vendorServices.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Service Catalog</h1>
          <p className="text-tawf-muted">Manage your services offered to MSMEs</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-green-10 rounded-xl">
              <Package className="w-5 h-5 text-tawf-green" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total Services</p>
              <p className="font-serif text-xl text-tawf-green">{vendorServices.length}</p>
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
              <p className="font-serif text-xl text-tawf-green">{vendorServices.filter(s => s.active).length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-gold-10 rounded-xl">
              <Star className="w-5 h-5 text-tawf-gold" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Avg Rating</p>
              <p className="font-serif text-xl text-tawf-green">
                {(vendorServices.reduce((sum, s) => sum + s.rating, 0) / vendorServices.length).toFixed(1)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tawf-muted" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
          />
        </div>
      </Card>

      {/* Services List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredServices.map((service) => (
          <Card key={service.id} hover className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-tawf-green">{service.name}</h3>
                  {service.active ? (
                    <Badge variant="success" size="sm">Active</Badge>
                  ) : (
                    <Badge variant="default" size="sm">Inactive</Badge>
                  )}
                </div>
                <p className="text-sm text-tawf-muted">{service.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-3 text-sm">
              <div>
                <span className="text-tawf-muted">Price:</span>
                <span className="font-medium text-tawf-green ml-1">{formatCurrency(service.price)}/{service.unit}</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-tawf-gold fill-tawf-gold" />
                <span className="text-tawf-muted">{service.rating}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-tawf-green-10">
              <span className="text-xs text-tawf-muted">{service.ordersFulfilled} orders fulfilled</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">Edit</Button>
                <Button variant="secondary" size="sm">View Orders</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Service Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Service"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Service Name</label>
            <input
              type="text"
              placeholder="e.g., POS System Installation"
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Category</label>
            <select className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold">
              <option>Technology</option>
              <option>Software</option>
              <option>Service</option>
              <option>Supplies</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Description</label>
            <textarea
              rows={3}
              placeholder="Describe your service..."
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Price</label>
              <input
                type="number"
                placeholder="0.00"
                className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Unit</label>
              <select className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold">
                <option>per system</option>
                <option>per license</option>
                <option>per month</option>
                <option>per unit</option>
                <option>per batch</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-tawf-sand-30 rounded-xl">
            <input type="checkbox" id="active" className="rounded text-tawf-green focus:ring-tawf-gold" defaultChecked />
            <label htmlFor="active" className="text-sm">Make service active immediately</label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="primary">Add Service</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
