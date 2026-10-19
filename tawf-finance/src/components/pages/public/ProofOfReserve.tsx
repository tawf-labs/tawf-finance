import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ShieldCheck, Loader2, ExternalLink, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getJson, type ReserveResponse, type SeriesReserveLine, type SukukReserveLine, type ProofResponse } from '@/lib/tokenization';
import { LedgerAnchorAbi } from '@/web3/tokenizationAbis';
import { LEDGER_ANCHOR_ADDRESS, LEDGER_CHAIN_ID, isTokenizationConfigured } from '@/web3/tokenization';
import { explorerTxUrl, explorerAddressUrl } from '@/web3/constants';
import { formatBps, formatIdr } from '@/web3/format';

type VerifyState = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

interface RowLine {
  kind: 'series' | 'sukuk';
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
  /** How to display amounts: series is IDR sen, sukuk is USDC base units. */
  isIdr: boolean;
  /** Extra line for the series: profits credited vs distributed. */
  profitNote?: string;
}

function leafKindFor(line: RowLine): string {
  return line.kind === 'sukuk' ? 'tawf.sukuk.reserve' : 'tawf.deposito.reserve';
}

function amount(line: RowLine, raw: string): string {
  return line.isIdr ? formatIdr(BigInt(raw)) : raw;
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
      const params = new URLSearchParams({
        kind: leafKindFor(line),
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
    <Card className="p-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <Badge variant="info" size="sm" className="mb-2">{line.symbol}</Badge>
          <h3 className="font-serif text-xl text-tawf-green">{line.label}</h3>
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
        label={line.kind === 'series' ? 'Tokens outstanding vs Tawf\u2019s account balance at the BPRS' : 'Supply on Arbitrum vs reserve on Tawf Network'}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
        <div>
          <p className="text-xs text-tawf-muted">Token supply</p>
          <p className="font-medium text-tawf-green">{amount(line, line.supply)}</p>
        </div>
        <div>
          <p className="text-xs text-tawf-muted">{line.kind === 'series' ? 'Account balance' : 'Recorded reserve'}</p>
          <p className="font-medium text-tawf-green">{amount(line, line.reserve)}</p>
        </div>
        <div>
          <p className="text-xs text-tawf-muted">Backing ratio</p>
          <p className="font-medium text-tawf-green">{formatBps(line.ratioBps)}</p>
        </div>
        <div>
          <p className="text-xs text-tawf-muted">Anchor epoch</p>
          <p className="font-medium text-tawf-green">{line.anchored && line.epoch !== null ? `#${line.epoch}` : 'Pending'}</p>
        </div>
      </div>

      {line.profitNote && <p className="text-xs text-tawf-muted mt-3">{line.profitNote}</p>}

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
          <a href={explorerTxUrl(line.anchorTxHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-tawf-green hover:underline inline-flex items-center gap-1">
            Anchor tx <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </Card>
  );
}

function seriesRow(s: SeriesReserveLine): RowLine {
  const credited = s.profitsCredited.reduce((n, c) => Math.max(n, c.period), 0);
  return {
    ...s,
    isIdr: true,
    profitNote: `Profit periods credited by the bank: ${credited} · distributed on chain: ${s.lastDistributedPeriod}`,
  };
}

function sukukRow(s: SukukReserveLine): RowLine {
  return { ...s, isIdr: false };
}

export function ProofOfReserve() {
  const [data, setData] = useState<ReserveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<ReserveResponse>('reserve')
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reserve'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-tawf-sand">
      <div className="section-container pt-32 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-3xl mb-12">
          <Badge variant="info" size="md" className="mb-4">Proof of reserve</Badge>
          <h1 className="font-serif text-4xl text-tawf-green mb-4">Every token is backed by a real placement</h1>
          <p className="text-tawf-muted leading-relaxed">
            For the Tawf deposito series we show the tokens outstanding on Arbitrum against Tawf&apos;s dedicated
            account balance at the BPRS, anchored on Tawf Network; and for the sukuk, supply against the pool
            outstanding. A token can only move against a Merkle-verified reserve leaf, so what you see here is
            checked, not claimed. BPRS-wide deposits recorded on Tawf Network back the bank&apos;s overall proof of
            reserve.
          </p>
          {data?.lastSyncAt && (
            <p className="text-sm text-tawf-muted mt-3">Last BPRS sync: {new Date(data.lastSyncAt).toLocaleString('en-SG')}</p>
          )}
        </motion.div>

        {!isTokenizationConfigured ? (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 max-w-3xl">
            <p className="text-sm text-amber-700">Tokenization is not configured in this environment yet.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20 text-tawf-muted">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading reserve…
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-6 max-w-3xl"><p className="text-sm text-red-600">{error}</p></div>
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReserveRow line={seriesRow(data.series)} />
            <ReserveRow line={sukukRow(data.sukuk)} />
          </div>
        ) : (
          <p className="text-tawf-muted">No reserve snapshots anchored yet.</p>
        )}

        {/* Trust path explainer */}
        <Card className="p-8 mt-12 max-w-4xl">
          <h2 className="font-serif text-2xl text-tawf-green mb-4">How the trust path works</h2>
          <div className="flex flex-col md:flex-row md:items-center gap-3 text-sm">
            {[
              'BPRS core banking',
              'bprs-connector',
              'Tawf Network ledger',
              'LedgerAnchor on Arbitrum',
              'Mint gate',
            ].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-3">
                <span className="px-3 py-2 rounded-xl bg-tawf-green-10 text-tawf-green font-medium">{step}</span>
                {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-tawf-gold shrink-0 rotate-90 md:rotate-0" />}
              </div>
            ))}
          </div>
          <p className="text-tawf-muted leading-relaxed mt-6">
            The bank's core banking system holds the real deposits and the pool backing the sukuk. The connector reads it
            and writes placements and reserve snapshots to the Tawf Network ledger, with no borrower names on chain. The
            relayer anchors the ledger's Merkle root on Arbitrum through the LedgerAnchor. tawf.finance contracts only mint
            a token against a leaf that verifies under an anchored root, so supply can never run ahead of proven reserve.
          </p>
          {data?.anchor && (
            <a href={explorerAddressUrl(data.anchor)} target="_blank" rel="noopener noreferrer" className="text-sm text-tawf-green hover:underline inline-flex items-center gap-1 mt-4">
              LedgerAnchor on Arbiscan (ledger chain {LEDGER_CHAIN_ID}) <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <div className="mt-6">
            <Link to="/instruments" className="text-sm text-tawf-gold hover:underline">Learn about the instruments →</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
