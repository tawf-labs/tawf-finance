import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Loader2, ExternalLink, ShieldCheck, Wallet, Clock, PiggyBank, Lock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { KycStatusCard } from '@/components/kyc/KycStatusCard';
import {
  useTawfSeries,
  useIsVerified,
  useSeriesSubscribe,
  useSeriesCancel,
  useSeriesClaim,
  useSeriesRedeem,
  useSeriesAllowance,
  SANDBOX_MODE_LABEL,
} from '@/web3/tokenizationHooks';
import { formatIdr, formatUsdc, formatBps, getRevertReason } from '@/web3/format';
import { isTokenizationConfigured, TAWF_SERIES } from '@/web3/tokenization';
import { explorerTxUrl } from '@/web3/constants';

// The Model B disclosures the investor must acknowledge before subscribing.
const DISCLOSURES = [
  'The token is a claim ON TAWF, backed by Tawf\u2019s own deposit at the BPRS (BPRS Demo Syariah). It is not a direct deposit account in your name.',
  'LPS (deposit insurance) covers Tawf\u2019s deposit at the bank, not each investor individually.',
  'Returns follow the bank\u2019s profit share (nisbah) and are not guaranteed. A period may pay zero.',
  'You subscribe in USDC; Tawf converts to IDR off chain. The USDC/IDR rate carries FX risk.',
];

function NotConfigured() {
  return (
    <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
      <p className="font-medium text-amber-800 mb-1">Tokenization not configured</p>
      <p className="text-sm text-amber-700">
        Deploy the tokenization suite with{' '}
        <code className="font-mono">forge script script/DeployTokenization.s.sol</code> so the Tawf
        deposito series loads on Arbitrum Sepolia.
      </p>
    </div>
  );
}

function usdcApprox(senBaseUnits: bigint, idrPerUsdc: bigint): bigint {
  // sen -> USDC base units (6dp): sen * 1e6 / idrPerUsdc. Returns 0 if no rate.
  if (idrPerUsdc === 0n) return 0n;
  return (senBaseUnits * 1_000_000n) / idrPerUsdc;
}

export function InvestorDeposito() {
  const { address, isConnected } = useAccount();
  const { state, isLoading, refetch, configured } = useTawfSeries(address);
  const { isVerified } = useIsVerified(address);
  const { allowance, refetch: refetchAllowance } = useSeriesAllowance(address);
  const { subscribe, isPending: subscribing } = useSeriesSubscribe();
  const { cancel, isPending: cancelling } = useSeriesCancel();
  const { claim, isPending: claiming } = useSeriesClaim();
  const { redeem, isPending: redeeming } = useSeriesRedeem();

  const [subOpen, setSubOpen] = useState(false);
  const [usdcAmount, setUsdcAmount] = useState(100);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const reset = () => {
    setError(null);
    setTxHash(null);
  };

  const modeLabel = SANDBOX_MODE_LABEL[state.mode] ?? 'UNKNOWN';
  const rateIdr = state.idrPerUsdc > 0n ? Number(state.idrPerUsdc) / 100 : 0;

  const holdingsUsdc = useMemo(
    () => usdcApprox(state.balance, state.idrPerUsdc),
    [state.balance, state.idrPerUsdc],
  );

  const runSubscribe = async () => {
    reset();
    if (!acknowledged) {
      setError('Please acknowledge the disclosures first.');
      return;
    }
    const amount = BigInt(Math.round(usdcAmount * 1e6));
    if (amount <= 0n) {
      setError('Enter a USDC amount greater than zero.');
      return;
    }
    try {
      const { hash } = await subscribe(amount, allowance);
      setTxHash(hash);
      refetch();
      refetchAllowance();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  const runCancel = async () => {
    reset();
    try {
      const { hash } = await cancel();
      setTxHash(hash);
      refetch();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  const runClaim = async () => {
    reset();
    try {
      const { hash } = await claim();
      setTxHash(hash);
      refetch();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  const runRedeem = async () => {
    reset();
    try {
      const { hash } = await redeem();
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
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Tawf Deposito Series</h1>
          <p className="text-tawf-muted">
            A wrapped Tawf deposit (Model B). 1 token = IDR 1 claim on Tawf, backed by Tawf&apos;s dedicated
            account at the BPRS.
          </p>
        </div>
        <ConnectButton variant="primary" size="md" />
      </div>

      <KycStatusCard key={address} compact />

      {!isTokenizationConfigured && <NotConfigured />}

      {txHash && (
        <div className="bg-green-50 rounded-2xl border border-green-200 p-5 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-tawf-green break-all hover:underline inline-flex items-center gap-1"
          >
            {txHash.slice(0, 18)}…{txHash.slice(-8)} <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-tawf-muted">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading series…
        </div>
      ) : !isConnected ? (
        <Card className="p-10 text-center">
          <Wallet className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <h3 className="font-serif text-xl text-tawf-green mb-2">Connect your wallet</h3>
          <p className="text-tawf-muted mb-4">Connect an EVM wallet on Arbitrum Sepolia to view the series</p>
          <ConnectButton variant="primary" size="md" />
        </Card>
      ) : !configured ? (
        <Card className="p-10 text-center">
          <ShieldCheck className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <p className="text-tawf-muted">The series appears once the suite is deployed and the series registered.</p>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Series card */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-start justify-between mb-3">
              <Badge variant="info" size="sm">{TAWF_SERIES.symbol}</Badge>
              <div className="flex gap-2">
                <Badge variant={state.mode === 0 ? 'warning' : 'success'} size="sm">
                  <Lock className="w-3 h-3" /> {modeLabel}
                </Badge>
                {state.fullyBacked ? (
                  <Badge variant="success" size="sm"><ShieldCheck className="w-3 h-3" /> Fully backed</Badge>
                ) : (
                  <Badge variant="warning" size="sm">Reserve lagging</Badge>
                )}
              </div>
            </div>
            <h3 className="font-serif text-xl text-tawf-green mb-1">{TAWF_SERIES.name}</h3>
            <p className="text-tawf-muted text-sm leading-relaxed mb-4">
              BPRS Demo Syariah · dedicated account TAWF-S1. Subscribe in USDC; Tawf converts to IDR and places
              the funds in the account.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Metric icon={<Clock className="w-4 h-4 text-tawf-gold" />} label="Tenor" value={`${state.tenorMonths} months`} />
              <Metric icon={<PiggyBank className="w-4 h-4 text-tawf-gold" />} label="Investor nisbah" value={formatBps(state.nisbahBps)} />
              <Metric
                icon={<Wallet className="w-4 h-4 text-tawf-gold" />}
                label="USDC/IDR rate"
                value={rateIdr > 0 ? `Rp ${rateIdr.toLocaleString('id-ID')}` : 'not posted'}
              />
              <Metric
                icon={<ShieldCheck className="w-4 h-4 text-tawf-gold" />}
                label="Investors"
                value={`${state.investorCount} / ${state.maxInvestors}`}
              />
            </div>

            <ProgressBar
              value={Number(state.supply)}
              max={Number(state.reserve) || Number(state.supply) || 1}
              size="sm"
              color="green"
              showLabel
              label="Supply vs anchored account balance"
            />
            <div className="flex justify-between mt-1 mb-4">
              <span className="text-xs text-tawf-muted">{formatIdr(state.supply)} tokenized</span>
              <span className="text-xs text-tawf-muted">{formatIdr(state.reserve)} at BPRS (anchored)</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-tawf-muted">
              <div>Cap / investor: <span className="text-tawf-green">{formatIdr(state.maxBalancePerInvestor)}</span></div>
              <div>Series cap: <span className="text-tawf-green">{formatIdr(state.seriesCap)}</span></div>
            </div>
          </Card>

          {/* Actions + holdings */}
          <Card className="p-6 flex flex-col">
            <p className="font-medium text-tawf-green mb-3">Your position</p>
            <div className="p-3 rounded-xl bg-tawf-sand-30 space-y-2 mb-4">
              <Row label="Holdings" value={`${formatIdr(state.balance)} (~${formatUsdc(holdingsUsdc)})`} />
              <Row label="Pending (escrowed)" value={formatUsdc(state.pending)} />
              <Row label="Claimable profit" value={formatUsdc(state.claimable)} gold />
            </div>

            {isConnected && !state.eligible && (
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 mb-4">
                <p className="text-xs text-blue-700">
                  Your wallet is not eligible under the current mode ({modeLabel}). In PILOT ONLY only Tawf may
                  hold; in SCREENED GROUP / OJK SANDBOX you need a Tawf screening claim.
                </p>
              </div>
            )}

            <div className="mt-auto space-y-2">
              <Button
                size="sm"
                className="w-full"
                disabled={!isVerified || !state.eligible}
                onClick={() => { setSubOpen(true); setAcknowledged(false); reset(); }}
              >
                Subscribe (USDC)
              </Button>
              <Button size="sm" variant="secondary" className="w-full" disabled={state.pending === 0n || cancelling} onClick={runCancel}>
                {cancelling ? 'Cancelling…' : 'Cancel pending'}
              </Button>
              <Button size="sm" variant="ghost" className="w-full" disabled={state.claimable === 0n || claiming} onClick={runClaim}>
                {claiming ? 'Claiming…' : 'Claim profit'}
              </Button>
              <Button size="sm" variant="ghost" className="w-full" disabled={state.balance === 0n || !state.redemptionOpen || redeeming} onClick={runRedeem}>
                {state.redemptionOpen ? (redeeming ? 'Redeeming…' : 'Redeem (matured)') : 'Redeem at maturity'}
              </Button>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Subscribe modal with disclosures */}
      {subOpen && (
        <Modal isOpen onClose={() => setSubOpen(false)} title="Subscribe to the Tawf Deposito Series" size="md">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Amount (USDC)</label>
              <input
                type="number"
                min={1}
                value={usdcAmount}
                onChange={(e) => setUsdcAmount(Number(e.target.value))}
                className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
              />
              {rateIdr > 0 && (
                <p className="text-xs text-tawf-muted mt-1">
                  ≈ {formatIdr(BigInt(Math.round(usdcAmount * rateIdr * 100)))} at the posted rate
                </p>
              )}
            </div>

            <div className="rounded-xl border border-tawf-green-10 p-4 bg-tawf-sand-30">
              <p className="text-sm font-medium text-tawf-green mb-2">Please read and acknowledge</p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-tawf-muted">
                {DISCLOSURES.map((d) => <li key={d}>{d}</li>)}
              </ul>
              <label className="flex items-start gap-2 mt-3 text-sm text-tawf-ink">
                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-1" />
                <span>I understand this is a claim on Tawf with FX risk and non-guaranteed returns.</span>
              </label>
            </div>

            {error && <div className="bg-red-50 rounded-xl p-3 border border-red-200"><p className="text-sm text-red-600">{error}</p></div>}

            <Button size="lg" className="w-full" disabled={!acknowledged || subscribing} onClick={runSubscribe}>
              {subscribing ? <><Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" /> Confirming…</> : 'Approve + Subscribe'}
            </Button>
            <p className="text-xs text-tawf-muted">
              Your USDC is escrowed until Tawf allocates against the anchored account balance. You can cancel before allocation.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-tawf-muted">{label}</p>
        <p className="font-medium text-tawf-green">{value}</p>
      </div>
    </div>
  );
}

function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-tawf-muted">{label}</span>
      <span className={gold ? 'font-medium text-tawf-gold' : 'font-medium text-tawf-green'}>{value}</span>
    </div>
  );
}
