import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Search, ExternalLink, Loader2, TrendingUp, Clock, DollarSign, Target, ShieldCheck, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { GetTestUsdc } from '@/components/web3/GetTestUsdc';
import { KycStatusCard } from '@/components/kyc/KycStatusCard';
import { useDeals, useAllowance, useUsdcBalance, useInvest } from '@/web3/hooks';
import { DEAL_STATUS_LABEL, type Deal, type DealStatus } from '@/web3/types';
import { formatUsdc, formatApy, usdcToNumber, getRevertReason } from '@/web3/format';
import { isConfigured, explorerTxUrl } from '@/web3/constants';
import { cn } from '@/utils/cn';

const STATUS_VARIANT: Record<DealStatus, 'info' | 'success' | 'warning' | 'error' | 'default'> = {
  0: 'default',
  1: 'default',
  2: 'info',
  3: 'success',
  4: 'warning',
  5: 'default',
  6: 'error',
};

function DealCard({ deal, onInvest }: { deal: Deal; onInvest: (deal: Deal) => void }) {
  const min = usdcToNumber(deal.minInvestment);
  const target = usdcToNumber(deal.fundingTarget);
  const funded = usdcToNumber(deal.totalFunded);
  const apy = formatApy(deal.apyBps);
  const investable = deal.status === 2;

  return (
    <Card hover className="p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <Badge variant="info" size="sm">{deal.anchorBuyer}</Badge>
        <Badge variant={STATUS_VARIANT[deal.status]} size="sm">{DEAL_STATUS_LABEL[deal.status]}</Badge>
      </div>

      <h3 className="font-serif text-xl text-tawf-green mb-2">{deal.supplierName}</h3>
      <p className="text-tawf-muted text-sm leading-relaxed mb-4">
        Purchase order funded by <span className="text-tawf-green font-medium">{deal.anchorBuyer}</span>. Yield
        repaid from real trade, not speculation.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-tawf-gold shrink-0" />
          <div>
            <p className="text-xs text-tawf-muted">APY</p>
            <p className="font-medium text-tawf-green">{apy}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-tawf-gold shrink-0" />
          <div>
            <p className="text-xs text-tawf-muted">Duration</p>
            <p className="font-medium text-tawf-green">{deal.durationDays.toString()}d</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-tawf-gold shrink-0" />
          <div>
            <p className="text-xs text-tawf-muted">Min ticket</p>
            <p className="font-medium text-tawf-green">{formatUsdc(min)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-tawf-gold shrink-0" />
          <div>
            <p className="text-xs text-tawf-muted">Target</p>
            <p className="font-medium text-tawf-green">{formatUsdc(target)}</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <ProgressBar value={funded} max={target} size="sm" color="green" showLabel label="Funding Progress" />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-tawf-muted">{formatUsdc(funded)} raised</span>
          <span className="text-xs text-tawf-muted">{deal.investorCount.toString()} investors</span>
        </div>
      </div>

      <div className="mt-auto">
        <Button
          variant="primary"
          size="md"
          className="w-full"
          disabled={!investable}
          onClick={() => onInvest(deal)}
        >
          {investable ? 'Invest Now' : 'Funding Closed'}
        </Button>
      </div>
    </Card>
  );
}

export function InvestorPools() {
  const { address, isConnected } = useAccount();
  const { deals, isLoading, refetch } = useDeals();
  const { balance } = useUsdcBalance(address);
  const { allowance, refetch: refetchAllowance } = useAllowance(address);
  const { invest, isPending: isInvesting } = useInvest();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DealStatus | 'all'>('all');
  const [selected, setSelected] = useState<Deal | null>(null);
  const [amount, setAmount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const filtered = useMemo(() => {
    return deals
      .filter((d) => (statusFilter === 'all' ? true : d.status === statusFilter))
      .filter((d) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          d.supplierName.toLowerCase().includes(q) || d.anchorBuyer.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.apyBps) - Number(a.apyBps));
  }, [deals, statusFilter, searchQuery]);

  const openInvest = (deal: Deal) => {
    setSelected(deal);
    setAmount(usdcToNumber(deal.minInvestment));
    setError(null);
    setTxHash(null);
  };

  const minAmount = selected ? usdcToNumber(selected.minInvestment) : 0;
  const remaining = selected ? usdcToNumber(selected.fundingTarget - selected.totalFunded) : 0;
  const clampedAmount = Math.min(Math.max(amount, minAmount), remaining || amount);
  const expectedYield = selected
    ? clampedAmount * (usdcToNumber(selected.apyBps) / 10000) * (Number(selected.durationDays) / 365)
    : 0;

  const handleInvest = async () => {
    if (!selected) return;
    setError(null);
    setTxHash(null);
    try {
      const baseUnits = BigInt(Math.round(clampedAmount * 1e6));
      const { hash } = await invest(selected.id, baseUnits, allowance);
      setTxHash(hash);
      refetch();
      refetchAllowance();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Investment Pools</h1>
          <p className="text-tawf-muted">Fund real warung purchase orders from USD 10</p>
        </div>
        <div className="flex items-center gap-3">
          <GetTestUsdc />
          <ConnectButton variant="primary" size="md" />
        </div>
      </div>

      <KycStatusCard key={address} compact />

      {!isConfigured && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <p className="font-medium text-amber-800 mb-1">Contracts not configured</p>
          <p className="text-sm text-amber-700">
            Set <code className="font-mono">VITE_DEAL_REGISTRY</code>,{' '}
            <code className="font-mono">VITE_RECEIPT_NFT</code>, <code className="font-mono">VITE_VAULT</code> and{' '}
            <code className="font-mono">VITE_USDC</code> in <code className="font-mono">.env</code> to load live
            Arbitrum Sepolia deals.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-tawf-green-10 p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-5">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tawf-muted" />
            <input
              type="text"
              placeholder="Search warung or anchor buyer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 2, 3, 4, 5, 6] as const).map((s) => (
            <button
              key={String(s)}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                statusFilter === s
                  ? 'bg-tawf-green text-tawf-sand'
                  : 'bg-tawf-sand-30 text-tawf-green hover:bg-tawf-green-10',
              )}
            >
              {s === 'all' ? 'All' : DEAL_STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <p className="text-sm text-tawf-muted mt-4">
          Showing <span className="font-medium text-tawf-green">{filtered.length}</span> deals
        </p>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-tawf-muted">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading deals…
        </div>
      ) : !isConnected ? (
        <div className="text-center py-16">
          <Wallet className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <h3 className="font-serif text-xl text-tawf-green mb-2">Connect your wallet</h3>
          <p className="text-tawf-muted mb-4">Connect an EVM wallet on Arbitrum Sepolia to invest</p>
          <ConnectButton variant="primary" size="md" />
        </div>
      ) : filtered.length > 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((deal) => (
            <DealCard key={deal.id.toString()} deal={deal} onInvest={openInvest} />
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-16">
          <ShieldCheck className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <h3 className="font-serif text-xl text-tawf-green mb-2">No deals yet</h3>
          <p className="text-tawf-muted">Deals appear here once seeded on Arbitrum Sepolia</p>
        </div>
      )}

      {/* Invest modal */}
      <Modal
        isOpen={!!selected}
        onClose={() => {
          setSelected(null);
          setTxHash(null);
          setError(null);
        }}
        title={txHash ? 'Investment Submitted' : selected?.supplierName ?? ''}
        size="md"
      >
        {selected && txHash ? (
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-2">Investment Confirmed!</h3>
            <p className="text-tawf-muted mb-4">
              You invested {formatUsdc(clampedAmount)} in {selected.supplierName}
            </p>
            <div className="bg-tawf-sand-30 rounded-xl p-4 mb-4">
              <p className="text-sm text-tawf-muted mb-2">Transaction hash</p>
              <a
                href={explorerTxUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-tawf-green break-all hover:underline inline-flex items-center gap-1"
              >
                {txHash.slice(0, 18)}…{txHash.slice(-8)} <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
            <p className="text-sm text-tawf-muted">
              A soulbound receipt (ERC-1155) has been minted to your wallet and is visible in your portfolio.
            </p>
          </div>
        ) : selected ? (
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 bg-tawf-sand-30 rounded-xl">
              <div className="p-3 bg-tawf-green-10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-tawf-green" />
              </div>
              <div className="flex-1">
                <Badge variant="info" size="sm" className="mb-2">{selected.anchorBuyer}</Badge>
                <p className="text-sm text-tawf-muted">
                  {formatApy(selected.apyBps)} APY · {selected.durationDays.toString()} days · repaid by{' '}
                  {selected.anchorBuyer}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Investment Amount (USDC)</label>
              <div className="flex items-center gap-4 mb-3">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  min={minAmount}
                  max={remaining}
                  className="flex-1 px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                />
                <span className="text-sm font-medium text-tawf-green">USDC</span>
              </div>
              <input
                type="range"
                value={clampedAmount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min={minAmount}
                max={remaining || minAmount}
                step={10}
                className="w-full accent-tawf-green"
              />
              <div className="flex justify-between text-xs text-tawf-muted mt-1">
                <span>{formatUsdc(minAmount)} min</span>
                <span>{formatUsdc(remaining)} remaining</span>
              </div>
              <p className="text-xs text-tawf-muted mt-2">
                Your balance: <span className="font-medium text-tawf-green">{formatUsdc(balance)}</span>
              </p>
            </div>

            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-tawf-muted">APY</span>
                <span className="font-semibold text-tawf-green">{formatApy(selected.apyBps)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-tawf-muted">Est. yield at maturity</span>
                <span className="font-semibold text-tawf-green text-lg">{formatUsdc(expectedYield)}</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              disabled={isInvesting || clampedAmount < minAmount || balance < BigInt(Math.round(clampedAmount * 1e6))}
              onClick={handleInvest}
            >
              {isInvesting ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Confirming Transaction…
                </>
              ) : (
                `Invest ${formatUsdc(clampedAmount)}`
              )}
            </Button>
            <p className="text-xs text-tawf-muted text-center">
              One soulbound receipt per investment — non-transferable by design.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
