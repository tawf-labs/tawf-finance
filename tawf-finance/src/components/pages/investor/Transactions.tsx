import { useAccount } from 'wagmi';
import { CreditCard, Loader2, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { useMyReceipts } from '@/web3/hooks';
import { RECEIPT_STATUS_LABEL, type ReceiptStatus } from '@/web3/types';
import { formatUsdc, formatTimestamp } from '@/web3/format';
import { RECEIPT_NFT_ADDRESS, explorerAddressUrl } from '@/web3/constants';

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

export function Transactions() {
  const { address, isConnected } = useAccount();
  const { positions, isLoading } = useMyReceipts(address);

  const totalInvested = positions.reduce((s, p) => s + p.meta.principal, 0n);
  const redeemed = positions
    .filter((p) => p.meta.status === 2)
    .reduce((s, p) => s + p.meta.principal, 0n);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Transactions</h1>
        <p className="text-tawf-muted">On-chain record of your soulbound receipts</p>
      </div>

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
