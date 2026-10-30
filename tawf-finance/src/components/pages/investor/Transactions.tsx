import { useState } from 'react';
import { useAccount } from 'wagmi';
import { CreditCard, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { useMyReceipts } from '@/web3/hooks';
import { RECEIPT_STATUS_LABEL, type ReceiptStatus } from '@/web3/types';
import { formatUsdc, formatTimestamp } from '@/web3/format';
import { RECEIPT_NFT_ADDRESS, explorerAddressUrl, explorerTxUrl } from '@/web3/constants';
import { Button } from '@/components/ui/Button';
import { useActivity, ACTIVITY_LABEL, PRODUCT_LABEL, eventAmount, timeAgo, ownEvents, type ActivityProduct } from '@/lib/activity';
import { DEPOSITO_STABLECOIN_FLOW_ENABLED, FINANCING_POOL_ENABLED } from '@/config/features';
import { cn } from '@/utils/cn';

const TYPE_LABEL: Record<ReceiptStatus, string> = {
  0: 'Investment',
  1: 'Investment (matured)',
  2: 'Redemption',
  3: 'Default claim',
};

const VARIANT: Record<ReceiptStatus, 'info' | 'success' | 'warning' | 'error' | 'default'> = {
  0: 'info',
  1: 'success',
  2: 'default',
  3: 'error',
};

function LegacyReceipts() {
  const { address, isConnected } = useAccount();
  const { positions, isLoading } = useMyReceipts(address);

  const totalInvested = positions.reduce((s, p) => s + p.meta.principal, 0n);
  const redeemed = positions
    .filter((p) => p.meta.status === 2)
    .reduce((s, p) => s + p.meta.principal, 0n);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Total Invested</p>
          <p className="font-serif text-xl text-tawf-green">{formatUsdc(totalInvested)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Redeemed</p>
          <p className="font-serif text-xl text-tawf-gold">{formatUsdc(redeemed)}</p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-medium text-tawf-green flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Activity
          </p>
          {RECEIPT_NFT_ADDRESS && (
            <a
              href={explorerAddressUrl(RECEIPT_NFT_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-tawf-muted hover:text-tawf-green inline-flex items-center gap-1"
            >
              Receipt contract <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-tawf-muted">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : !isConnected ? (
          <div className="text-center py-16">
            <p className="text-tawf-muted mb-4">Connect your wallet to see activity</p>
            <ConnectButton variant="primary" size="md" />
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-tawf-muted">No activity yet. Your receipts appear here once you invest.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {positions.map(({ deal, meta }) => (
              <div
                key={deal.id.toString()}
                className="flex items-center gap-4 p-4 rounded-xl border border-tawf-green-10 bg-white"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-tawf-green truncate">{deal.supplierName}</p>
                  <p className="text-xs text-tawf-muted">
                    {TYPE_LABEL[meta.status]} · {formatTimestamp(meta.mintedAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-tawf-green">{formatUsdc(meta.principal)}</p>
                  <Badge variant={VARIANT[meta.status]} size="sm">
                    {RECEIPT_STATUS_LABEL[meta.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const PRODUCT_FILTERS: { id: 'all' | ActivityProduct; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pool', label: 'Deposito Pool: Jawa Barat' },
  { id: 'series1', label: 'BPRS Demo' },
  { id: 'scf', label: 'Urun Dana' },
];

const TYPE_FILTERS: { id: string; label: string; kinds: string[] }[] = [
  { id: 'all', label: 'All types', kinds: [] },
  { id: 'subscribe', label: 'Subscriptions', kinds: ['Subscribed', 'SubscriptionCancelled', 'Refunded'] },
  { id: 'alloc', label: 'Allocations', kinds: ['Allocated'] },
  { id: 'profit', label: 'Profit', kinds: ['ProfitDistributed', 'ProfitClaimed'] },
  { id: 'redeem', label: 'Redemptions', kinds: ['MaturitySettled', 'Redeemed'] },
];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'min-h-9 px-3 rounded-full text-xs font-medium border transition-colors',
        active ? 'bg-tawf-green text-tawf-sand border-tawf-green' : 'bg-white text-tawf-muted border-tawf-green-10 hover:text-tawf-green',
      )}
    >
      {children}
    </button>
  );
}

export function Transactions() {
  const { address, isConnected } = useAccount();
  const { events, loading, error, refresh } = useActivity(address);
  const [product, setProduct] = useState<'all' | ActivityProduct>('all');
  const [type, setType] = useState('all');

  // Only enabled products get a filter, plus any product that already has events, so past pool history stays reachable.
  const productFilters = PRODUCT_FILTERS.filter((f) => f.id === 'all' || f.id === 'scf' || DEPOSITO_STABLECOIN_FLOW_ENABLED || ownEvents(events).some((e) => e.product === f.id));
  const kinds = TYPE_FILTERS.find((t) => t.id === type)?.kinds ?? [];
  const own = ownEvents(events);
  const rows = own.filter((e) => (product === 'all' || e.product === product) && (kinds.length === 0 || kinds.includes(e.kind)));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Transactions</h1>
        <p className="text-tawf-muted">{DEPOSITO_STABLECOIN_FLOW_ENABLED ? 'Your on-chain history across the Deposito Pools and Urun Dana' : 'Your on-chain history in Urun Dana and any earlier Deposito Pool activity'}</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <p className="font-medium text-tawf-green flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> History
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={!isConnected || loading}>
            <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>

        {!isConnected ? (
          <div className="text-center py-16">
            <p className="text-tawf-muted mb-4">Connect your wallet to see your history</p>
            <ConnectButton variant="primary" size="md" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {productFilters.map((f) => (
                <Pill key={f.id} active={product === f.id} onClick={() => setProduct(f.id)}>{f.label}</Pill>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {TYPE_FILTERS.map((f) => (
                <Pill key={f.id} active={type === f.id} onClick={() => setType(f.id)}>{f.label}</Pill>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-200 mb-4 text-sm text-red-600">
                Could not load activity: {error}
              </div>
            )}

            {loading && own.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-tawf-muted">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading history...
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-tawf-muted">
                  {own.length === 0 ? 'No activity yet. Your subscriptions and profit appear here.' : 'Nothing matches these filters.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((e) => (
                  <div key={e.id} className="flex items-center gap-4 p-4 rounded-xl border border-tawf-green-10 bg-white">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-tawf-green">
                        {ACTIVITY_LABEL[e.kind] ?? e.kind}
                        {e.period ? <span className="text-tawf-muted font-normal"> (period {e.period})</span> : null}
                      </p>
                      <p className="text-xs text-tawf-muted truncate">{PRODUCT_LABEL[e.product]}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-tawf-green">{eventAmount(e)}</p>
                      <p className="text-xs text-tawf-muted">{timeAgo(e.timestamp)}</p>
                    </div>
                    <a href={explorerTxUrl(e.txHash)} target="_blank" rel="noopener noreferrer" className="text-tawf-muted hover:text-tawf-green shrink-0" title="View transaction">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {FINANCING_POOL_ENABLED && <LegacyReceipts />}
    </div>
  );
}
