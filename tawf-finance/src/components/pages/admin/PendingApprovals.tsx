import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getPendingApprovals, loadPasscode, type PendingApprovalsResponse, type SafeDuty } from '@/lib/tokenization';

const DUTY_LABEL: Record<SafeDuty, string> = {
  governance: 'Governance',
  treasury: 'Treasury',
  minting: 'Minting',
  compliance: 'Compliance',
  guardian: 'Guardian',
};

/**
 * Transactions queued on the duty Safes that still need signatures. Read from the Safe Transaction
 * Service through /api/tokenization/safe/pending. Owners approve and execute in Safe{Wallet}.
 */
export function PendingApprovals({ duties, passcode }: { duties: SafeDuty[]; passcode?: string }) {
  const [data, setData] = useState<PendingApprovalsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [tick, setTick] = useState(0);

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

  const configured = data ? duties.filter((d) => data.safes[d]?.address) : [];
  const rows = data ? data.pending.filter((p) => duties.includes(p.duty)) : [];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-tawf-gray-900">Pending approvals</h3>
          <p className="text-xs text-tawf-gray-500">
            {duties.map((d) => DUTY_LABEL[d]).join(', ')} Safe{duties.length > 1 ? 's' : ''}. Signers approve in Safe{'{'}Wallet{'}'}.
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={loading} onClick={reload}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && configured.length === 0 && (
        <p className="text-sm text-tawf-gray-500">
          No Safe is configured for this area yet (set {duties.map((d) => data.safes[d]?.env).join(', ')}). Actions are sent by the
          operator on testnet until then.
        </p>
      )}
      {data && configured.length > 0 && rows.length === 0 && <p className="text-sm text-tawf-gray-500">Nothing is waiting for approval.</p>}
      {rows.length > 0 && (
        <ul className="divide-y divide-tawf-green-5">
          {rows.map((p) => (
            <li key={p.safeTxHash} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">{DUTY_LABEL[p.duty]}</Badge>
                  <span className="text-sm font-medium text-tawf-gray-900 truncate">{p.note ?? p.method ?? 'Contract call'}</span>
                </div>
                <p className="text-xs text-tawf-gray-500 mt-1">
                  Nonce {p.nonce}, {p.confirmations} of {p.required} approvals{p.method ? `, ${p.method}` : ''}
                </p>
              </div>
              <a className="text-sm text-tawf-green-700 inline-flex items-center gap-1 shrink-0" href={p.safeUrl} target="_blank" rel="noreferrer">
                Approve <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
