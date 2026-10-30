import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { Link } from 'react-router-dom';
import { ShieldCheck, Loader2, ExternalLink, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { encodeAbiParameters, keccak256, stringToHex } from 'viem';
import { Reveal } from '@/components/landing/Reveal';
import { Chapter, PageHero, PublicPage, Tile, ghost } from '@/components/landing/PublicPage';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getScfStatus, type ScfStatus } from '@/lib/scf';
import { getJson, type ReserveResponse, type SeriesReserveLine, type PoolReserveLine, type ProofResponse } from '@/lib/tokenization';
import { LedgerAnchorAbi, DepositoPoolLedgerAbi } from '@/web3/tokenizationAbis';
import { LEDGER_ANCHOR_ADDRESS, LEDGER_CHAIN_ID, isTokenizationConfigured } from '@/web3/tokenization';
import { explorerTxUrl, explorerAddressUrl } from '@/web3/constants';
import { formatBps, formatIdr, formatUsdc } from '@/web3/format';

type VerifyState = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

interface RowLine {
  kind: 'series' | 'pool';
  label: string;
  symbol: string;
  subject: `0x${string}`;
  supply: string;
  reserve: string;
  ratioBps: number;
  fullyBacked: boolean;
  snapshotAt: number;
  anchored: boolean;
  epoch: string | null;
  anchorTxHash: `0x${string}` | null;
  /** Extra line: profits credited vs distributed. */
  profitNote?: string;
  /** Regional pool only: its ledger and the per-bank balances. */
  ledger?: `0x${string}`;
  banks?: PoolReserveLine['banks'];
}

function amount(raw: string): string {
  return formatIdr(BigInt(raw));
}

/** The DEPOSITO_RESERVE leaf, encoded exactly as contracts/src/lib/LedgerLeaf.sol. */
function reserveLeaf(subject: `0x${string}`, snapshotAt: number, total: string): `0x${string}` {
  const inner = keccak256(
    encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }],
      [BigInt(LEDGER_CHAIN_ID), keccak256(stringToHex('tawf.deposito.reserve')), subject, BigInt(snapshotAt), BigInt(total)],
    ),
  );
  return keccak256(inner);
}

function ReserveRow({ line }: { line: RowLine }) {
  const publicClient = usePublicClient();
  const [verify, setVerify] = useState<VerifyState>('idle');
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const supply = Number(line.supply);
  const reserve = Number(line.reserve);

  const handleVerify = async () => {
    setVerify('checking');
    setVerifyMsg(null);
    try {
      if (line.kind === 'pool' && line.ledger && line.epoch !== null) {
        if (!publicClient) throw new Error('No RPC client available');
        // The pool ledger records each fact's leaves per epoch: no Merkle proof needed.
        const ok = await publicClient.readContract({
          address: line.ledger,
          abi: DepositoPoolLedgerAbi,
          functionName: 'verify',
          args: [BigInt(line.epoch), reserveLeaf(line.subject, line.snapshotAt, line.reserve), []],
        });
        setVerify(ok ? 'valid' : 'invalid');
        return;
      }
      const params = new URLSearchParams({
        kind: 'tawf.deposito.reserve',
        subject: line.subject,
        a: String(line.snapshotAt),
        b: line.reserve,
      });
      const proof = await getJson<ProofResponse>(`proof?${params.toString()}`);
      if (!publicClient || !LEDGER_ANCHOR_ADDRESS) {
        setVerify('error');
        setVerifyMsg('No RPC client or anchor address available');
        return;
      }
      const ok = await publicClient.readContract({
        address: LEDGER_ANCHOR_ADDRESS,
        abi: LedgerAnchorAbi,
        functionName: 'verify',
        args: [BigInt(proof.epoch), proof.leaf, proof.proof],
      });
      setVerify(ok ? 'valid' : 'invalid');
    } catch (e) {
      setVerify('error');
      setVerifyMsg(e instanceof Error ? e.message : 'Verification failed');
    }
  };

  return (
    <Tile className="h-full">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <Badge variant="info" size="sm" className="mb-2">{line.symbol}</Badge>
          <h3 className="display text-2xl">{line.label}</h3>
        </div>
        {line.fullyBacked ? (
          <Badge variant="success" size="md"><ShieldCheck className="w-3 h-3" /> Fully backed</Badge>
        ) : (
          <Badge variant="warning" size="md">Reserve lagging</Badge>
        )}
      </div>

      <ProgressBar
        value={supply}
        max={reserve || supply || 1}
        size="md"
        color="green"
        showLabel
        label={line.kind === 'pool' ? 'Receipts outstanding vs customer deposito across the banks' : 'Tokens outstanding vs the account balance at the BPRS'}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
        <div>
          <p className="text-xs text-tawf-muted">Token supply</p>
          <p className="font-medium text-tawf-green">{amount(line.supply)}</p>
        </div>
        <div>
          <p className="text-xs text-tawf-muted">{line.kind === 'pool' ? 'Customer deposito across banks' : 'Account balance'}</p>
          <p className="font-medium text-tawf-green">{amount(line.reserve)}</p>
        </div>
        <div>
          <p className="text-xs text-tawf-muted">Backing ratio</p>
          <p className="font-medium text-tawf-green">{line.ratioBps >= 10000 ? (Number(line.supply) === 0 ? 'No supply yet' : 'Over 100%') : formatBps(line.ratioBps)}</p>
        </div>
        <div>
          <p className="text-xs text-tawf-muted">Anchor epoch</p>
          <p className="font-medium text-tawf-green">{line.anchored && line.epoch !== null ? `#${line.epoch}` : 'Pending'}</p>
        </div>
      </div>

      {line.profitNote && <p className="text-xs text-tawf-muted mt-3">{line.profitNote}</p>}

      {line.banks && line.banks.length > 0 && (
        <div className="mt-4 rounded-2xl ring-1 ring-ink/10 divide-y divide-ink/10">
          {line.banks.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-tawf-green">{b.name} <span className="text-xs font-mono text-tawf-muted">{b.accountRef}</span></span>
              <span className="text-tawf-green">{formatIdr(BigInt(b.balanceSen))}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={handleVerify} disabled={verify === 'checking' || !line.anchored}>
            {verify === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify proof'}
          </Button>
          {verify === 'valid' && <span className="inline-flex items-center gap-1 text-sm text-green-600"><CheckCircle2 className="w-4 h-4" /> Proof valid</span>}
          {verify === 'invalid' && <span className="inline-flex items-center gap-1 text-sm text-red-600"><XCircle className="w-4 h-4" /> Proof rejected</span>}
          {verify === 'error' && <span className="text-xs text-red-600">{verifyMsg}</span>}
        </div>
        {line.anchorTxHash && (
          <a href={explorerTxUrl(line.anchorTxHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-jade hover:underline inline-flex items-center gap-1">
            Anchor tx <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </Tile>
  );
}

function seriesRow(s: SeriesReserveLine): RowLine {
  const credited = s.profitsCredited.reduce((n, c) => Math.max(n, c.period), 0);
  return {
    ...s,
    label: 'Tawf Deposito Pool: BPRS Demo',
    profitNote: `Profit periods credited by the bank: ${credited} · distributed on chain: ${s.lastDistributedPeriod}`,
  };
}

function poolRow(p: PoolReserveLine): RowLine {
  return { ...p, profitNote: `${p.banks.length} BPRS · profit periods distributed on chain: ${p.lastDistributedPeriod}` };
}

function ScfReserveRow({ scf }: { scf: ScfStatus }) {
  const supply = BigInt(scf.supply ?? '0');
  const raised = BigInt(scf.raised ?? scf.supply ?? '0');
  const reserve = BigInt(scf.reserve ?? '0');
  const size = BigInt(scf.offeringCap ?? '0');
  const minRaise = BigInt(scf.minRaise ?? '0');
  const backed = scf.isFullyBacked ?? supply <= reserve;
  const snapshot = scf.reserveSnapshotAt ? new Date(scf.reserveSnapshotAt * 1000).toLocaleString('en-SG') : null;
  return (
    <Tile className="h-full">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <Badge variant="info" size="sm" className="mb-2">SCF</Badge>
          <h3 className="display text-2xl">SME crowdfunding offering</h3>
          <p className="mt-1 text-xs text-tawf-muted">Status: {scf.status}</p>
        </div>
        {backed ? (
          <Badge variant="success" size="md"><ShieldCheck className="w-3 h-3" /> Within reserve</Badge>
        ) : (
          <Badge variant="warning" size="md">Reserve lagging</Badge>
        )}
      </div>
      <ProgressBar
        value={Number(raised)}
        max={Number(size) || Number(raised) || 1}
        label="Raised against the offering size"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
        <div>
          <p className="text-xs text-tawf-muted">Raised</p>
          <p className="font-medium text-tawf-green">{formatUsdc(raised)}</p>
        </div>
        <div>
          <p className="text-xs text-tawf-muted">Offering size</p>
          <p className="font-medium text-tawf-green">{formatUsdc(size)}</p>
        </div>
        <div>
          <p className="text-xs text-tawf-muted">Minimum raise</p>
          <p className="font-medium text-tawf-green">{formatUsdc(minRaise)}</p>
        </div>
        <div>
          <p className="text-xs text-tawf-muted">Profit periods paid</p>
          <p className="font-medium text-tawf-green">{scf.lastPeriod ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-tawf-muted">Token supply</p>
          <p className="font-medium text-tawf-green">{formatUsdc(supply)}</p>
        </div>
        <div>
          <p className="text-xs text-tawf-muted">Verified reserve</p>
          <p className="font-medium text-tawf-green">{reserve > 0n ? formatUsdc(reserve) : 'None yet'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-tawf-muted">Reserve snapshot</p>
          <p className="font-medium text-tawf-green">{snapshot ?? 'Pending'}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-tawf-muted">
        The token can only be minted up to the verified reserve. Demo data on testnet.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {scf.token && (
          <a href={explorerAddressUrl(scf.token)} target="_blank" rel="noopener noreferrer" className="text-xs text-jade hover:underline inline-flex items-center gap-1">
            Sukuk token <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {scf.distributor && (
          <a href={explorerAddressUrl(scf.distributor)} target="_blank" rel="noopener noreferrer" className="text-xs text-jade hover:underline inline-flex items-center gap-1">
            Distributor <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </Tile>
  );
}

export function ProofOfReserve() {
  const [data, setData] = useState<ReserveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scf, setScf] = useState<ScfStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    getScfStatus()
      .then((r) => { if (!cancelled) setScf(r); })
      .catch(() => {});
    getJson<ReserveResponse>('reserve')
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reserve'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <PublicPage>
      <PageHero
        eyebrow="Proof of reserve"
        title="Every token is matched"
        accent="to a verified reserve."
        lead={
          <>
            <p>
              For the Tawf Deposito Pool we show the receipts outstanding against the customer deposito at each licensed BPRS, bank by bank.
              For each SCF offering we show the sukuk tokens outstanding against the reserve figure the contract verifies, the amount raised
              against the offering size, and the profit periods paid. A token can only be minted against a reserve fact that verifies under
              an anchored root, so what you see is verified against the ledger, not asserted.
            </p>
            {data?.lastSyncAt && (
              <p className="mt-3 text-sm text-ink/60">Last BPRS sync: {new Date(data.lastSyncAt).toLocaleString('en-SG')}</p>
            )}
          </>
        }
      />

      <Chapter tint="paper" from="stone" eyebrow="Live reserve" title="Supply against" accent="the reserve.">
        {!isTokenizationConfigured ? (
          <div className="max-w-3xl rounded-3xl bg-butter p-6">
            <p className="text-sm text-ink">Tokenization is not configured in this environment yet.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20 text-ink/60">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading reserve…
          </div>
        ) : scf?.configured || (data && (data.pool || data.series)) ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {data?.pool && <Reveal><ReserveRow line={poolRow(data.pool)} /></Reveal>}
            {data?.series && <Reveal delay={0.08}><ReserveRow line={seriesRow(data.series)} /></Reveal>}
            {scf?.configured && <Reveal delay={0.16}><ScfReserveRow scf={scf} /></Reveal>}
          </div>
        ) : error ? (
          <div className="max-w-3xl rounded-3xl bg-peach p-6"><p className="text-sm text-ink">{error}</p></div>
        ) : (
          <p className="text-ink/60">No reserve snapshots anchored yet.</p>
        )}
      </Chapter>

      <Chapter tint="mint" from="paper" eyebrow="Trust path" title="How the trust" accent="path works.">
        <Reveal>
          <Tile className="max-w-4xl">
            <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center">
              {[
                'BPRS core banking or partner platform',
                'Reserve connector',
                'Tawf Network ledger',
                'LedgerAnchor on Arbitrum',
                'Mint gate',
              ].map((step, i, arr) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="rounded-full bg-mint px-3 py-2 font-medium text-jade-deep">{step}</span>
                  {i < arr.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 rotate-90 text-honey md:rotate-0" />}
                </div>
              ))}
            </div>
            <p className="mt-6 leading-relaxed text-ink/70">
              Each bank records Tawf&apos;s deposito balance and the partner platform records each offering&apos;s reserve (demo data on testnet). The connector reads them
              and writes reserve snapshots to the Tawf Network ledger, with no personal documents on chain. The
              relayer anchors the ledger&apos;s Merkle root on Arbitrum through the LedgerAnchor. tawf.finance contracts only mint
              a token against a leaf that verifies under an anchored root, so supply can never run ahead of the proven reserve.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {(data?.anchor ?? scf?.anchor) && (
                <a href={explorerAddressUrl((data?.anchor ?? scf?.anchor) as `0x${string}`)} target="_blank" rel="noopener noreferrer" className={ghost}>
                  LedgerAnchor on Arbiscan (ledger chain {LEDGER_CHAIN_ID}) <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              )}
              <Link to="/instruments" className={ghost}>Learn about the instruments</Link>
            </div>
          </Tile>
        </Reveal>
      </Chapter>
    </PublicPage>
  );
}
