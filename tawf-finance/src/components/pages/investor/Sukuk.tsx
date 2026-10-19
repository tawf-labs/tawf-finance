import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, ExternalLink, ShieldCheck, Wallet, Clock, Target, Layers } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { KycStatusCard } from '@/components/kyc/KycStatusCard';
import {
  useSukuk,
  useIsVerified,
  useSukukSubscribe,
  useSukukClaim,
  useSukukRedeem,
  useSukukRefund,
  useSukukAllowance,
} from '@/web3/tokenizationHooks';
import { SUKUK_STATUS_LABEL } from '@/web3/tokenizationAbis';
import { formatUsdc, usdcToNumber, getRevertReason } from '@/web3/format';
import { isTokenizationConfigured, SUKUK_SYMBOL, TOKENIZATION_USDC_ADDRESS } from '@/web3/tokenization';
import { explorerTxUrl } from '@/web3/constants';

const STATUS_VARIANT: Record<number, 'info' | 'success' | 'warning' | 'error' | 'default'> = {
  0: 'default',
  1: 'info',
  2: 'success',
  3: 'default',
  4: 'error',
  5: 'warning',
};

export function InvestorSukuk() {
  const { address, isConnected } = useAccount();
  const { state, isLoading, refetch } = useSukuk(address);
  const { isVerified } = useIsVerified(address);
  const { allowance, refetch: refetchAllowance } = useSukukAllowance(address, TOKENIZATION_USDC_ADDRESS);
  const { subscribe, isPending: subscribing } = useSukukSubscribe();
  const { claim, isPending: claiming } = useSukukClaim();
  const { redeem, isPending: redeeming } = useSukukRedeem();
  const { refund, isPending: refunding } = useSukukRefund();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const reset = () => { setError(null); setTxHash(null); };

  const isSubscription = state.status === 1;
  const isActive = state.status === 2;
  const isSettled = state.status === 3 || state.status === 4;
  const isCancelled = state.status === 5;
  const minSub = usdcToNumber(state.minSubscription);

  const runSubscribe = async () => {
    if (!TOKENIZATION_USDC_ADDRESS) return;
    reset();
    try {
      const baseUnits = BigInt(Math.round(amount * 1e6));
      const { hash } = await subscribe(TOKENIZATION_USDC_ADDRESS, baseUnits, allowance);
      setTxHash(hash);
      refetch();
      refetchAllowance();
    } catch (e) {
      const reason = getRevertReason(e);
      setError(/not eligible|not verified/i.test(reason) ? 'Your wallet is not a verified identity. Verify in Settings first.' : reason);
    }
  };

  const runAction = async (fn: () => Promise<{ hash: `0x${string}` }>) => {
    reset();
    try {
      const { hash } = await fn();
      setTxHash(hash);
      refetch();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Sukuk</h1>
          <p className="text-tawf-muted">Subscribe to the {SUKUK_SYMBOL} series with USDC. Returns from serviced financing.</p>
        </div>
        <ConnectButton variant="primary" size="md" />
      </div>

      <KycStatusCard key={address} compact />

      {!isTokenizationConfigured && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <p className="font-medium text-amber-800 mb-1">Tokenization not configured</p>
          <p className="text-sm text-amber-700">Deploy and seed the suite to load the sukuk series.</p>
        </div>
      )}

      {txHash && (
        <div className="bg-green-50 rounded-2xl border border-green-200 p-5 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
          <a href={explorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-tawf-green break-all hover:underline inline-flex items-center gap-1">
            {txHash.slice(0, 18)}…{txHash.slice(-8)} <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-tawf-muted">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading sukuk…
        </div>
      ) : !isConnected ? (
        <Card className="p-10 text-center">
          <Wallet className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <h3 className="font-serif text-xl text-tawf-green mb-2">Connect your wallet</h3>
          <p className="text-tawf-muted mb-4">Connect an EVM wallet on Arbitrum Sepolia to view the sukuk series</p>
          <ConnectButton variant="primary" size="md" />
        </Card>
      ) : (
        <>
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <Badge variant="info" size="sm" className="mb-2">{SUKUK_SYMBOL}</Badge>
                <h3 className="font-serif text-2xl text-tawf-green">BPRS Demo Sukuk 2026</h3>
              </div>
              <Badge variant={STATUS_VARIANT[state.status]} size="md">{SUKUK_STATUS_LABEL[state.status]}</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-tawf-gold shrink-0" />
                <div>
                  <p className="text-xs text-tawf-muted">Face value</p>
                  <p className="font-medium text-tawf-green">{formatUsdc(state.faceValue)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-tawf-gold shrink-0" />
                <div>
                  <p className="text-xs text-tawf-muted">Maturity</p>
                  <p className="font-medium text-tawf-green">
                    {state.maturity > 0n
                      ? new Date(Number(state.maturity) * 1000).toLocaleString('en-SG', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })
                      : 'N/A'}
                  </p>
                  <p className="text-[11px] text-tawf-muted">~1 hour after the series is created in this demo</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-tawf-gold shrink-0" />
                <div>
                  <p className="text-xs text-tawf-muted">Min subscription</p>
                  <p className="font-medium text-tawf-green">{formatUsdc(state.minSubscription)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {state.fullyBacked ? <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" /> : <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />}
                <div>
                  <p className="text-xs text-tawf-muted">Backing</p>
                  <p className="font-medium text-tawf-green">{state.fullyBacked ? 'Fully backed' : 'Lagging'}</p>
                </div>
              </div>
            </div>

            <ProgressBar value={Number(state.supply)} max={Number(state.reserve) || Number(state.faceValue) || 1} size="md" color="green" showLabel label="Supply vs anchored reserve" />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-tawf-muted">{formatUsdc(state.supply)} subscribed</span>
              <span className="text-xs text-tawf-muted">{formatUsdc(state.reserve)} reserve</span>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-tawf-sand-30 flex flex-wrap items-center gap-4 justify-between">
              <div>
                <p className="text-sm text-tawf-muted">Your holding</p>
                <p className="font-medium text-tawf-green">{formatUsdc(state.balance)}</p>
              </div>
              <div>
                <p className="text-sm text-tawf-muted">Claimable profit</p>
                <p className="font-medium text-tawf-gold">{formatUsdc(state.claimable)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isSubscription && (
                  <Button size="md" disabled={!isVerified} onClick={() => { setAmount(Math.max(minSub, 10)); reset(); setOpen(true); }}>
                    Subscribe
                  </Button>
                )}
                {isActive && (
                  <Button size="md" disabled={state.claimable === 0n || claiming} onClick={() => runAction(claim)}>
                    {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Claim profit'}
                  </Button>
                )}
                {isSettled && (
                  <Button size="md" disabled={state.balance === 0n || redeeming} onClick={() => runAction(redeem)}>
                    {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redeem'}
                  </Button>
                )}
                {isCancelled && (
                  <Button size="md" variant="secondary" disabled={state.balance === 0n || refunding} onClick={() => runAction(refund)}>
                    {refunding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Claim refund'}
                  </Button>
                )}
              </div>
            </div>

            {isConnected && !isVerified && (
              <p className="text-xs text-amber-700 mt-3">Verify your identity in Settings to subscribe. Sukuk tokens move only between verified wallets.</p>
            )}
            {error && <div className="bg-red-50 rounded-xl p-4 border border-red-200 mt-4"><p className="text-sm text-red-600">{error}</p></div>}
          </Card>
        </>
      )}

      {/* Subscribe modal */}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Subscribe to sukuk" size="md">
        <div className="space-y-6">
          <div className="p-4 bg-tawf-sand-30 rounded-xl">
            <p className="text-sm text-tawf-muted mb-1">{SUKUK_SYMBOL}</p>
            <p className="font-medium text-tawf-green">Min {formatUsdc(state.minSubscription)} · 1 USDC = 1 token</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Amount (USDC)</label>
            <input
              type="number"
              value={amount}
              min={minSub}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <p className="text-xs text-tawf-muted">USDC approval is handled automatically if needed, then the subscription mints your sukuk tokens.</p>
          {error && <div className="bg-red-50 rounded-xl p-4 border border-red-200"><p className="text-sm text-red-600">{error}</p></div>}
          <Button size="lg" className="w-full" disabled={subscribing || amount < minSub} onClick={runSubscribe}>
            {subscribing ? <><Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" /> Confirming…</> : `Subscribe ${formatUsdc(amount)}`}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
