import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, ExternalLink, ShieldCheck, Wallet, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { GetTestUsdc } from '@/components/web3/GetTestUsdc';
import {
  useDeals,
  useOwner,
  useAllowance,
  useUsdcBalance,
  useApproveDeal,
  useMarkMintable,
  useRepay,
  useMarkMatured,
  useDefaultDeal,
} from '@/web3/hooks';
import { DEAL_STATUS_LABEL, type Deal, type DealStatus } from '@/web3/types';
import { formatUsdc, usdcToNumber, getRevertReason } from '@/web3/format';
import { isConfigured, explorerTxUrl } from '@/web3/constants';

const STATUS_VARIANT: Record<DealStatus, 'info' | 'success' | 'warning' | 'error' | 'default'> = {
  0: 'default',
  1: 'default',
  2: 'info',
  3: 'success',
  4: 'warning',
  5: 'default',
  6: 'error',
};

function projectedYield(deal: Deal): number {
  return usdcToNumber(deal.totalFunded) * (usdcToNumber(deal.apyBps) / 10000) * (Number(deal.durationDays) / 365);
}

export function OwnerOps() {
  const { address, isConnected } = useAccount();
  const { owner } = useOwner();
  const { deals, isLoading, refetch } = useDeals();
  const { allowance, refetch: refetchAllowance } = useAllowance(address);
  const { balance, refetch: refetchBalance } = useUsdcBalance(address);

  const { approve, isPending: approving } = useApproveDeal();
  const { markMintable, isPending: minting } = useMarkMintable();
  const { repay, isPending: repaying } = useRepay();
  const { markMatured, isPending: maturing } = useMarkMatured();
  const { defaultDeal, isPending: defaulting } = useDefaultDeal();

  const [repayDeal, setRepayDeal] = useState<Deal | null>(null);
  const [totalRepayment, setTotalRepayment] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const isOwner = isConnected && owner !== undefined && address === owner;

  const handle = async (fn: () => Promise<{ hash: `0x${string}` }>): Promise<boolean> => {
    setError(null);
    setTxHash(null);
    try {
      const { hash } = await fn();
      setTxHash(hash);
      refetch();
      refetchAllowance();
      refetchBalance();
      return true;
    } catch (e) {
      setError(getRevertReason(e));
      return false;
    }
  };

  const openRepay = (deal: Deal) => {
    setRepayDeal(deal);
    setTotalRepayment(usdcToNumber(deal.totalFunded) + projectedYield(deal));
    setError(null);
    setTxHash(null);
  };

  const confirmRepay = async () => {
    if (!repayDeal) return;
    const baseUnits = BigInt(Math.round(totalRepayment * 1e6));
    const ok = await handle(() => repay(repayDeal.id, baseUnits, repayDeal.totalFunded, allowance));
    if (ok) setRepayDeal(null);
  };

  const renderActions = (deal: Deal) => {
    switch (deal.status) {
      case 0:
        return (
          <Button size="sm" disabled={approving} onClick={() => handle(() => approve(deal.id))}>
            {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve'}
          </Button>
        );
      case 1:
        return (
          <Button size="sm" disabled={minting} onClick={() => handle(() => markMintable(deal.id))}>
            {minting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark Mintable'}
          </Button>
        );
      case 2:
      case 3:
        return (
          <div className="flex flex-wrap gap-2 justify-end">
            <Button size="sm" onClick={() => openRepay(deal)}>
              Repay and Mature
            </Button>
            <Button size="sm" variant="secondary" disabled={maturing} onClick={() => handle(() => markMatured(deal.id))}>
              {maturing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mature (no yield)'}
            </Button>
            {deal.status === 3 && (
              <Button size="sm" variant="secondary" disabled={defaulting} onClick={() => handle(() => defaultDeal(deal.id))}>
                {defaulting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Default'}
              </Button>
            )}
          </div>
        );
      default:
        return <span className="text-xs text-tawf-muted">No owner action</span>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Protocol Operations</h1>
          <p className="text-tawf-muted">Drive the on-chain deal lifecycle as the contract owner</p>
        </div>
        <div className="flex items-center gap-3">
          <GetTestUsdc />
          <ConnectButton variant="primary" size="md" />
        </div>
      </div>

      {!isConfigured && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <p className="text-sm text-amber-700">
            Contracts not configured. Add your Arbitrum Sepolia addresses to <code className="font-mono">.env</code>.
          </p>
        </div>
      )}

      {!isConnected ? (
        <Card className="p-10 text-center">
          <Wallet className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <h3 className="font-serif text-xl text-tawf-green mb-2">Connect the owner wallet</h3>
          <p className="text-tawf-muted mb-4">The deployer wallet drives repay and maturity here.</p>
          <ConnectButton variant="primary" size="md" />
        </Card>
      ) : !isOwner ? (
        <Card className="p-10 text-center">
          <ShieldCheck className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <h3 className="font-serif text-xl text-tawf-green mb-2">Not the protocol owner</h3>
          <p className="text-tawf-muted mb-2">Connected wallet is not the contract owner.</p>
          {owner && <p className="font-mono text-xs text-tawf-muted break-all">Owner: {owner}</p>}
        </Card>
      ) : (
        <>
          <div className="bg-tawf-green text-tawf-sand rounded-2xl p-5 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">Owner wallet connected</p>
              <p className="font-mono text-xs opacity-80 break-all">{address}</p>
            </div>
          </div>

          {txHash && (
            <div className="bg-green-50 rounded-2xl border border-green-200 p-5 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-green-700 mb-1">Transaction confirmed</p>
                <a
                  href={explorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-tawf-green break-all hover:underline inline-flex items-center gap-1"
                >
                  {txHash.slice(0, 18)}…{txHash.slice(-8)} <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-4 h-4 text-tawf-gold" />
              <p className="font-medium text-tawf-green">Deal lifecycle</p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-tawf-muted">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading deals…
              </div>
            ) : deals.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-tawf-muted">No deals seeded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deals.map((deal) => (
                  <div
                    key={deal.id.toString()}
                    className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 rounded-xl border border-tawf-green-10 bg-white"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-tawf-green truncate">
                          #{deal.id.toString()} {deal.supplierName}
                        </p>
                        <Badge variant={STATUS_VARIANT[deal.status]} size="sm">
                          {DEAL_STATUS_LABEL[deal.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-tawf-muted">
                        {deal.anchorBuyer} · {deal.investorCount.toString()} investors · {formatUsdc(deal.totalFunded)} of{' '}
                        {formatUsdc(deal.fundingTarget)} funded
                      </p>
                    </div>
                    <div className="shrink-0">{renderActions(deal)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {repayDeal && (
        <Modal isOpen onClose={() => setRepayDeal(null)} title="Repay and mature deal" size="md">
          <div className="space-y-6">
            <div className="p-4 bg-tawf-sand-30 rounded-xl">
              <p className="text-sm text-tawf-muted mb-1">{repayDeal.supplierName}</p>
              <p className="font-medium text-tawf-green">
                Principal {formatUsdc(repayDeal.totalFunded)} from {repayDeal.investorCount.toString()} investors
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">
                Total repayment (principal plus yield)
              </label>
              <input
                type="number"
                value={totalRepayment}
                min={usdcToNumber(repayDeal.totalFunded)}
                onChange={(e) => setTotalRepayment(Number(e.target.value))}
                className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
              />
              <div className="flex justify-between text-xs text-tawf-muted mt-2">
                <span>Yield portion: {formatUsdc(totalRepayment - usdcToNumber(repayDeal.totalFunded))}</span>
                <span>Owner balance: {formatUsdc(balance)}</span>
              </div>
            </div>

            <p className="text-xs text-tawf-muted">
              The yield portion is pulled from the connected owner wallet. USDC approval is handled automatically.
            </p>

            <Button
              size="lg"
              className="w-full"
              disabled={repaying || totalRepayment * 1e6 < Number(repayDeal.totalFunded)}
              onClick={confirmRepay}
            >
              {repaying ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Confirming…
                </>
              ) : (
                'Repay and Mature'
              )}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
