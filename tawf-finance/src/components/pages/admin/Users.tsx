import { useState } from 'react';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
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
    { id: 'issuer', label: 'Licensed Issuers', content: null },
    { id: 'admin', label: 'Admins', content: null },
  ];

  // The pilot has investors, licensed issuers and admins. The business and BPRS originator roles were removed.
  const pilotUsers = mockUsers.filter(u => u.role === 'investor' || u.role === 'issuer' || u.role === 'admin');

  const filteredUsers = pilotUsers.filter(user => {
    const matchesTab = activeTab === 'all' || user.role === activeTab;
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'investor': return 'success';
      case 'issuer': return 'purple';
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {tabs.map(tab => {
          const count = pilotUsers.filter(u => tab.id === 'all' || u.role === tab.id).length;
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
