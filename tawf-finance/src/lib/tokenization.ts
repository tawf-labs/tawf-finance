/**
 * Client helpers for the tokenization serverless API under /api/tokenization/*.
 *
 * The demo operator key, the Tawf Network RPC token and the connector key all
 * stay server-side. The browser only posts intents here. Admin (issuer /
 * custodian) actions carry an x-demo-passcode header the operator checks.
 */

export interface TxStep {
  label: string;
  txHash?: `0x${string}`;
  skipped?: boolean;
  note?: string;
}

const PASSCODE_KEY = 'tawf_demo_passcode';

export function loadPasscode(): string {
  try {
    return sessionStorage.getItem(PASSCODE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function savePasscode(value: string): void {
  try {
    sessionStorage.setItem(PASSCODE_KEY, value);
  } catch {
    // storage unavailable, ignore
  }
}

interface ApiError {
  error?: string;
}

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

/** POST a public (no passcode) tokenization endpoint. */
export async function postPublic<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/tokenization/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parse<T>(res);
}

/** POST an admin (passcode-gated) tokenization endpoint. */
export async function postAdmin<T>(path: string, body: unknown, passcode: string): Promise<T> {
  const res = await fetch(`/api/tokenization/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-demo-passcode': passcode },
    body: JSON.stringify(body),
  });
  return parse<T>(res);
}

/** GET a tokenization endpoint (optionally passcode-gated). */
export async function getJson<T>(path: string, passcode?: string): Promise<T> {
  const res = await fetch(`/api/tokenization/${path}`, {
    headers: passcode ? { 'x-demo-passcode': passcode } : undefined,
  });
  return parse<T>(res);
}

// --- shaped responses -------------------------------------------------------

export interface FaucetResult {
  address: `0x${string}`;
  steps: TxStep[];
  isVerified: boolean;
}

export interface Placement {
  placementId: `0x${string}`;
  productId: `0x${string}`;
  tenorMonths: number;
  nominal: string; // sen, as decimal string (bigint-safe over JSON)
  maturity: number;
  nisbahBps: number;
  recordedAt: number;
  anchored: boolean;
  epoch: string | null;
  tokenized: boolean;
}

export interface ReserveSnapshot {
  subject: `0x${string}`;
  label: string;
  tenorMonths?: number;
  snapshotAt: number;
  amount: string;
  anchored: boolean;
  epoch: string | null;
}

export interface PlacementsResponse {
  placements: Placement[];
  depositoReserves: ReserveSnapshot[];
  sukukReserve: ReserveSnapshot | null;
}

export interface SeriesReserveLine {
  kind: 'series';
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
  lastDistributedPeriod: number;
  profitsCredited: { period: number; amountIdr: number }[];
  anchorTxHash: `0x${string}` | null;
}

export interface SukukReserveLine {
  kind: 'sukuk';
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
}

export interface ReserveResponse {
  series: SeriesReserveLine;
  sukuk: SukukReserveLine;
  lastSyncAt: string | null;
  ledgerChainId: number;
  anchor: `0x${string}` | null;
}

export interface ProofResponse {
  epoch: string;
  leaf: `0x${string}`;
  proof: `0x${string}`[];
  root: `0x${string}`;
}

/** L3 sukuk state, proxied from the bprs-connector's GET /sukuk/status. */
export interface SukukStatus {
  sukukId: `0x${string}`;
  status: string;
  periods: number;
  declaredPeriods: number;
  maturity: number;
  faceValue: string;
  issuedAmount: string;
  l2Token: `0x${string}`;
  distributions: { period: number; amount: string }[];
}

/** The Tawf deposito series snapshot, from GET /api/tokenization/series/status. */
export interface SeriesStatus {
  series: `0x${string}`;
  token: `0x${string}`;
  sandboxModule: `0x${string}`;
  compliance: `0x${string}`;
  seriesId: `0x${string}`;
  tenorMonths: number;
  nisbahBps: number;
  rate: { idrPerUsdc: string; updatedAt: number; maxAge: number; fresh: boolean };
  supply: string;
  reserveSen: string;
  ratioBps: number;
  fullyBacked: boolean;
  lastPeriod: number;
  redemptionOpen: boolean;
  ledgerSnapshotAt: number;
  ledgerReserveSen: string;
  sandbox: {
    mode: string;
    treasury: `0x${string}`;
    claimIssuer: `0x${string}`;
    maxInvestors: string;
    maxBalancePerInvestor: string;
    seriesCap: string;
    seriesEnd: number;
    investorCount: string;
  };
  wallet: { pending: string; holdings: string; claimable: string; eligible: boolean } | null;
}

/** Demo FX quote, from GET /api/tokenization/fx. */
export interface FxQuote {
  idrPerUsdc: number;
  idr: number;
  source: string;
  note: string;
  at: string;
}

/** The Tawf dedicated account + ledger series view, from GET bprs/tawf-status. */
export interface TawfAccountStatus {
  accountRef: string;
  seriesId: `0x${string}`;
  seriesCoreId?: string;
  account: {
    accountRef: string;
    owner: string;
    balanceIdr: number;
    profitCredits: { period: number; amountIdr: number; date: string }[];
    maturity: { principalIdr: number; date: string } | null;
  };
  ledger: {
    registered: boolean;
    lastProfitPeriod: number;
    matured: boolean;
    reserveSnapshotAt: number;
    reserveSen: string;
  };
}
