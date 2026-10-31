import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getPendingApprovals, loadPasscode, type PendingApprovalsResponse, type PendingSafeTx, type SafeDuty } from '@/lib/tokenization';
import { useContractWrite } from '@/web3/hooks';
import { safeAbi, ZERO_ADDRESS } from '@/web3/safe';
import type { Abi } from 'viem';

const DUTY_LABEL: Record<SafeDuty, string> = {
  governance: 'Governance',
  treasury: 'Treasury',
  minting: 'Minting',
  compliance: 'Compliance',
  guardian: 'Guardian',
};

const STATUS_LABEL = { pending: 'Waiting', ready: 'Ready to execute', stale: 'Replaced or executed', superseded: 'Superseded' } as const;

/**
 * Proposals queued on the duty Safes. There is no hosted Safe service on Arbitrum Sepolia, so owners approve
 * on chain with their own wallet (Safe.approveHash) and, once the threshold is met, anyone executes with
 * Safe.execTransaction. The list comes from /api/tokenization/safe/pending (our store + Safe.approvedHashes).
 */
export function PendingApprovals({ duties, passcode }: { duties: SafeDuty[]; passcode?: string }) {
  const { address } = useAccount();
  const { write, isPending } = useContractWrite();
  const [data, setData] = useState<PendingApprovalsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [busyHash, setBusyHash] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getPendingApprovals(passcode ?? loadPasscode())
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not read the Safes');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [passcode, tick]);

  const reload = () => {
    setLoading(true);
    setTick((n) => n + 1);
  };

  const act = async (p: PendingSafeTx, kind: 'approve' | 'execute') => {
    setBusyHash(p.safeTxHash);
    setError(null);
    try {
      if (kind === 'approve') {
        await write({ address: p.safe, abi: safeAbi as unknown as Abi, functionName: 'approveHash', args: [p.safeTxHash] });
      } else {
        await write({
          address: p.safe,
          abi: safeAbi as unknown as Abi,
          functionName: 'execTransaction',
          args: [p.to, 0n, p.data, 0, 0n, 0n, 0n, ZERO_ADDRESS, ZERO_ADDRESS, p.signatures],
        });
      }
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${kind} failed`);
    } finally {
      setBusyHash(null);
    }
  };

  const configured = data ? duties.filter((d) => data.safes[d]?.address) : [];
  const rows = data ? data.pending.filter((p) => duties.includes(p.duty) && p.status !== 'stale') : [];
  const me = address?.toLowerCase();

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-tawf-gray-900">Pending approvals</h3>
          <p className="text-xs text-tawf-gray-500">
            {duties.map((d) => DUTY_LABEL[d]).join(', ')} Safe{duties.length > 1 ? 's' : ''}. Owners approve with their own wallet, then anyone executes.
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={loading} onClick={reload}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && configured.length === 0 && (
        <p className="text-sm text-tawf-gray-500">
          No Safe is configured for this area yet (set {duties.map((d) => data.safes[d]?.env).join(', ')}).
        </p>
      )}
      {data && configured.length > 0 && rows.length === 0 && <p className="text-sm text-tawf-gray-500">Nothing is waiting for approval.</p>}
      {rows.length > 0 && (
        <ul className="divide-y divide-tawf-green-5">
          {rows.map((p) => {
            const isOwner = !!me && p.owners.some((o) => o.toLowerCase() === me);
            const approved = !!me && p.approvedBy.some((o) => o.toLowerCase() === me);
            const busy = busyHash === p.safeTxHash || isPending;
            return (
              <li key={p.safeTxHash} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">{DUTY_LABEL[p.duty]}</Badge>
                    <span className="text-sm font-medium text-tawf-gray-900 truncate">{String(p.description || p.method || 'Contract call')}</span>
                  </div>
                  <p className="text-xs text-tawf-gray-500 mt-1">
                    Nonce {p.nonce}, {p.approvedBy.length} of {p.required} approved, {STATUS_LABEL[p.status]}
                    {p.status === 'pending' && p.nonce > p.safeNonce ? ` (queued behind nonce ${p.safeNonce})` : ''}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {p.status !== 'superseded' && isOwner && !approved && (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(p, 'approve')}>
                      Approve
                    </Button>
                  )}
                  {p.status === 'ready' && (
                    <Button size="sm" disabled={busy || !address} onClick={() => void act(p, 'execute')}>
                      Execute
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
