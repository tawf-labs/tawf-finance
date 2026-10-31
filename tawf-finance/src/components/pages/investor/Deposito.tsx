import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Loader2, ExternalLink, BadgeCheck, ShieldCheck, Wallet, Clock, PiggyBank, Lock, Landmark } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { KycStatusCard } from '@/components/kyc/KycStatusCard';
import { runFaucet } from '@/lib/tokenization';
import {
  useTawfSeries,
  useIsVerified,
  useSeriesSubscribe,
  useSeriesCancel,
  useSeriesClaim,
  useSeriesRedeem,
  useSeriesAllowance,
  usePoolBanks,
  SANDBOX_MODE_LABEL,
  type SeriesCoinView,
} from '@/web3/tokenizationHooks';
import { formatIdr, formatUsdc, formatBps, getRevertReason } from '@/web3/format';
import { isTokenizationConfigured, DEPOSITO_PRODUCTS, type DepositoProduct, type SettlementCoinKey } from '@/web3/tokenization';
import { explorerTxUrl } from '@/web3/constants';
import { NisbahNotice } from '@/components/tokenization/NisbahNotice';

// The disclosures the investor must acknowledge before subscribing.
function disclosuresFor(product: DepositoProduct, bankCount: number): string[] {
  const where =
    product.key === 'pool'
      ? `Tawf\u2019s own deposits at ${bankCount || 'several'} BPRS in ${product.region}`
      : 'Tawf\u2019s own deposit at the BPRS (BPRS Demo Syariah)';
  return [
    `The token is a claim ON TAWF, backed by ${where}. It is not a direct deposit account in your name, and it is not a sukuk, bond or mutual fund unit.`,
    'LPS (deposit insurance) covers Tawf\u2019s deposit at each bank, up to the LPS limit per bank and only at or below the LPS rate cap. It does not cover each investor individually.',
    'Returns follow each bank\u2019s profit share (nisbah) and are not guaranteed. A period may pay zero.',
    'Your holding is valued in IDR; that IDR value is what is backed. You subscribe, claim and redeem in any accepted stablecoin, and the amount you receive in a coin depends on that coin\u2019s posted rate at payout. Each coin carries its own rate and FX risk.',
  ];
}

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

/** sen -> coin base units (6dp) at a coin's rate: sen * 1e6 / idrPerToken. */
function coinApprox(senBaseUnits: bigint, idrPerToken: bigint): bigint {
  if (idrPerToken === 0n) return 0n;
  return (senBaseUnits * 1_000_000n + idrPerToken / 2n) / idrPerToken;
}

export function InvestorDeposito() {
  const { address, isConnected } = useAccount();
  const [productKey, setProductKey] = useState<DepositoProduct['key']>(DEPOSITO_PRODUCTS[0]?.key ?? 'series1');
  const product = DEPOSITO_PRODUCTS.find((p) => p.key === productKey) ?? DEPOSITO_PRODUCTS[0];
  const target = useMemo(
    () => ({ series: product?.series, token: product?.token, sandbox: product?.sandbox, seriesId: product?.seriesId }),
    [product],
  );
  const { state, isLoading, refetch, configured } = useTawfSeries(address, target);
  const { banks } = usePoolBanks(product?.ledger);
  const { isVerified } = useIsVerified(address);
  const [screening, setScreening] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const { subscribe, isPending: subscribing } = useSeriesSubscribe(target);
  const { cancel, isPending: cancelling } = useSeriesCancel(target);
  const { claim, isPending: claiming } = useSeriesClaim(target);
  const { redeem, isPending: redeeming } = useSeriesRedeem(target);
  const isPool = product?.key === 'pool';
  const disclosures = product ? disclosuresFor(product, banks.length) : [];

  const coins = state.coins;
  // "USDC, USDT or USDG": the coins the series accepts right now.
  const symbols = coins.map((c) => c.symbol);
  const coinNames =
    symbols.length > 1 ? `${symbols.slice(0, -1).join(', ')} or ${symbols[symbols.length - 1]}` : (symbols[0] ?? 'USDC or USDT');

  // Selected coin for subscribe / claim / redeem (default: first coin).
  const [coinKey, setCoinKey] = useState<SettlementCoinKey>('usdc');
  const selectedCoin: SeriesCoinView | undefined =
    coins.find((c) => c.key === coinKey) ?? coins[0];

  const { allowance, refetch: refetchAllowance } = useSeriesAllowance(address, selectedCoin?.address, target);

  const [subOpen, setSubOpen] = useState(false);
  const [coinAmount, setCoinAmount] = useState(100);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const reset = () => {
    setError(null);
    setTxHash(null);
  };

  const modeLabel = SANDBOX_MODE_LABEL[state.mode] ?? 'UNKNOWN';
  const selectedRateIdr = selectedCoin && selectedCoin.idrPerToken > 0n ? Number(selectedCoin.idrPerToken) / 100 : 0;

  // Holdings valued back into the selected coin at its current rate.
  const holdingsCoin = useMemo(
    () => coinApprox(state.balance, selectedCoin?.idrPerToken ?? 0n),
    [state.balance, selectedCoin?.idrPerToken],
  );
  const claimableCoin = useMemo(
    () => coinApprox(state.claimableSen, selectedCoin?.idrPerToken ?? 0n),
    [state.claimableSen, selectedCoin?.idrPerToken],
  );

  const runSubscribe = async () => {
    reset();
    if (!selectedCoin) return;
    if (!acknowledged) {
      setError('Please acknowledge the disclosures first.');
      return;
    }
    const amount = BigInt(Math.round(coinAmount * 1e6));
    if (amount <= 0n) {
      setError('Enter an amount greater than zero.');
      return;
    }
    try {
      const { hash } = await subscribe(selectedCoin.address, amount, allowance);
      setTxHash(hash);
      setSubOpen(false);
      refetch();
      refetchAllowance();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  const runCancel = async (coin: SeriesCoinView) => {
    reset();
    try {
      const { hash } = await cancel(coin.address);
      setTxHash(hash);
      refetch();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  const runClaim = async () => {
    reset();
    if (!selectedCoin) return;
    try {
      const { hash } = await claim(selectedCoin.address);
      setTxHash(hash);
      refetch();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  const runRedeem = async () => {
    reset();
    if (!selectedCoin) return;
    try {
      const { hash } = await redeem(selectedCoin.address);
      setTxHash(hash);
      refetch();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  const pendingCoins = coins.filter((c) => c.pending > 0n);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Tawf Deposito Pool</h1>
          <p className="mb-2 text-sm text-amber-800">Legacy testnet demo of the earlier stablecoin model. The live model is rupiah paid into a virtual account in your name.</p>
          <p className="text-tawf-muted">
            Mudharabah deposito at licensed BPRS, wrapped into one token.
            1 token = IDR 1, settled in {coinNames}.
          </p>
        </div>
        <ConnectButton variant="primary" size="md" />
      </div>

      {DEPOSITO_PRODUCTS.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {DEPOSITO_PRODUCTS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => { setProductKey(p.key); reset(); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                productKey === p.key ? 'bg-tawf-green text-white border-tawf-green' : 'bg-white text-tawf-green border-tawf-green-10'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <NisbahNotice
        key={productKey}
        product={isPool ? 'pool' : 'series'}
        extra={isPool ? 'Your money is placed across the BPRS in the pool on your instruction (two-tier mudharabah).' : 'Your money is placed at the BPRS on your instruction (two-tier mudharabah).'}
      />

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
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading pool…
        </div>
      ) : !isConnected ? (
        <Card className="p-10 text-center">
          <Wallet className="w-16 h-16 text-tawf-muted mx-auto mb-4" />
          <h3 className="font-serif text-xl text-tawf-green mb-2">Connect your wallet</h3>
          <p className="text-tawf-muted mb-4">Connect an EVM wallet on Arbitrum Sepolia to view the pool</p>
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
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <Badge variant="info" size="sm">{product?.symbol}</Badge>
              <div className="flex flex-wrap gap-2">
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
            <h3 className="font-serif text-xl text-tawf-green mb-1">{product?.name}</h3>
            <p className="text-tawf-muted text-sm leading-relaxed mb-4">
              {isPool
                ? `${banks.length} BPRS in ${product?.region}, one demo account at each. Subscribe in ${coinNames}. The funds are converted to IDR and placed across the banks.`
                : `BPRS Demo Syariah · demo account TAWF-S1. Subscribe in ${coinNames}. The funds are converted to IDR and placed in the account.`}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Metric icon={<Clock className="w-4 h-4 text-tawf-gold" />} label="Tenor" value={`${state.tenorMonths} months`} />
              <Metric icon={<PiggyBank className="w-4 h-4 text-tawf-gold" />} label="Bank nisbah to depositor" value={formatBps(state.nisbahBps)} />
              <Metric
                icon={<ShieldCheck className="w-4 h-4 text-tawf-gold" />}
                label="Investors"
                value={`${state.investorCount} / ${state.maxInvestors}`}
              />
              <Metric
                icon={<ShieldCheck className="w-4 h-4 text-tawf-gold" />}
                label="Backing"
                value={state.ratioBps >= 10000n ? (state.supply === 0n ? 'No supply yet' : 'Over 100%') : `${Number(state.ratioBps) / 100}%`}
              />
            </div>

            {/* Per-coin posted rates */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {coins.map((c) => {
                const idr = c.idrPerToken > 0n ? Number(c.idrPerToken) / 100 : 0;
                return (
                  <div key={c.key} className="p-3 rounded-xl bg-tawf-sand-30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-tawf-muted">{c.symbol}/IDR rate</span>
                      {c.idrPerToken > 0n && (
                        <Badge variant={c.rateFresh ? 'success' : 'warning'} size="sm">
                          {c.rateFresh ? 'fresh' : 'stale'}
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-tawf-green">
                      {idr > 0 ? `Rp ${idr.toLocaleString('id-ID')}` : 'not posted'}
                    </p>
                  </div>
                );
              })}
            </div>

            <ProgressBar
              value={Number(state.supply)}
              max={Number(state.reserve) || Number(state.supply) || 1}
              size="sm"
              color="green"
              showLabel
              label={isPool ? 'Supply vs customer deposito across the banks' : 'Supply vs anchored account balance'}
            />
            <div className="flex justify-between mt-1 mb-4">
              <span className="text-xs text-tawf-muted">{formatIdr(state.supply)} tokenized</span>
              <span className="text-xs text-tawf-muted">{formatIdr(state.reserve)} {isPool ? `at ${banks.length} BPRS` : 'at BPRS'} (anchored)</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-tawf-muted">
              <div>Cap / investor: <span className="text-tawf-green">{formatIdr(state.maxBalancePerInvestor)}</span></div>
              <div>Series cap: <span className="text-tawf-green">{formatIdr(state.seriesCap)}</span></div>
            </div>

            {isPool && banks.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-medium text-tawf-green mb-2 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-tawf-gold" /> Banks in the pool
                </p>
                <div className="rounded-xl border border-tawf-green-10 divide-y divide-tawf-green-10">
                  {banks.map((b) => {
                    const total = banks.reduce((a, x) => a + x.balanceSen, 0n);
                    const share = total > 0n ? Number((b.balanceSen * 10000n) / total) / 100 : 0;
                    return (
                      <div key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div>
                          <p className="text-tawf-green">{b.name}</p>
                          <p className="text-xs text-tawf-muted font-mono">{b.accountRef}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-tawf-green">{formatIdr(b.balanceSen)}</p>
                          <p className="text-xs text-tawf-muted">{share}% of the pool</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Actions + holdings */}
          <Card className="p-6 flex flex-col">
            <p className="font-medium text-tawf-green mb-3">Your position</p>

            {/* Settlement coin selector drives the quotes + claim/redeem coin. */}
            <div className="mb-4">
              <label className="block text-xs text-tawf-muted mb-1">Settlement coin</label>
              <div className="flex gap-2">
                {coins.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCoinKey(c.key)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      coinKey === c.key
                        ? 'bg-tawf-green text-white border-tawf-green'
                        : 'bg-white text-tawf-green border-tawf-green-10'
                    }`}
                  >
                    {c.symbol}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-tawf-sand-30 space-y-2 mb-4">
              <Row label="Holdings (IDR)" value={formatIdr(state.balance)} />
              <Row label={`Holdings (~${selectedCoin?.symbol ?? ''})`} value={formatUsdc(holdingsCoin)} />
              <Row label="Claimable profit (IDR)" value={formatIdr(state.claimableSen)} gold />
              <Row label={`Claimable (~${selectedCoin?.symbol ?? ''})`} value={formatUsdc(claimableCoin)} gold />
            </div>

            {/* Pending escrow, per coin, each cancellable. */}
            {pendingCoins.length > 0 && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2 mb-4">
                <p className="text-xs font-medium text-blue-800">Pending (escrowed)</p>
                {pendingCoins.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-tawf-green">
                      {formatUsdc(c.pending)} {c.symbol}
                    </span>
                    <Button size="sm" variant="secondary" disabled={cancelling} onClick={() => runCancel(c)}>
                      {cancelling ? 'Cancelling…' : 'Cancel'}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {isConnected && !state.eligible && (
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 mb-4 space-y-2">
                <p className="text-xs text-blue-700">
                  {!isVerified
                    ? 'Verify your identity first.'
                    : state.mode === 0
                      ? 'This pool is in PILOT ONLY mode, only Tawf may hold.'
                      : 'Your wallet needs a Tawf screening claim to hold this pool.'}
                </p>
                {isVerified && state.mode !== 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={screening}
                    onClick={async () => {
                      if (!address) return;
                      setScreening(true);
                      setScreenError(null);
                      try {
                        await runFaucet(address);
                        refetch();
                      } catch (e) {
                        setScreenError(e instanceof Error ? e.message : 'Screening failed');
                      } finally {
                        setScreening(false);
                      }
                    }}
                  >
                    {screening ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BadgeCheck className="w-4 h-4 mr-2" />}
                    {screening ? 'Screening, about 20s…' : 'Get screened (test)'}
                  </Button>
                )}
                {screenError && <p className="text-xs text-red-600">{screenError}</p>}
              </div>
            )}

            <div className="mt-auto space-y-2">
              <Button
                size="sm"
                className="w-full"
                disabled={!isVerified || !state.eligible || !selectedCoin}
                onClick={() => { setSubOpen(true); setAcknowledged(false); reset(); }}
              >
                Subscribe ({selectedCoin?.symbol ?? 'USDC'})
              </Button>
              <Button size="sm" variant="ghost" className="w-full" disabled={state.claimableSen === 0n || claiming} onClick={runClaim}>
                {claiming ? 'Claiming…' : `Claim profit in ${selectedCoin?.symbol ?? ''}`}
              </Button>
              <Button size="sm" variant="ghost" className="w-full" disabled={state.balance === 0n || !state.redemptionOpen || redeeming} onClick={runRedeem}>
                {state.redemptionOpen ? (redeeming ? 'Redeeming…' : `Redeem in ${selectedCoin?.symbol ?? ''}`) : 'Redeem at maturity'}
              </Button>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Subscribe modal with disclosures */}
      {subOpen && selectedCoin && (
        <Modal isOpen onClose={() => setSubOpen(false)} title={`Subscribe to ${product?.name ?? 'the Deposito Pool'}`} size="md">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Settlement coin</label>
              <div className="flex gap-2 mb-3">
                {coins.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCoinKey(c.key)}
                    disabled={c.idrPerToken === 0n}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-40 ${
                      coinKey === c.key
                        ? 'bg-tawf-green text-white border-tawf-green'
                        : 'bg-white text-tawf-green border-tawf-green-10'
                    }`}
                  >
                    {c.symbol}
                  </button>
                ))}
              </div>
              <label className="block text-sm font-medium text-tawf-ink mb-2">Amount ({selectedCoin.symbol})</label>
              <input
                type="number"
                min={1}
                value={coinAmount}
                onChange={(e) => setCoinAmount(Number(e.target.value))}
                className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
              />
              {selectedRateIdr > 0 && (
                <p className="text-xs text-tawf-muted mt-1">
                  ≈ {formatIdr(BigInt(Math.round(coinAmount * selectedRateIdr * 100)))} at the posted {selectedCoin.symbol} rate
                </p>
              )}
            </div>

            <div className="rounded-xl border border-tawf-green-10 p-4 bg-tawf-sand-30">
              <p className="text-sm font-medium text-tawf-green mb-2">Please read and acknowledge</p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-tawf-muted">
                {disclosures.map((d) => <li key={d}>{d}</li>)}
              </ul>
              <label className="flex items-start gap-2 mt-3 text-sm text-tawf-ink">
                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-1" />
                <span>I understand this is a claim on Tawf valued in IDR, and the coin amount I receive depends on that coin&apos;s posted rate (FX risk), with non-guaranteed returns.</span>
              </label>
            </div>

            {error && <div className="bg-red-50 rounded-xl p-3 border border-red-200"><p className="text-sm text-red-600">{error}</p></div>}

            <Button size="lg" className="w-full" disabled={!acknowledged || subscribing} onClick={runSubscribe}>
              {subscribing ? <><Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" /> Confirming…</> : `Approve + Subscribe (${selectedCoin.symbol})`}
            </Button>
            <p className="text-xs text-tawf-muted">
              Your {selectedCoin.symbol} is escrowed until Tawf allocates against the anchored account balance. You can
              cancel this coin&apos;s pending escrow before allocation.
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
