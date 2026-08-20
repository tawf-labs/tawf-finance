/**
 * Client helpers for the Didit KYC integration.
 *
 * The Didit API key never enters the browser — all calls go through the
 * serverless functions under /api/kyc/*. KYC is opt-in behind VITE_KYC_ENABLED.
 */

export type KycStatus = 'unverified' | 'in-review' | 'approved' | 'declined' | 'expired';

export const KYC_ENABLED = import.meta.env.VITE_KYC_ENABLED === 'true';

interface KycRecord {
  sessionId: string;
  status: KycStatus;
}

const storageKey = (address: string) => `tawf_kyc_${address.toLowerCase()}`;

export function loadKyc(address: string): KycRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(address));
    return raw ? (JSON.parse(raw) as KycRecord) : null;
  } catch {
    return null;
  }
}

export function saveKyc(address: string, record: KycRecord): void {
  try {
    localStorage.setItem(storageKey(address), JSON.stringify(record));
  } catch {
    // storage unavailable — ignore
  }
}

/** Start a verification: returns the hosted Didit URL to redirect to. */
export async function startKyc(address: `0x${string}`): Promise<{ url: string; sessionId: string }> {
  const res = await fetch('/api/kyc/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  const data = (await res.json()) as { url?: string; session_id?: string; error?: string };
  if (!res.ok || !data.url || !data.session_id) {
    throw new Error(data.error ?? 'Failed to start KYC');
  }
  return { url: data.url, sessionId: data.session_id };
}

/** Resolve a session into a display status via the serverless decision proxy. */
export async function refreshKyc(sessionId: string): Promise<KycStatus> {
  try {
    const res = await fetch(`/api/kyc/decision?sessionId=${encodeURIComponent(sessionId)}`);
    if (!res.ok) return 'in-review';
    const data = (await res.json()) as { status?: string };
    const s = String(data.status ?? '').toLowerCase();
    if (s.includes('approved')) return 'approved';
    if (s.includes('declined')) return 'declined';
    if (s.includes('expired') || s.includes('abandoned')) return 'expired';
    if (s.includes('review') || s.includes('progress') || s.includes('started')) return 'in-review';
    return 'unverified';
  } catch {
    return 'in-review';
  }
}
