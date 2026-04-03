import { useState } from 'react';
import { User, Bell, Shield, LogOut, ExternalLink, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/hooks/useAuth';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { WalletButton } from '@/components/solana/WalletButton';

export function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const {
    connected,
    walletAddress,
    shortenedAddress,
    balance,
    usdcBalance,
    isLoadingBalance,
    isLoadingUsdcBalance,
    fetchBalance,
    fetchUsdcBalance,
    getExplorerUrl,
    requestAirdrop,
  } = useSolanaWallet();

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
                <Avatar name={user?.address?.slice(0, 4) ?? '?'} size="xl" />
                <div className="flex-1">
                  <h3 className="font-serif text-xl text-tawf-green font-mono">
                    {user?.address ? `${user.address.slice(0, 4)}...${user.address.slice(-4)}` : 'Wallet'}
                  </h3>
                  <p className="text-tawf-muted font-mono text-sm">{user?.address ?? ''}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="success" size="sm">Active</Badge>
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
                    defaultValue={user?.address ?? ''}
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    defaultValue=""
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    defaultValue={''}
                    placeholder="Add phone number"
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">
                    Wallet Address
                  </label>
                  {connected && walletAddress ? (
                    <div className="flex items-center gap-2 p-3 border border-tawf-green-10 rounded-xl bg-green-50">
                      <span className="font-mono text-sm text-tawf-green">{shortenedAddress}</span>
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
              {/* Solana Wallet Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-tawf-green">Solana Wallet</h3>
                    <p className="text-sm text-tawf-muted">Connect your Phantom wallet for Solana Devnet</p>
                  </div>
                  <WalletButton className="btn-primary text-sm px-4 py-2 rounded-lg" />
                </div>

                {connected && walletAddress && (
                  <div className="p-4 bg-tawf-sand-30 rounded-xl space-y-3">
                    {/* Wallet Address */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-tawf-muted">Wallet Address</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{shortenedAddress}</span>
                        <Badge variant="success" size="sm">Connected</Badge>
                      </div>
                    </div>

                    {/* SOL Balance (Gas) */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-tawf-muted">SOL Balance</span>
                        <span className="text-xs text-tawf-muted ml-2">(for gas fees)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg">
                          {isLoadingBalance ? '...' : `${balance.toFixed(4)} SOL`}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={fetchBalance}
                          disabled={isLoadingBalance}
                        >
                          Refresh
                        </Button>
                      </div>
                    </div>

                    {/* USDC Balance (Investments) */}
                    <div className="flex items-center justify-between bg-green-50 rounded-lg p-3 -mx-3">
                      <div>
                        <span className="text-sm font-medium text-tawf-green">USDC Balance</span>
                        <span className="text-xs text-tawf-muted ml-2">(for investments)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg text-tawf-green">
                          {isLoadingUsdcBalance ? '...' : `$${usdcBalance.toFixed(2)} USDC`}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={fetchUsdcBalance}
                          disabled={isLoadingUsdcBalance}
                          className="text-tawf-green hover:text-tawf-green-80"
                        >
                          Refresh
                        </Button>
                      </div>
                    </div>

                    {/* Explorer Link */}
                    <div className="flex items-center justify-between pt-2 border-t border-tawf-green-10">
                      <span className="text-sm text-tawf-muted">View on Explorer</span>
                      <a
                        href={getExplorerUrl(walletAddress, 'address')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-tawf-green hover:underline"
                      >
                        Solscan <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Airdrop Button (Devnet Only) */}
                    <div className="pt-2 border-t border-tawf-green-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => requestAirdrop(1)}
                        className="text-tawf-gold hover:text-tawf-gold-80"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Request 1 SOL Airdrop (Devnet)
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Info Section */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">About Solana Devnet</h4>
                <p className="text-sm text-blue-700 mb-2">
                  Tawf Finance uses Solana Devnet for testing. Devnet is a test network where you can:
                </p>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li>Request free SOL airdrops for testing</li>
                  <li>Make transactions without spending real money</li>
                  <li>Test NFT minting and smart contracts</li>
                </ul>
                <p className="text-sm text-blue-700 mt-2">
                  Install <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="underline font-medium">Phantom Wallet</a> to get started.
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
