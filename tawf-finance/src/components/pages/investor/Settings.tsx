import { useState } from 'react';
import { useAccount } from 'wagmi';
import { User, Bell, Shield, LogOut, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/hooks/useAuth';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { GetTestUsdc } from '@/components/web3/GetTestUsdc';
import { KycStatusCard } from '@/components/kyc/KycStatusCard';
import { shortAddress } from '@/web3/format';
import { explorerAddressUrl } from '@/web3/constants';

export function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const { address, isConnected } = useAccount();

  const tabs = [
    { id: 'profile', label: 'Profile', content: null, icon: <User className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', content: null, icon: <Bell className="w-4 h-4" /> },
    { id: 'security', label: 'Security', content: null, icon: <Shield className="w-4 h-4" /> },
    { id: 'wallets', label: 'Wallets', content: null, icon: <Shield className="w-4 h-4" /> },
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
                  {isConnected && address ? (
                    <div className="flex items-center gap-2 p-3 border border-tawf-green-10 rounded-xl bg-green-50">
                      <span className="font-mono text-sm text-tawf-green">{shortAddress(address)}</span>
                      <Badge variant="success" size="sm">Connected</Badge>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value="Not connected"
                      disabled
                      className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl bg-gray-50 text-gray-400"
                    />
                  )}
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
            <div className="space-y-6">
              {/* Arbitrum Wallet Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-tawf-green">Arbitrum Wallet</h3>
                    <p className="text-sm text-tawf-muted">Connect an EVM wallet on Arbitrum Sepolia</p>
                  </div>
                  <ConnectButton variant="primary" size="md" />
                </div>

                {isConnected && address && (
                  <div className="p-4 bg-tawf-sand-30 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-tawf-muted">Wallet Address</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{shortAddress(address)}</span>
                        <Badge variant="success" size="sm">Connected</Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-tawf-muted">Test USDC</span>
                      <GetTestUsdc />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-tawf-green-10">
                      <span className="text-sm text-tawf-muted">View on Explorer</span>
                      <a
                        href={explorerAddressUrl(address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-tawf-green hover:underline"
                      >
                        Arbiscan <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Identity Verification */}
              <KycStatusCard key={address} />

              {/* Info Section */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">About Arbitrum Sepolia</h4>
                <p className="text-sm text-blue-700">
                  Tawf Finance runs on Arbitrum Sepolia, an Ethereum Layer-2 testnet. Use MetaMask or Rabby, mint
                  free test USDC from the faucet, and invest from USD 10. No secondary market, no speculation,
                  returns from real warung trade only.
                </p>
              </div>
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
