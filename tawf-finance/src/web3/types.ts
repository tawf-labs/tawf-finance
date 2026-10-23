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

/** Raw ABI tuple for Deal (order matches the Solidity struct). */
type RawDeal = readonly [
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
];

/** Raw ABI tuple for ReceiptMeta. */
type RawReceipt = readonly [
  principal: bigint,
  apyBps: bigint,
  durationDays: bigint,
  status: ReceiptStatus,
  mintedAt: bigint,
];

/**
 * viem decodes a struct with named ABI components into an object
 * (`{ id, invoiceHash, ... }`), not a positional array. Read by name first and
 * fall back to the tuple index so either shape works.
 */
function field<T>(raw: unknown, index: number, name: string): T | undefined {
  if (Array.isArray(raw)) return raw[index] as T | undefined;
  if (raw && typeof raw === 'object') return (raw as Record<string, unknown>)[name] as T | undefined;
  return undefined;
}

/** Returns null when the value is not a usable deal, so callers can drop it instead of crashing. */
export function mapDeal(raw: RawDeal | Record<string, unknown>): Deal | null {
  const id = field<bigint>(raw, 0, 'id');
  if (id === undefined) return null;
  return {
    id,
    invoiceHash: field(raw, 1, 'invoiceHash') ?? '0x',
    supplierName: field(raw, 2, 'supplierName') ?? '',
    anchorBuyer: field(raw, 3, 'anchorBuyer') ?? '',
    bmtOriginator: field(raw, 4, 'bmtOriginator') ?? '0x0000000000000000000000000000000000000000',
    apyBps: field(raw, 5, 'apyBps') ?? 0n,
    durationDays: BigInt(field<number | bigint>(raw, 6, 'durationDays') ?? 0),
    minInvestment: field(raw, 7, 'minInvestment') ?? 0n,
    fundingTarget: field(raw, 8, 'fundingTarget') ?? 0n,
    totalFunded: field(raw, 9, 'totalFunded') ?? 0n,
    investorCount: BigInt(field<number | bigint>(raw, 10, 'investorCount') ?? 0),
    status: Number(field<number | bigint>(raw, 11, 'status') ?? 0) as DealStatus,
    createdAt: field(raw, 12, 'createdAt') ?? 0n,
    maturesAt: field(raw, 13, 'maturesAt') ?? 0n,
  };
}

/** Returns null when the value is not a usable receipt. */
export function mapReceipt(raw: RawReceipt | Record<string, unknown>): ReceiptMeta | null {
  const principal = field<bigint>(raw, 0, 'principal');
  if (principal === undefined) return null;
  return {
    principal,
    apyBps: field(raw, 1, 'apyBps') ?? 0n,
    durationDays: BigInt(field<number | bigint>(raw, 2, 'durationDays') ?? 0),
    status: Number(field<number | bigint>(raw, 3, 'status') ?? 0) as ReceiptStatus,
    mintedAt: field(raw, 4, 'mintedAt') ?? 0n,
  };
}
