import { useState } from 'react';
import { Plus, Edit, TrendingUp, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { mockPools } from '@/data/mockData';
import { formatCurrency } from '@/data/mockData';
import { Modal } from '@/components/ui/Modal';

export function AdminPools() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Pool Management</h1>
          <p className="text-tawf-muted">Create and manage investment pools</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Pool
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-green-10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-tawf-green" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total Pools</p>
              <p className="font-serif text-xl text-tawf-green">{mockPools.length}</p>
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
              <p className="font-serif text-xl text-tawf-green">{mockPools.filter(p => p.available).length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-gold-10 rounded-xl">
              <span className="text-lg">$</span>
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total TVL</p>
              <p className="font-serif text-xl text-tawf-green">
                {formatCurrency(mockPools.reduce((sum, p) => sum + p.tvl, 0))}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-xl">
              <span className="text-lg">%</span>
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Avg APY</p>
              <p className="font-serif text-xl text-tawf-green">
                {((mockPools.reduce((sum, p) => sum + (p.apy.min + p.apy.max) / 2, 0) / mockPools.length).toFixed(1))}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pool List */}
      <div className="space-y-4">
        {mockPools.map((pool) => (
          <Card key={pool.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-serif text-xl text-tawf-green">{pool.name}</h3>
                  <Badge variant={pool.available ? 'success' : 'default'} size="sm">
                    {pool.available ? 'Open' : 'Closed'}
                  </Badge>
                  <Badge variant="info" size="sm">{pool.category}</Badge>
                </div>
                <p className="text-sm text-tawf-muted">{pool.description}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-tawf-muted">TVL</p>
                <p className="font-serif text-xl text-tawf-green">{formatCurrency(pool.tvl)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div>
                <p className="text-xs text-tawf-muted">APY Range</p>
                <p className="font-medium text-tawf-green">{pool.apy.min}-{pool.apy.max}%</p>
              </div>
              <div>
                <p className="text-xs text-tawf-muted">Duration</p>
                <p className="font-medium text-tawf-green">{pool.duration.min}-{pool.duration.max} days</p>
              </div>
              <div>
                <p className="text-xs text-tawf-muted">Min Investment</p>
                <p className="font-medium text-tawf-green">{formatCurrency(pool.minInvestment)}</p>
              </div>
              <div>
                <p className="text-xs text-tawf-muted">Risk Level</p>
                <p className="font-medium capitalize text-tawf-green">{pool.riskLevel}</p>
              </div>
              <div>
                <p className="text-xs text-tawf-muted">Sharia Compliant</p>
                <p className="font-medium text-tawf-green">{pool.shariaCompliant ? 'Yes' : 'No'}</p>
              </div>
            </div>

            <div className="mb-4">
              <ProgressBar
                value={pool.fundingProgress}
                max={pool.fundingTarget}
                size="sm"
                color="green"
                showLabel
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button variant="secondary" size="sm">
                View Analytics
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Pool Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Pool"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Pool Name</label>
            <input
              type="text"
              placeholder="e.g., Agriculture Fund Q3"
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Category</label>
            <select className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold">
              <option>Agriculture</option>
              <option>Retail</option>
              <option>Health & Wellness</option>
              <option>Crafts & Heritage</option>
              <option>Manufacturing</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Min APY (%)</label>
              <input type="number" step="0.1" className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Max APY (%)</label>
              <input type="number" step="0.1" className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Min Duration (days)</label>
              <input type="number" className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Max Duration (days)</label>
              <input type="number" className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Min Investment</label>
              <input type="number" className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Funding Target</label>
              <input type="number" className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Description</label>
            <textarea
              rows={3}
              placeholder="Describe the investment opportunity..."
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setShowCreateModal(false)}>Create Pool</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
