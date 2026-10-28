import { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { User, Bell, Shield, LogOut, ExternalLink, Loader2, CheckCircle2, Droplets } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/hooks/useAuth';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { GetTestTokens } from '@/components/web3/GetTestUsdc';
import { KycStatusCard } from '@/components/kyc/KycStatusCard';
import { useIsVerified } from '@/web3/tokenizationHooks';
import { isTokenizationConfigured } from '@/web3/tokenization';
import { runFaucet as postFaucet, type FaucetResult } from '@/lib/tokenization';
import { shortAddress } from '@/web3/format';
import { explorerAddressUrl, explorerTxUrl } from '@/web3/constants';

const NOTIFY_KEY = 'tawf.notifyPrefs';
const WAGMI_KEYS = ['wagmi.store', 'wagmi.recentConnectorId'];

type NotifyPrefs = { profit: boolean; allocation: boolean; maturity: boolean; kyc: boolean; network: boolean };
const DEFAULT_PREFS: NotifyPrefs = { profit: true, allocation: true, maturity: true, kyc: true, network: true };

const NOTIFY_ITEMS: { key: keyof NotifyPrefs; title: string; desc: string }[] = [
  { key: 'profit', title: 'Profit distributions', desc: 'When a profit period is posted for a pool or offering you hold' },
  { key: 'allocation', title: 'Allocations', desc: 'When Tawf allocates your escrowed subscription to the pool' },
  { key: 'maturity', title: 'Maturity and redemption', desc: 'When a series or offering matures and can be redeemed' },
  { key: 'kyc', title: 'Identity and screening', desc: 'When your on-chain identity or screening claim changes' },
  { key: 'network', title: 'Network status', desc: 'When your wallet is on the wrong network' },
];

function loadPrefs(): NotifyPrefs {
  try {
    const raw = localStorage.getItem(NOTIFY_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* storage blocked or corrupt, use defaults */
  }
  return DEFAULT_PREFS;
}

export function Settings() {
  const { user, logout, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const { address, isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phoneNumber ?? '' });
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState<NotifyPrefs>(loadPrefs);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startEdit = () => {
    setForm({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phoneNumber ?? '' });
    setSaved(false);
    setEditing(true);
  };
  const cancelEdit = () => {
    setForm({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phoneNumber ?? '' });
    setEditing(false);
  };
  const saveProfile = () => {
    updateUser({ name: form.name.trim() || user?.name, email: form.email.trim() || user?.email, phoneNumber: form.phone.trim() || undefined });
    setEditing(false);
    setSaved(true);
  };

  const togglePref = (key: keyof NotifyPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked, the toggle still works for this session */
    }
  };

  // wagmi writes its store again when it disconnects, so clear the keys after that has settled.
  const clearWagmi = () => {
    try {
      WAGMI_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  };

  const disconnectWallet = async () => {
    try {
      await disconnectAsync();
    } catch {
      /* already disconnected */
    }
    clearWagmi();
    setTimeout(clearWagmi, 300);
  };

  const deleteAccount = async () => {
    try {
      await disconnectAsync();
    } catch {
      /* already disconnected */
    }
    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('tawf.') || k === 'tawf_user' || WAGMI_KEYS.includes(k))) doomed.push(k);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    setTimeout(clearWagmi, 300);
    logout();
  };
  const { isVerified, refetch: refetchVerified } = useIsVerified(address);
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [faucetResult, setFaucetResult] = useState<FaucetResult | null>(null);
  const [faucetError, setFaucetError] = useState<string | null>(null);

  const runFaucet = async () => {
    if (!address) return;
    setFaucetBusy(true);
    setFaucetError(null);
    setFaucetResult(null);
    try {
      const res = await postFaucet(address);
      setFaucetResult(res);
      refetchVerified();
    } catch (e) {
      setFaucetError(e instanceof Error ? e.message : 'Faucet failed');
    } finally {
      setFaucetBusy(false);
    }
  };

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
                {!editing && (
                  <Button variant="secondary" size="md" onClick={startEdit}>
                    Edit Profile
                  </Button>
                )}
              </div>

              {/* Profile Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editing ? form.name : user?.name ?? ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    disabled={!editing}
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold disabled:bg-gray-50 disabled:text-tawf-muted"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editing ? form.email : user?.email ?? ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={!editing}
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold disabled:bg-gray-50 disabled:text-tawf-muted"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editing ? form.phone : user?.phoneNumber ?? ''}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    disabled={!editing}
                    placeholder="Add phone number"
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold disabled:bg-gray-50 disabled:text-tawf-muted"
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

              {editing ? (
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" size="md" onClick={cancelEdit}>Cancel</Button>
                  <Button variant="primary" size="md" onClick={saveProfile}>Save Changes</Button>
                </div>
              ) : (
                saved && <p className="text-sm text-green-700 text-right">Profile saved on this device.</p>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <p className="text-sm text-tawf-muted">Choose which events show in the bell. Saved on this device.</p>
              {NOTIFY_ITEMS.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 p-4 border border-tawf-green-10 rounded-xl">
                  <div>
                    <h4 className="font-medium text-tawf-green">{item.title}</h4>
                    <p className="text-sm text-tawf-muted">{item.desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs[item.key]}
                    aria-label={item.title}
                    onClick={() => togglePref(item.key)}
                    className={`w-12 h-6 shrink-0 rounded-full transition-colors ${prefs[item.key] ? 'bg-tawf-green' : 'bg-gray-200'} relative`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${prefs[item.key] ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="p-4 bg-tawf-sand-30 rounded-xl">
                <h3 className="font-medium text-tawf-green mb-1">Your wallet is your account</h3>
                <p className="text-sm text-tawf-muted">
                  The pilot sign-in is a demo login with no password. What protects your holdings is your wallet and the
                  on-chain identity (ONCHAINID) attached to it. Keep your wallet keys private.
                </p>
              </div>

              <div className="space-y-3 max-w-md">
                <div className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
                  <span className="text-sm text-tawf-muted">Connected wallet</span>
                  {isConnected && address ? (
                    <span className="font-mono text-sm text-tawf-green">{shortAddress(address)}</span>
                  ) : (
                    <Badge variant="default" size="sm">Not connected</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
                  <span className="text-sm text-tawf-muted">On-chain identity</span>
                  <Badge variant={isVerified ? 'success' : 'default'} size="sm">
                    {!isConnected ? 'Connect a wallet' : isVerified ? 'Verified identity' : 'Not verified'}
                  </Badge>
                </div>
                <Button variant="secondary" size="md" onClick={() => void disconnectWallet()} disabled={!isConnected}>
                  Disconnect wallet
                </Button>
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

                    <GetTestTokens />

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

              {/* ERC-3643 test funds + identity */}
              {isTokenizationConfigured && (
                <div className="p-4 bg-tawf-sand-30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-tawf-green">Tokenization (ERC-3643)</h3>
                      <p className="text-sm text-tawf-muted">Test ETH, mUSDC, mUSDT and mUSDG, plus a verified on-chain identity (test KYC, testnet only)</p>
                    </div>
                    <Badge variant={isVerified ? 'success' : 'default'} size="sm">
                      {isVerified ? 'Verified identity' : 'Not verified'}
                    </Badge>
                  </div>
                  <Button variant="primary" size="md" disabled={!isConnected || faucetBusy} onClick={runFaucet}>
                    {faucetBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Droplets className="w-4 h-4 mr-2" />}
                    Get test funds + verify identity (test KYC)
                  </Button>
                  {faucetError && <p className="text-xs text-red-600">{faucetError}</p>}
                  {faucetResult && (
                    <div className="space-y-2 pt-2 border-t border-tawf-green-10">
                      {faucetResult.steps.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {s.skipped ? (
                            <span className="w-2 h-2 rounded-full bg-tawf-muted shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          )}
                          <span className="text-tawf-ink">{s.label}</span>
                          {s.txHash && (
                            <a href={explorerTxUrl(s.txHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-tawf-green hover:underline inline-flex items-center gap-1">
                              tx <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Identity Verification */}
              <KycStatusCard key={address} />

              {/* Info Section */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">About Arbitrum Sepolia</h4>
                <p className="text-sm text-blue-700">
                  Tawf Finance runs on Arbitrum Sepolia, an Ethereum Layer-2 testnet. Use MetaMask or Rabby, mint
                  free test USDC from the faucet, and invest from $10. Returns come from real BPRS serviced financing, with
                  a Shariah-aligned secondary market on the roadmap.
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
          {confirmDelete ? (
            <div className="w-full p-4 border border-red-200 bg-red-50 rounded-xl space-y-3">
              <p className="text-sm text-red-700">
                This clears your profile, preferences and wallet connection from this device and signs you out. On-chain
                holdings are not affected.
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" size="md" onClick={() => setConfirmDelete(false)}>Keep my account</Button>
                <Button variant="ghost" size="md" className="text-red-600 hover:bg-red-100" onClick={() => void deleteAccount()}>
                  Yes, delete my local account
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="md" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
              Delete Account
            </Button>
          )}
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
