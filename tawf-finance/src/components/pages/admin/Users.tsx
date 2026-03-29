import { useState } from 'react';
import { Search, Filter, UserPlus, Edit, Ban, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { mockUsers } from '@/data/mockData';

export function AdminUsers() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = [
    { id: 'all', label: 'All Users', content: null },
    { id: 'investor', label: 'Investors', content: null },
    { id: 'business', label: 'Businesses', content: null },
    { id: 'cooperative', label: 'Cooperatives', content: null },
    { id: 'vendor', label: 'Vendors', content: null },
    { id: 'admin', label: 'Admins', content: null },
  ];

  const filteredUsers = mockUsers.filter(user => {
    const matchesTab = activeTab === 'all' || user.role === activeTab;
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'investor': return 'success';
      case 'business': return 'teal';
      case 'cooperative': return 'info';
      case 'vendor': return 'purple';
      case 'admin': return 'error';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">User Management</h1>
          <p className="text-tawf-muted">Manage platform users and permissions</p>
        </div>
        <Button variant="primary" size="md">
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        {tabs.map(tab => {
          const count = mockUsers.filter(u => tab.id === 'all' || u.role === tab.id).length;
          return (
            <Card key={tab.id} className="p-4 text-center">
              <p className="text-2xl font-serif text-tawf-green">{count}</p>
              <p className="text-xs text-tawf-muted">{tab.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tawf-muted" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <Button variant="secondary" size="md">
            <Filter className="w-4 h-4 mr-2" />
            Advanced Filters
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <Card className="p-6">
        <Tabs tabs={tabs} defaultTab="all" variant="pills" onChange={(tabId) => setActiveTab(tabId)} />

        {/* Users List */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-tawf-green-10">
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">User</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Role</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Status</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">KYC</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Joined</th>
                <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wider text-tawf-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-tawf-green-5 hover:bg-tawf-sand-30 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} size="md" />
                      <div>
                        <p className="font-medium text-tawf-green">{user.name}</p>
                        <p className="text-sm text-tawf-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <Badge variant={getRoleBadgeColor(user.role)} size="sm" className="capitalize">
                      {user.role}
                    </Badge>
                  </td>
                  <td className="py-4 px-4">
                    <Badge variant={user.status === 'active' ? 'success' : user.status === 'suspended' ? 'error' : 'warning'} size="sm">
                      {user.status}
                    </Badge>
                  </td>
                  <td className="py-4 px-4">
                    {user.kycVerified ? (
                      <Badge variant="success" size="sm">Verified</Badge>
                    ) : (
                      <Badge variant="warning" size="sm">Pending</Badge>
                    )}
                  </td>
                  <td className="py-4 px-4 text-sm text-tawf-muted">
                    {new Date(user.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-tawf-green-10 rounded-lg transition-colors" title="Edit">
                        <Edit className="w-4 h-4 text-tawf-muted" />
                      </button>
                      <button className="p-2 hover:bg-tawf-green-10 rounded-lg transition-colors" title="View Details">
                        <ShieldCheck className="w-4 h-4 text-tawf-green" />
                      </button>
                      {user.status === 'active' && (
                        <button className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Suspend">
                          <Ban className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
