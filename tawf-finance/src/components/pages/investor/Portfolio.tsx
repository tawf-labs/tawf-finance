import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Briefcase, Loader2, FileText, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { GetTestUsdc } from '@/components/web3/GetTestUsdc';
import { useMyReceipts, usePayoutFor, useRedeem, useClaimDefault, useDefaultPayout } from '@/web3/hooks';
import { useTawfSeries, useSukuk } from '@/web3/tokenizationHooks';
import { FINANCING_POOL_ENABLED } from '@/config/features';
import { RECEIPT_STATUS_LABEL, type ReceiptStatus, type Deal } from '@/web3/types';
import { formatUsdc, formatApy, formatTimestamp, formatIdr, getRevertReason } from '@/web3/format';
import { RECEIPT_NFT_ADDRESS, isConfigured, explorerTxUrl, explorerAddressUrl } from '@/web3/constants';
import { isTokenizationConfigured, DEPOSITO_POOL, SCF_DISTRIBUTOR_ADDRESS, SCF_TOKEN_ADDRESS, SCF_SYMBOL } from '@/web3/tokenization';
import { cn } from '@/utils/cn';

const RECEIPT_VARIANT: Record<ReceiptStatus, 'info' | 'success' | 'warning' | 'error' | 'default'> = {
  0: 'info',
  1: 'success',
  2: 'default',
  3: 'error',
};

function projectedYield(principal: bigint, apyBps: bigint, durationDays: bigint): bigint {
  return (principal * apyBps * durationDays) / 36500n;
}

function ActionModal({
  deal,
  mode,
  address,
  onDone,
  onClose,
}: {
  deal: Deal;
  mode: 'redeem' | 'claim';
  address: `0x${string}`;
  onDone: () => void;
  onClose: () => void;
}) {
  const { payout: redeemPayout, isLoading } = usePayoutFor(deal.id, address);
  // A default pays the holder's pro-rata share of what the bank recovered.
  const { payout: defaultPayout } = useDefaultPayout(deal.id, address);
  const payout = mode === 'claim' && defaultPayout !== undefined ? defaultPayout : redeemPayout;
  const { redeem, isPending: redeeming } = useRedeem();
  const { claim, isPending: claiming } = useClaimDefault();
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const isPending = redeeming || claiming;

  const handle = async () => {
    setError(null);
    try {
      const { hash } = mode === 'redeem' ? await redeem(deal.id) : await claim(deal.id);
      setTxHash(hash);
      onDone();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === 'redeem' ? 'Redeem Principal + Yield' : 'Claim Default Recovery'}
      size="md"
    >
      {txHash ? (
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-serif text-2xl text-tawf-green mb-2">Paid Out</h3>
          <p className="text-tawf-muted mb-4">Receipt burned. Funds sent to your wallet.</p>
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-tawf-green break-all hover:underline inline-flex items-center gap-1"
          >
            {txHash.slice(0, 18)}…{txHash.slice(-8)} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-tawf-sand-30 rounded-xl">
            <p className="text-sm text-tawf-muted mb-1">{deal.supplierName}</p>
            <p className="font-medium text-tawf-green">
              {isLoading ? 'Calculating…' : formatUsdc(payout)} {mode === 'redeem' ? '(principal + yield)' : '(your share of the recovery)'}
            </p>
          </div>
          {mode === 'claim' && (
            <p className="text-xs text-tawf-muted">
              In a musyarakah default, investors share what the bank recovered pro rata. Tawf adds to it only if
              the Shariah board or an independent auditor found Tawf negligent.
            </p>
          )}
          {error && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <Button size="lg" className="w-full" onClick={handle} disabled={isPending || isLoading}>
            {isPending ? 'Confirming…' : 'Confirm'}
          </Button>
        </div>
      )}
    </Modal>
  );
}

const POOL_TARGET = { series: DEPOSITO_POOL.series, token: DEPOSITO_POOL.token, sandbox: DEPOSITO_POOL.sandbox, seriesId: DEPOSITO_POOL.seriesId };
const SCF_TARGET = { distributor: SCF_DISTRIBUTOR_ADDRESS, token: SCF_TOKEN_ADDRESS };

export function Portfolio() {
  const { address, isConnected } = useAccount();
  const { positions, isLoading, refetch } = useMyReceipts(address);
  const { state: seriesState } = useTawfSeries(address);
  const { state: poolState } = useTawfSeries(address, POOL_TARGET);
  const { state: scfState } = useSukuk(address, SCF_TARGET);
  const [action, setAction] = useState<{ deal: Deal; mode: 'redeem' | 'claim' } | null>(null);

  const seriesPending = seriesState.coins.reduce((s, c) => s + c.pending, 0n);
  const hasSeries = seriesState.balance > 0n || seriesPending > 0n;
  const poolPending = poolState.coins.reduce((s, c) => s + c.pending, 0n);
  const hasPool = Boolean(DEPOSITO_POOL.series) && (poolState.balance > 0n || poolPending > 0n);
  const hasScf = Boolean(SCF_DISTRIBUTOR_ADDRESS) && scfState.balance > 0n;

  const totalInvested = positions.reduce((s, p) => s + p.meta.principal, 0n);
  const totalProjected = positions.reduce(
    (s, p) => s + projectedYield(p.meta.principal, p.meta.apyBps, p.meta.durationDays),
    0n,
  );
  const activeCount = positions.filter((p) => p.meta.status === 0 || p.meta.status === 1).length;
  const redeemedCount = positions.filter((p) => p.meta.status === 2).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">My Portfolio</h1>
          <p className="text-tawf-muted">Your Deposito Pool and crowdfunding positions</p>
        </div>
        <GetTestUsdc />
      </div>

      {!isConfigured && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <p className="text-sm text-amber-700">
            Contracts not configured. Add your Arbitrum Sepolia addresses to <code className="font-mono">.env</code>.
          </p>
        </div>
      )}

      {FINANCING_POOL_ENABLED && (
        <>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Total Invested</p>
          <p className="font-serif text-2xl text-tawf-green">{formatUsdc(totalInvested)}</p>
          <p className="text-xs text-tawf-muted mt-2">{positions.length} receipts</p>
        </Card>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Projected Returns</p>
          <p className="font-serif text-2xl text-tawf-gold">{formatUsdc(totalProjected)}</p>
          <p className="text-xs text-tawf-muted mt-2">At maturity</p>
        </Card>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Live Positions</p>
          <p className="font-serif text-2xl text-tawf-green">{activeCount}</p>
          <p className="text-xs text-tawf-muted mt-2">Earning or ready to redeem</p>
        </Card>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Redeemed</p>
          <p className="font-serif text-2xl text-tawf-green">{redeemedCount}</p>
          <p className="text-xs text-tawf-muted mt-2">Receipts burned</p>
        </Card>
      </div>

      {/* Positions */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-medium text-tawf-green flex items-center gap-2">
            <Briefcase className="w-4 h-4" /> Positions
          </p>
          <button onClick={refetch} className="text-xs text-tawf-muted hover:text-tawf-green">
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-tawf-muted">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading receipts…
          </div>
        ) : !isConnected ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
            <p className="text-tawf-muted mb-4">Connect your wallet to see your receipts</p>
            <ConnectButton variant="primary" size="md" />
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
            <p className="text-tawf-muted">No positions yet. Invest in a pool to mint your first receipt.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {positions.map(({ deal, meta }) => {
              const projected = projectedYield(meta.principal, meta.apyBps, meta.durationDays);
              const redeemable = meta.status === 1;
              const claimable = meta.status === 3;
              return (
                <div
                  key={deal.id.toString()}
                  className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-tawf-green-10 bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-tawf-green truncate">{deal.supplierName}</p>
                      <Badge variant={RECEIPT_VARIANT[meta.status]} size="sm">
                        {RECEIPT_STATUS_LABEL[meta.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-tawf-muted">
                      {deal.anchorBuyer} · {formatApy(meta.apyBps)} APY · minted {formatTimestamp(meta.mintedAt)}
                    </p>
                  </div>
                  <div className="flex md:flex-col items-center md:items-end gap-1 shrink-0">
                    <p className="text-sm text-tawf-muted">Principal</p>
                    <p className="font-semibold text-tawf-green">{formatUsdc(meta.principal)}</p>
                  </div>
                  <div className="flex md:flex-col items-center md:items-end gap-1 shrink-0">
                    <p className="text-sm text-tawf-muted">Projected yield</p>
                    <p className={cn('font-semibold', meta.status === 2 ? 'text-tawf-muted' : 'text-tawf-gold')}>
                      {formatUsdc(projected)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {redeemable && (
                      <Button size="sm" onClick={() => setAction({ deal, mode: 'redeem' })}>
                        Redeem
                      </Button>
                    )}
                    {claimable && (
                      <Button variant="secondary" size="sm" onClick={() => setAction({ deal, mode: 'claim' })}>
                        Claim Principal
                      </Button>
                    )}
                    {meta.status === 2 && (
                      <a
                        href={explorerAddressUrl(RECEIPT_NFT_ADDRESS ?? '0x0')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-tawf-muted hover:text-tawf-green inline-flex items-center gap-1"
                      >
                        Burned <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {meta.status === 0 && (
                      <span className="text-xs text-tawf-muted">In progress</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

        </>
      )}

      {isTokenizationConfigured && isConnected && !hasSeries && !hasPool && !hasScf && (
        <Card className="p-10 text-center">
          <FileText className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <p className="text-tawf-muted">No positions yet. Subscribe to a Deposito Pool or invest in a crowdfunding offering to get started.</p>
        </Card>
      )}

      {isTokenizationConfigured && isConnected && (hasSeries || hasPool || hasScf) && (
        <Card className="p-6">
          <p className="font-medium text-tawf-green mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4" /> Tokenized positions (ERC-3643)
          </p>
          <div className="space-y-3">
            {hasPool && (
              <PositionRow
                symbol={DEPOSITO_POOL.symbol}
                badge={DEPOSITO_POOL.name}
                note="Deposito at several BPRS in Jawa Barat · 1 token = IDR 1 claim on Tawf"
                holding={formatIdr(poolState.balance)}
                claimable={formatIdr(poolState.claimableSen)}
              />
            )}
            {hasSeries && (
              <PositionRow
                symbol="tDEP-TAWF-S1"
                badge="Tawf Deposito Pool: BPRS Demo"
                note="Deposito at one BPRS · 1 token = IDR 1 claim on Tawf"
                holding={formatIdr(seriesState.balance)}
                claimable={formatIdr(seriesState.claimableSen)}
              />
            )}
            {hasScf && (
              <PositionRow
                symbol={SCF_SYMBOL}
                badge="Urun Dana (SCF)"
                note="SME sukuk mudharabah through a licensed crowdfunding platform"
                holding={formatUsdc(scfState.balance)}
                claimable={formatUsdc(scfState.claimable)}
              />
            )}
          </div>
          <p className="text-xs text-tawf-muted mt-4">
            Manage these positions in <span className="font-medium">Deposito Pool</span> and{' '}
            <span className="font-medium">Urun Dana (SCF)</span>.
          </p>
        </Card>
      )}

      {action && address && (
        <ActionModal
          deal={action.deal}
          mode={action.mode}
          address={address}
          onDone={() => {
            refetch();
            setAction(null);
          }}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}

export function PositionRow({ symbol, badge, note, holding, claimable }: {
  symbol: string;
  badge: string;
  note: string;
  holding: string;
  claimable: string;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-tawf-green-10 bg-white">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-tawf-green">{symbol}</p>
          <Badge variant="info" size="sm">{badge}</Badge>
        </div>
        <p className="text-xs text-tawf-muted">{note}</p>
      </div>
      <div className="flex md:flex-col items-center md:items-end gap-1 shrink-0">
        <p className="text-sm text-tawf-muted">Holding</p>
        <p className="font-semibold text-tawf-green">{holding}</p>
      </div>
      <div className="flex md:flex-col items-center md:items-end gap-1 shrink-0">
        <p className="text-sm text-tawf-muted">Claimable profit</p>
        <p className="font-semibold text-tawf-gold">{claimable}</p>
      </div>
    </div>
  );
}
