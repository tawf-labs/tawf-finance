import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { ShieldCheck, ShieldAlert, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  KYC_ENABLED,
  loadKyc,
  saveKyc,
  startKyc,
  refreshKyc,
  type KycStatus,
} from '@/lib/didit';
import { getRevertReason } from '@/web3/format';
import { cn } from '@/utils/cn';

const STATUS_META: Record<KycStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  unverified: { label: 'Not verified', variant: 'default' },
  'in-review': { label: 'In review', variant: 'warning' },
  approved: { label: 'Verified', variant: 'success' },
  declined: { label: 'Declined', variant: 'error' },
  expired: { label: 'Expired', variant: 'default' },
};

function StatusIcon({ status }: { status: KycStatus }) {
  if (status === 'approved') return <ShieldCheck className="w-5 h-5 text-green-600" />;
  if (status === 'declined') return <ShieldAlert className="w-5 h-5 text-red-600" />;
  if (status === 'in-review') return <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />;
  return <Shield className="w-5 h-5 text-tawf-muted" />;
}

/**
 * KYC status + "Verify identity" control for Didit (hosted-URL flow).
 * Renders a graceful "not configured" state when VITE_KYC_ENABLED is off.
 */
export function KycStatusCard({ compact = false }: { compact?: boolean }) {
  const { address } = useAccount();
  const [status, setStatus] = useState<KycStatus>(() =>
    address ? (loadKyc(address)?.status ?? 'unverified') : 'unverified',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!address) return;
    const record = loadKyc(address);
    if (!record?.sessionId) return;
    if (record.status !== 'in-review' && record.status !== 'unverified') return;
    void refreshKyc(record.sessionId).then((next) => {
      if (cancelled) return;
      setStatus(next);
      saveKyc(address, { sessionId: record.sessionId, status: next });
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!KYC_ENABLED) {
    return (
      <div className={cn('rounded-xl border border-tawf-green-10 bg-tawf-sand-30', compact ? 'p-3' : 'p-5')}>
        <p className="text-sm text-tawf-muted">
          Identity verification (Didit) is not configured in this environment.
        </p>
      </div>
    );
  }

  const meta = STATUS_META[status];

  const handleVerify = async () => {
    if (!address) return;
    setError(null);
    setBusy(true);
    try {
      const { url, sessionId } = await startKyc(address);
      saveKyc(address, { sessionId, status: 'in-review' });
      window.location.assign(url);
    } catch (e) {
      setError(getRevertReason(e));
      setBusy(false);
    }
  };

  const body = (
    <>
      <div className="flex items-center gap-3">
        <StatusIcon status={status} />
        <div className="flex-1">
          <p className="font-medium text-tawf-green">Identity Verification</p>
          <p className="text-xs text-tawf-muted">KYC via Didit. Reusable identity for web3</p>
        </div>
        <Badge variant={meta.variant} size="sm">{meta.label}</Badge>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {status !== 'approved' && (
        <div className={cn('mt-3', compact ? '' : 'mt-4')}>
          <Button size={compact ? 'sm' : 'md'} onClick={handleVerify} disabled={busy || !address}>
            {busy ? 'Starting…' : status === 'in-review' ? 'Resume verification' : 'Verify identity'}
          </Button>
        </div>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="rounded-xl border border-tawf-green-10 bg-white p-3">
        {body}
      </div>
    );
  }

  return <div className="rounded-xl border border-tawf-green-10 bg-white p-5">{body}</div>;
}
