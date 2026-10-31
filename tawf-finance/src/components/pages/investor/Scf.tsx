import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { Loader2, ExternalLink, ShieldCheck, Wallet, Clock, Target, Layers, Store, Scale, Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { TestKycButton } from '@/components/web3/TestKycButton';
import { GetTestToken } from '@/components/web3/GetTestUsdc';
import {
  useSukuk,
  useIsVerified,
  useSukukSubscribe,
  useSukukClaim,
  useSukukRedeem,
  useSukukRefund,
  useSukukAllowance,
  useSukukCoins,
  useScfLimit,
} from '@/web3/tokenizationHooks';
import { SUKUK_STATUS_LABEL } from '@/web3/tokenizationAbis';
import type { SukukCoinView } from '@/web3/tokenizationHooks';
import { formatUsdc, usdcToNumber, getRevertReason } from '@/web3/format';
import {
  isScfConfigured,
  SCF_SYMBOL,
  SCF_DISTRIBUTOR_ADDRESS,
  SCF_TOKEN_ADDRESS,
} from '@/web3/tokenization';
import { explorerTxUrl, INVEST_TOKENS } from '@/web3/constants';
import { SCF_PLATFORM, SCF_OFFERING } from '@/data/issuers';
import {
  SCF_EXEMPTION_LABEL,
  SCF_EXEMPTION_BY_CODE,
  scfLimitPercent,
  scfDeclarationMessage,
  submitScfProfile,
  type ScfExemption,
} from '@/lib/scf';

const STATUS_VARIANT: Record<number, 'info' | 'success' | 'warning' | 'error' | 'default'> = {
  0: 'default',
  1: 'info',
  2: 'success',
  3: 'default',
  4: 'error',
  5: 'warning',
};

const MAX_UINT = (1n << 256n) - 1n;
const target = { distributor: SCF_DISTRIBUTOR_ADDRESS, token: SCF_TOKEN_ADDRESS };

export function InvestorScf() {
  const { address, isConnected } = useAccount();
  const { state, isLoading, refetch } = useSukuk(address, target);
  const { state: limit, refetch: refetchLimit } = useScfLimit(address);
  const { isVerified } = useIsVerified(address);
  const { coins, refetch: refetchCoins } = useSukukCoins(address, target);
  const [investCoin, setInvestCoin] = useState<`0x${string}` | null>(null);
  const [payCoin, setPayCoin] = useState<`0x${string}` | null>(null);
  // Invest in the first coin that is not paused and that the wallet holds, until the investor picks one.
  const selectedInvest =
    coins.find((c) => c.address === investCoin) ?? coins.find((c) => !c.paused && c.walletBalance > 0n) ?? coins.find((c) => !c.paused) ?? coins[0];
  const selectedPay = coins.find((c) => c.address === payCoin) ?? coins.find((c) => !c.paused && c.freeBalance > 0n) ?? coins.find((c) => !c.paused) ?? coins[0];
  const { allowance, refetch: refetchAllowance } = useSukukAllowance(address, selectedInvest?.address, target);
  const { subscribe, isPending: subscribing } = useSukukSubscribe(target);
  const { claim, isPending: claiming } = useSukukClaim(target);
  const { redeem, isPending: redeeming } = useSukukRedeem(target);
  const { refund, isPending: refunding } = useSukukRefund(target);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const reset = () => { setError(null); setTxHash(null); };

  const exempt = limit.exemption !== 0;
  const hasProfile = exempt || limit.limit > 0n;
  const room = state.faceValue > state.supply ? state.faceValue - state.supply : 0n;
  const maxBase = exempt || limit.remaining === MAX_UINT ? room : limit.remaining < room ? limit.remaining : room;
  const maxInvest = usdcToNumber(maxBase);
  const overMax = Number.isFinite(amount) && BigInt(Math.round(amount * 1e6)) > maxBase;
  const minSub = usdcToNumber(state.minSubscription);

  const isSubscription = state.status === 1;
  const isActive = state.status === 2;
  const isSettled = state.status === 3 || state.status === 4;
  const isCancelled = state.status === 5;

  const runSubscribe = async () => {
    if (!selectedInvest) return;
    reset();
    const baseUnits = BigInt(Math.round(amount * 1e6));
    if (selectedInvest.walletBalance < baseUnits) {
      setError(`You hold ${formatUsdc(selectedInvest.walletBalance)} ${selectedInvest.symbol}. Pick another coin or get test funds first.`);
      return;
    }
    if (baseUnits > maxBase) {
      setError(`That is above what you can invest now (${formatUsdc(maxBase)}). Your POJK 57/2020 yearly limit and the offering size both apply.`);
      return;
    }
    try {
      const { hash } = await subscribe(selectedInvest.address, baseUnits, allowance);
      setTxHash(hash);
      setOpen(false);
      refetch();
      refetchLimit();
      refetchAllowance();
      refetchCoins();
    } catch (e) {
      const reason = getRevertReason(e);
      setError(/compliance/i.test(reason) ? 'The token rejected this amount: it exceeds your yearly SCF limit or the offering cap.' : reason);
    }
  };

  const runAction = async (fn: () => Promise<{ hash: `0x${string}` }>) => {
    reset();
    try {
      const { hash } = await fn();
      setTxHash(hash);
      refetch();
      refetchCoins();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Urun Dana (SCF)</h1>
          <p className="text-tawf-muted">
            Sharia crowdfunding for Indonesian SMEs, tokenized by Tawf. The token enforces your investor limit.
          </p>
        </div>
        <ConnectButton variant="primary" size="md" />
      </div>

      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex gap-3">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Testnet demo. {SCF_PLATFORM.name} and {SCF_OFFERING.issuerName} are fictional. Crowdfunding investments are illiquid and carry the risk of
          losing the capital: profit is shared from what the business actually earns, and nothing is guaranteed.
        </p>
      </div>

      {!isScfConfigured && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <p className="font-medium text-amber-800 mb-1">Crowdfunding offering not deployed</p>
          <p className="text-sm text-amber-700">Run contracts/script/DeployScf.s.sol to deploy the demo offering.</p>
        </div>
      )}

      <Card className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-5 h-5 text-tawf-gold" />
              <p className="text-xs uppercase tracking-wide text-tawf-muted">Platform</p>
            </div>
            <h3 className="font-serif text-xl text-tawf-green mb-1">{SCF_PLATFORM.name}</h3>
            <p className="text-sm text-tawf-muted mb-2">{SCF_PLATFORM.description}</p>
            <p className="text-xs text-tawf-muted">{SCF_PLATFORM.license}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-5 h-5 text-tawf-gold" />
              <p className="text-xs uppercase tracking-wide text-tawf-muted">Issuer</p>
            </div>
            <h3 className="font-serif text-xl text-tawf-green mb-1">{SCF_OFFERING.issuerName}</h3>
            <dl className="text-sm space-y-1">
              <div className="flex gap-2"><dt className="text-tawf-muted w-28 shrink-0">Sector</dt><dd className="text-tawf-ink">{SCF_OFFERING.sector}, {SCF_OFFERING.location}</dd></div>
              <div className="flex gap-2"><dt className="text-tawf-muted w-28 shrink-0">Instrument</dt><dd className="text-tawf-ink">{SCF_OFFERING.instrument}</dd></div>
              <div className="flex gap-2"><dt className="text-tawf-muted w-28 shrink-0">Use of funds</dt><dd className="text-tawf-ink">{SCF_OFFERING.useOfProceeds}</dd></div>
              <div className="flex gap-2"><dt className="text-tawf-muted w-28 shrink-0">Profit share</dt><dd className="text-tawf-ink">{SCF_OFFERING.indicativeNisbah} (indicative)</dd></div>
            </dl>
          </div>
        </div>
        <p className="text-xs text-tawf-muted mt-4">Akad: {SCF_OFFERING.akad}.</p>
      </Card>

      {txHash && (
        <div className="bg-green-50 rounded-2xl border border-green-200 p-5 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
          <a href={explorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-tawf-green break-all hover:underline inline-flex items-center gap-1">
            {txHash.slice(0, 18)}…{txHash.slice(-8)} <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>
      )}

      {!isConnected ? (
        <Card className="p-10 text-center">
          <Wallet className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <h3 className="font-serif text-xl text-tawf-green mb-2">Connect your wallet</h3>
          <p className="text-tawf-muted mb-4">Connect an EVM wallet on Arbitrum Sepolia to invest in the offering</p>
          <ConnectButton variant="primary" size="md" />
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20 text-tawf-muted">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading offering…
        </div>
      ) : (
        <>
          <Card className="p-6">
            <p className="text-xs uppercase tracking-wide text-tawf-muted mb-3">Step 1 · Verify and fund</p>
            <div className="flex flex-wrap items-center gap-4">
              <TestKycButton onVerified={() => { refetchLimit(); }} />
              {INVEST_TOKENS.filter((t) => coins.some((c) => c.address.toLowerCase() === t.address.toLowerCase())).map((t) => (
                <GetTestToken key={t.symbol} token={t} compact />
              ))}
            </div>
          </Card>

          <SuitabilityCard
            disabled={!isVerified}
            limit={limit}
            hasProfile={hasProfile}
            onSaved={() => { refetchLimit(); }}
          />

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <Badge variant="info" size="sm" className="mb-2">{SCF_SYMBOL}</Badge>
                <h3 className="font-serif text-2xl text-tawf-green">{SCF_OFFERING.instrument} · {SCF_OFFERING.issuerName}</h3>
              </div>
              <Badge variant={STATUS_VARIANT[state.status]} size="md">{SUKUK_STATUS_LABEL[state.status]}</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Fact icon={<Target className="w-4 h-4 text-tawf-gold shrink-0" />} label="Offering size" value={formatUsdc(state.faceValue)} />
              <Fact
                icon={<Clock className="w-4 h-4 text-tawf-gold shrink-0" />}
                label="Subscription closes"
                value={state.subscriptionDeadline > 0n ? new Date(Number(state.subscriptionDeadline) * 1000).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
              />
              <Fact
                icon={<Clock className="w-4 h-4 text-tawf-gold shrink-0" />}
                label="Maturity"
                value={state.maturity > 0n ? new Date(Number(state.maturity) * 1000).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
              />
              <Fact icon={<Layers className="w-4 h-4 text-tawf-gold shrink-0" />} label="Min subscription" value={formatUsdc(state.minSubscription)} />
            </div>

            <ProgressBar value={Number(state.supply)} max={Number(state.faceValue) || 1} size="md" color="green" showLabel label="Raised" />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-tawf-muted">{formatUsdc(state.supply)} raised</span>
              <span className="text-xs text-tawf-muted">SME cap under POJK 57/2020: Rp{(SCF_OFFERING.issuerCapIdr / 1e9).toFixed(0)} billion</span>
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
                  <Button
                    size="md"
                    disabled={!isVerified || !hasProfile || maxInvest < minSub}
                    onClick={() => { setAmount(Math.max(minSub, Math.min(100, Math.floor(maxInvest)))); reset(); setOpen(true); }}
                  >
                    Invest
                  </Button>
                )}
                {(isActive || isSettled) && coins.length > 0 && (
                  <PayoutCoin coins={coins} selected={selectedPay} amount={isActive ? state.claimable : state.balance} onPick={setPayCoin} />
                )}
                {isActive && (
                  <Button size="md" disabled={state.claimable === 0n || claiming || !selectedPay} onClick={() => selectedPay && runAction(() => claim(selectedPay.address))}>
                    {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Claim profit'}
                  </Button>
                )}
                {isSettled && (
                  <Button size="md" disabled={state.balance === 0n || redeeming || !selectedPay} onClick={() => selectedPay && runAction(() => redeem(selectedPay.address))}>
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

            {isSubscription && isVerified && !hasProfile && (
              <p className="text-xs text-amber-700 mt-3">Complete the suitability step above first. Until then your limit is zero and the token rejects any purchase.</p>
            )}
            {isSubscription && hasProfile && maxInvest < minSub && (
              <p className="text-xs text-amber-700 mt-3">You have used your yearly SCF limit, or the offering is fully subscribed.</p>
            )}
            {error && <div className="bg-red-50 rounded-xl p-4 border border-red-200 mt-4"><p className="text-sm text-red-600">{error}</p></div>}
          </Card>
        </>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Invest in the offering" size="md">
        <div className="space-y-6">
          <div className="p-4 bg-tawf-sand-30 rounded-xl">
            <p className="text-sm text-tawf-muted mb-1">{SCF_SYMBOL}</p>
            <p className="font-medium text-tawf-green">Min {formatUsdc(state.minSubscription)} · max {formatUsdc(maxBase)} for you now · 1 {selectedInvest?.symbol ?? 'USD'} = 1 token</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Pay with</label>
            <div className="grid grid-cols-3 gap-2">
              {coins.map((c) => {
                const short = c.walletBalance < BigInt(Math.round(Math.max(amount, 0) * 1e6));
                const off = c.paused;
                return (
                  <button
                    key={c.address}
                    type="button"
                    disabled={off}
                    onClick={() => setInvestCoin(c.address)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${selectedInvest?.address === c.address ? 'border-tawf-green bg-tawf-green-10' : 'border-tawf-green-10 bg-white hover:border-tawf-green-20'}`}
                  >
                    <span className="block font-medium text-tawf-green">{c.symbol}</span>
                    <span className="block text-xs text-tawf-muted">{off ? 'Paused, not accepted now' : `You hold ${formatUsdc(c.walletBalance)}`}</span>
                    {!off && short && <span className="block text-xs text-amber-700">Not enough for this amount</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Amount ({selectedInvest?.symbol ?? 'USD'})</label>
            <input
              type="number"
              value={amount}
              min={minSub}
              max={maxInvest}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <p className="text-xs text-tawf-muted">
            {selectedInvest?.symbol ?? 'Coin'} approval is handled automatically if needed. Funds go to the issuer only if the minimum raise is met when the subscription closes, otherwise you can claim a full refund.
          </p>
          {!overMax && amount < minSub && <p className="text-sm text-red-600">Minimum is {formatUsdc(state.minSubscription)}.</p>}
          {overMax && <p className="text-sm text-red-600">That is above what you can invest now ({formatUsdc(maxBase)}).</p>}
          {error && <div className="bg-red-50 rounded-xl p-4 border border-red-200"><p className="text-sm text-red-600">{error}</p></div>}
          <Button size="lg" className="w-full" disabled={subscribing || amount < minSub || overMax} onClick={runSubscribe}>
            {subscribing ? <><Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" /> Confirming…</> : `Invest ${formatUsdc(Math.max(amount, 0))}`}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** Choose the coin to be paid in. The offering pays that coin first and the rest in the others if it runs short. */
function PayoutCoin({ coins, selected, amount, onPick }: {
  coins: SukukCoinView[];
  selected: SukukCoinView | undefined;
  amount: bigint;
  onPick: (a: `0x${string}`) => void;
}) {
  const short = selected ? selected.freeBalance < amount : false;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-tawf-muted" htmlFor="scf-pay-coin">Get paid in</label>
      <select
        id="scf-pay-coin"
        value={selected?.address}
        onChange={(e) => onPick(e.target.value as `0x${string}`)}
        className="rounded-xl border border-tawf-green-10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tawf-gold"
      >
        {coins.map((c) => (
          <option key={c.address} value={c.address} disabled={c.paused}>
            {c.symbol} ({formatUsdc(c.freeBalance)} available){c.paused ? ', paused' : ''}
          </option>
        ))}
      </select>
      {short && selected && (
        <span className="text-xs text-tawf-muted">{selected.symbol} covers part of this. The rest is paid in the other coins.</span>
      )}
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-xs text-tawf-muted">{label}</p>
        <p className="font-medium text-tawf-green">{value}</p>
      </div>
    </div>
  );
}

/**
 * The SCF suitability step: the investor self-declares their annual income
 * (or an exemption) and signs it. The server records the resulting POJK
 * 57/2020 yearly limit on chain.
 */
function SuitabilityCard({ disabled, limit, hasProfile, onSaved }: {
  disabled: boolean;
  limit: { limit: bigint; used: bigint; remaining: bigint; exemption: number };
  hasProfile: boolean;
  onSaved: () => void;
}) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [editing, setEditing] = useState(false);
  const [income, setIncome] = useState('');
  const [exemption, setExemption] = useState<ScfExemption>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incomeIdr = Number(income.replace(/[^0-9]/g, '') || '0');
  const pct = scfLimitPercent(incomeIdr);
  const exempt = limit.exemption !== 0;

  const save = async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const incomeBig = BigInt(Math.max(0, Math.floor(incomeIdr)));
      const signedAt = Math.floor(Date.now() / 1000);
      const signature = await signMessageAsync({ message: scfDeclarationMessage(address, incomeBig, exemption, signedAt) });
      await submitScfProfile({ wallet: address, incomeIdr: incomeBig.toString(), exemption, signedAt, signature });
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(getRevertReason(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <p className="text-xs uppercase tracking-wide text-tawf-muted mb-3">Step 2 · Investor suitability (POJK 57/2020)</p>
      {hasProfile && !editing ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex-1 min-w-[220px]">
            {exempt ? (
              <p className="text-sm text-tawf-ink">
                Exempt from the yearly limit: {SCF_EXEMPTION_LABEL[SCF_EXEMPTION_BY_CODE[limit.exemption] ?? 'none']}.
              </p>
            ) : (
              <>
                <ProgressBar value={Number(limit.used)} max={Number(limit.limit) || 1} size="md" color="green" showLabel label="Yearly SCF limit used" />
                <div className="flex justify-between mt-1 text-xs text-tawf-muted">
                  <span>{formatUsdc(limit.used)} used</span>
                  <span>{formatUsdc(limit.remaining)} left of {formatUsdc(limit.limit)}</span>
                </div>
              </>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Update declaration</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-tawf-muted">
            Under POJK 57/2020 you may invest up to 5% of your annual income a year across all crowdfunding offerings if you earn up to Rp500 million, or
            10% above that. Legal entities and investors with a capital-market account held for two years or more are exempt. Only the resulting limit
            goes on chain, never your income.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Annual income (Rp)</label>
              <input
                inputMode="numeric"
                value={income}
                disabled={exemption !== 'none'}
                onChange={(e) => setIncome(e.target.value)}
                placeholder="100000000"
                className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold disabled:bg-gray-50"
              />
              {exemption === 'none' && incomeIdr > 0 && (
                <p className="text-xs text-tawf-muted mt-1">
                  Limit {pct}% = Rp{Math.floor((incomeIdr * pct) / 100).toLocaleString('id-ID')} a year
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Exemption</label>
              <select
                value={exemption}
                onChange={(e) => setExemption(e.target.value as ScfExemption)}
                className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
              >
                {(Object.keys(SCF_EXEMPTION_LABEL) as ScfExemption[]).map((k) => (
                  <option key={k} value={k}>{SCF_EXEMPTION_LABEL[k]}</option>
                ))}
              </select>
              <p className="text-xs text-tawf-muted mt-1">Self-declared on testnet. A licensed platform verifies this before admitting an exemption.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button size="md" disabled={disabled || busy || (exemption === 'none' && incomeIdr <= 0)} onClick={() => void save()}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign and save declaration'}
            </Button>
            {hasProfile && <Button size="md" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
          {disabled && <p className="text-xs text-amber-700">Verify your identity in step 1 first.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Card>
  );
}
