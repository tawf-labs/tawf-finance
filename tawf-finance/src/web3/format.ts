/**
 * Display helpers for on-chain USDC values (6 decimals) and addresses.
 */

export function usdcToNumber(baseUnits: bigint): number {
  return Number(baseUnits) / 1e6;
}

export function formatUsdc(baseUnits: bigint | number): string {
  const n = typeof baseUnits === 'bigint' ? Number(baseUnits) / 1e6 : baseUnits;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 1200 (basis points) → "12.00%" */
export function formatApy(apyBps: bigint | number): string {
  const bps = typeof apyBps === 'bigint' ? Number(apyBps) : apyBps;
  return `${(bps / 100).toFixed(2)}%`;
}

export function shortAddress(address: string | undefined): string {
  if (!address) return 'N/A';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatTimestamp(unixSeconds: bigint | number): string {
  const ms = typeof unixSeconds === 'bigint' ? Number(unixSeconds) * 1000 : unixSeconds * 1000;
  return new Date(ms).toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Human-friendly reason extraction from a viem wallet/contract error. */
export function getRevertReason(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (/user rejected|denied/i.test(msg)) return 'Transaction rejected in wallet';
    const m = msg.match(/reverted with the following reason:\s*\n(.*)/);
    if (m) return m[1].trim();
    const short = msg.match(/shortMessage:\s*"([^"]+)"/);
    if (short) return short[1];
    return msg.length > 200 ? msg.slice(0, 200) : msg;
  }
  return 'Transaction failed';
}
