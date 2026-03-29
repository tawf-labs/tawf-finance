import { useState } from 'react';
import { User, Bell, Shield, Wallet, LogOut, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/hooks/useAuth';

export function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', content: null, icon: <User className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', content: null, icon: <Bell className="w-4 h-4" /> },
    { id: 'security', label: 'Security', content: null, icon: <Shield className="w-4 h-4" /> },
    { id: 'wallets', label: 'Wallets', content: null, icon: <Wallet className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Settings</h1>
        <p className="text-tawf-muted">Manage your account preferences</p>
      </div>

      {/* Settings Content */}
      <Card className="p-6">
        <Tabs
          tabs={tabs}
          defaultTab="profile"
          variant="underline"
          onChange={(tabId) => setActiveTab(tabId)}
        />

        <div className="mt-8">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex items-center gap-6 p-6 bg-tawf-sand-30 rounded-xl">
                <Avatar name={user?.name} size="xl" />
                <div className="flex-1">
                  <h3 className="font-serif text-xl text-tawf-green">{user?.name}</h3>
                  <p className="text-tawf-muted">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={user?.status === 'active' ? 'success' : 'warning'} size="sm">
                      {user?.status}
                    </Badge>
                    {user?.tier && (
                      <Badge variant="info" size="sm" className="capitalize">
                        {user.tier} Investor
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="secondary" size="md">
                  Edit Profile
                </Button>
              </div>

              {/* Profile Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    defaultValue={user?.name}
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    defaultValue={user?.email}
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    defaultValue={user?.phoneNumber || ''}
                    placeholder="Add phone number"
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">
                    Wallet Address
                  </label>
                  <input
                    type="text"
                    defaultValue={user?.walletAddress || ''}
                    placeholder="Connect a wallet"
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="ghost" size="md">Cancel</Button>
                <Button variant="primary" size="md">Save Changes</Button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              {[
                { title: 'Investment Returns', desc: 'Get notified when your investments generate returns' },
                { title: 'New Pool Alerts', desc: 'Be the first to know when new investment pools open' },
                { title: 'Maturity Reminders', desc: 'Reminders before your investments mature' },
                { title: 'Marketing Updates', desc: 'News and updates from Tawf Finance' },
                { title: 'Impact Reports', desc: 'Monthly impact stories and metrics' },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
                  <div>
                    <h4 className="font-medium text-tawf-green">{item.title}</h4>
                    <p className="text-sm text-tawf-muted">{item.desc}</p>
                  </div>
                  <button className={`w-12 h-6 rounded-full transition-colors ${index < 3 ? 'bg-tawf-green' : 'bg-gray-200'} relative`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${index < 3 ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-tawf-green mb-4">Password</h3>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-tawf-ink mb-2">Current Password</label>
                    <input type="password" className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-tawf-ink mb-2">New Password</label>
                    <input type="password" className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-tawf-ink mb-2">Confirm Password</label>
                    <input type="password" className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl" />
                  </div>
                  <Button variant="primary" size="md">Update Password</Button>
                </div>
              </div>

              <hr className="border-tawf-green-10" />

              <div>
                <h3 className="font-medium text-tawf-green mb-4">Two-Factor Authentication</h3>
                <div className="flex items-center justify-between p-4 bg-tawf-sand-30 rounded-xl max-w-md">
                  <div>
                    <p className="font-medium">2FA is not enabled</p>
                    <p className="text-sm text-tawf-muted">Add an extra layer of security</p>
                  </div>
                  <Button variant="secondary" size="sm">Enable</Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'wallets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-tawf-green">Connected Wallets</h3>
                <Button variant="primary" size="sm">+ Connect Wallet</Button>
              </div>

              {[
                { name: 'Coinbase Wallet', address: '0x1234...5678', connected: true, icon: <Wallet className="w-5 h-5 text-blue-600" /> },
                { name: 'Privy', address: 'Not connected', connected: false, icon: <Shield className="w-5 h-5 text-purple-600" /> },
                { name: 'Phantom', address: 'Not connected', connected: false, icon: <Sparkles className="w-5 h-5" /> },
              ].map((wallet, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${wallet.connected ? 'bg-tawf-green-10' : 'bg-gray-100'}`}>
                      {wallet.icon}
                    </div>
                    <div>
                      <p className="font-medium">{wallet.name}</p>
                      <p className="text-sm text-tawf-muted font-mono">{wallet.address}</p>
                    </div>
                  </div>
                  {wallet.connected ? (
                    <Badge variant="success" size="sm">Connected</Badge>
                  ) : (
                    <Button variant="secondary" size="sm">Connect</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-red-200">
        <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
        <p className="text-sm text-tawf-muted mb-4">
          Irreversible actions that affect your account
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" size="md" className="text-red-600 hover:bg-red-50">
            Delete Account
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={logout}
            className="text-tawf-muted hover:text-red-600"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
}
