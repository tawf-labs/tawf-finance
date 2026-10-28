import { useMemo, useState } from 'react';
import { ExternalLink, Globe, Shield, Database } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import deployments from '@/web3/tokenization.deployments.json';
import { CHAIN_ID, EXPLORER_URL, RPC_URL, explorerAddressUrl } from '@/web3/constants';
import { WALLETCONNECT_PROJECT_ID } from '@/web3/config';
import { FINANCING_POOL_ENABLED } from '@/config/features';
import { shortAddress } from '@/web3/format';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** `tawfSeriesToken` becomes "Tawf series token". */
function labelOf(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 border border-tawf-green-10 rounded-xl">
      <span className="text-sm text-tawf-muted">{label}</span>
      <span className="text-sm text-tawf-green text-right">{children}</span>
    </div>
  );
}

function AddressLink({ address }: { address: `0x${string}` }) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono hover:underline"
      title={address}
    >
      {shortAddress(address)} <ExternalLink className="w-3 h-3" />
    </a>
  );
}

export function AdminSettings() {
  const [activeTab, setActiveTab] = useState('deployment');

  const tabs = [
    { id: 'deployment', label: 'Deployment', content: null, icon: <Database className="w-4 h-4" /> },
    { id: 'network', label: 'Network and features', content: null, icon: <Globe className="w-4 h-4" /> },
    { id: 'access', label: 'Access', content: null, icon: <Shield className="w-4 h-4" /> },
  ];

  const contracts = useMemo(
    () =>
      Object.entries(deployments as Record<string, unknown>)
        .filter(([key, value]) => typeof value === 'string' && ADDRESS.test(value) && key !== 'operator')
        .map(([key, value]) => ({ key, address: value as `0x${string}` })),
    [],
  );
  const operator = (deployments as { operator?: string }).operator;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Platform Settings</h1>
        <p className="text-tawf-muted">What the platform is running on. This page is read only, deployment changes go through the deploy scripts.</p>
      </div>

      <Card className="p-6">
        <Tabs tabs={tabs} defaultTab="deployment" variant="underline" onChange={setActiveTab} />

        <div className="mt-8">
          {activeTab === 'deployment' && (
            <div className="space-y-3">
              <p className="text-sm text-tawf-muted">
                Contract addresses from <span className="font-mono">tokenization.deployments.json</span> on chain {CHAIN_ID} (Arbitrum Sepolia).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {contracts.map((c) => (
                  <Row key={c.key} label={labelOf(c.key)}>
                    <AddressLink address={c.address} />
                  </Row>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-3 max-w-2xl">
              <Row label="Chain">Arbitrum Sepolia ({CHAIN_ID})</Row>
              <Row label="Explorer">
                <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  {EXPLORER_URL.replace(/^https?:\/\//, '')} <ExternalLink className="w-3 h-3" />
                </a>
              </Row>
              <Row label="Browser RPC">{RPC_URL.includes('sepolia-rollup.arbitrum.io') ? 'Public Arbitrum endpoint' : 'Dedicated endpoint'}</Row>
              <Row label="Operator">
                {operator && ADDRESS.test(operator) ? <AddressLink address={operator as `0x${string}`} /> : <Badge variant="default" size="sm">Not set</Badge>}
              </Row>
              <Row label="Financing sell-down pool">
                <Badge variant={FINANCING_POOL_ENABLED ? 'success' : 'default'} size="sm">{FINANCING_POOL_ENABLED ? 'Enabled' : 'Off in this build'}</Badge>
              </Row>
              <Row label="WalletConnect">
                <Badge variant={WALLETCONNECT_PROJECT_ID ? 'success' : 'warning'} size="sm">{WALLETCONNECT_PROJECT_ID ? 'Configured' : 'Not configured'}</Badge>
              </Row>
            </div>
          )}

          {activeTab === 'access' && (
            <div className="space-y-4 max-w-2xl">
              <div className="p-4 bg-tawf-sand-30 rounded-xl">
                <h3 className="font-medium text-tawf-green mb-1">Pilot access model</h3>
                <p className="text-sm text-tawf-muted">
                  Sign-in is a demo login. Admin actions that write to the chain (reserve posts, closes, distributions, settlements, screening)
                  are checked on the server with the demo passcode and signed by the operator key, which never reaches the browser.
                </p>
              </div>
              <Row label="Operator">
                {operator && ADDRESS.test(operator) ? <AddressLink address={operator as `0x${string}`} /> : <Badge variant="default" size="sm">Not set</Badge>}
              </Row>
              <Row label="Admin write actions">Server side passcode</Row>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
