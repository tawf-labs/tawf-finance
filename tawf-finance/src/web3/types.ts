/**
 * On-chain domain types, mirroring the Solidity structs exactly.
 * All token amounts are USDC base units (6 decimals), i.e. bigint.
 */

export type DealStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  0: 'Submitted',
  1: 'Originator Approved',
  2: 'Mintable',
  3: 'Active',
  4: 'Matured',
  5: 'Completed',
  6: 'Defaulted',
};

export type ReceiptStatus = 0 | 1 | 2 | 3;

export const RECEIPT_STATUS_LABEL: Record<ReceiptStatus, string> = {
  0: 'Active',
  1: 'Matured',
  2: 'Redeemed',
  3: 'Defaulted',
};

export interface Deal {
  id: bigint;
  invoiceHash: `0x${string}`;
  supplierName: string;
  anchorBuyer: string;
  bmtOriginator: `0x${string}`;
  apyBps: bigint;
  durationDays: bigint;
  minInvestment: bigint;
  fundingTarget: bigint;
  totalFunded: bigint;
  investorCount: bigint;
  status: DealStatus;
  createdAt: bigint;
  maturesAt: bigint;
}

export interface ReceiptMeta {
  principal: bigint;
  apyBps: bigint;
  durationDays: bigint;
  status: ReceiptStatus;
  mintedAt: bigint;
}

/**
 * Raw ABI return for a Deal. viem decodes a Solidity struct with named fields
 * into an object (keyed by field name); tuples with unnamed components decode
 * into a positional array. We accept either shape and read defensively so a
 * malformed or unexpected payload can never produce a Deal with `undefined`
 * fields (which would crash `.toString()` at render time).
 */
type RawDeal =
  | readonly [
      id: bigint,
      invoiceHash: `0x${string}`,
      supplierName: string,
      anchorBuyer: string,
      bmtOriginator: `0x${string}`,
      apyBps: bigint,
      durationDays: bigint,
      minInvestment: bigint,
      fundingTarget: bigint,
      totalFunded: bigint,
      investorCount: bigint,
      status: DealStatus,
      createdAt: bigint,
      maturesAt: bigint,
    ]
  | Record<string, unknown>;

/** Raw ABI return for ReceiptMeta (object or positional array). */
type RawReceipt =
  | readonly [
      principal: bigint,
      apyBps: bigint,
      durationDays: bigint,
      status: ReceiptStatus,
      mintedAt: bigint,
    ]
  | Record<string, unknown>;

/** Coerce any bigint-like value to bigint; missing/invalid becomes 0n. */
function toBig(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}

/** Read a field by name (object shape) or index (tuple shape). */
function pick(raw: unknown, key: string, index: number): unknown {
  if (Array.isArray(raw)) return raw[index];
  if (raw && typeof raw === 'object') return (raw as Record<string, unknown>)[key];
  return undefined;
}

/** Narrow an unknown status to a valid DealStatus (0-6), defaulting to 0. */
function toDealStatus(value: unknown): DealStatus {
  const n = Number(toBig(value));
  return (n >= 0 && n <= 6 ? n : 0) as DealStatus;
}

/** True if a raw deal looks structurally usable (has an id and core fields). */
export function isValidRawDeal(raw: unknown): boolean {
  if (!raw || (typeof raw !== 'object' && !Array.isArray(raw))) return false;
  const id = pick(raw, 'id', 0);
  return id !== undefined && id !== null;
}

export function mapDeal(raw: RawDeal): Deal {
  return {
    id: toBig(pick(raw, 'id', 0)),
    invoiceHash: (pick(raw, 'invoiceHash', 1) as `0x${string}`) ?? '0x',
    supplierName: (pick(raw, 'supplierName', 2) as string) ?? '',
    anchorBuyer: (pick(raw, 'anchorBuyer', 3) as string) ?? '',
    bmtOriginator: (pick(raw, 'bmtOriginator', 4) as `0x${string}`) ?? '0x',
    apyBps: toBig(pick(raw, 'apyBps', 5)),
    durationDays: toBig(pick(raw, 'durationDays', 6)),
    minInvestment: toBig(pick(raw, 'minInvestment', 7)),
    fundingTarget: toBig(pick(raw, 'fundingTarget', 8)),
    totalFunded: toBig(pick(raw, 'totalFunded', 9)),
    investorCount: toBig(pick(raw, 'investorCount', 10)),
    status: toDealStatus(pick(raw, 'status', 11)),
    createdAt: toBig(pick(raw, 'createdAt', 12)),
    maturesAt: toBig(pick(raw, 'maturesAt', 13)),
  };
}

export function mapReceipt(raw: RawReceipt): ReceiptMeta {
  const statusN = Number(toBig(pick(raw, 'status', 3)));
  return {
    principal: toBig(pick(raw, 'principal', 0)),
    apyBps: toBig(pick(raw, 'apyBps', 1)),
    durationDays: toBig(pick(raw, 'durationDays', 2)),
    status: (statusN >= 0 && statusN <= 3 ? statusN : 0) as ReceiptStatus,
    mintedAt: toBig(pick(raw, 'mintedAt', 4)),
  };
}
