/**
 * On-chain domain types, mirroring the Solidity structs exactly.
 * All token amounts are USDC base units (6 decimals), i.e. bigint.
 */

export type DealStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  0: 'Submitted',
  1: 'BMT Approved',
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

export function mapDeal(raw: RawDeal): Deal {
  return {
    id: raw[0],
    invoiceHash: raw[1],
    supplierName: raw[2],
    anchorBuyer: raw[3],
    bmtOriginator: raw[4],
    apyBps: raw[5],
    durationDays: raw[6],
    minInvestment: raw[7],
    fundingTarget: raw[8],
    totalFunded: raw[9],
    investorCount: raw[10],
    status: raw[11],
    createdAt: raw[12],
    maturesAt: raw[13],
  };
}

export function mapReceipt(raw: RawReceipt): ReceiptMeta {
  return {
    principal: raw[0],
    apyBps: raw[1],
    durationDays: raw[2],
    status: raw[3],
    mintedAt: raw[4],
  };
}
