/**
 * Securities crowdfunding (SCF, "Layanan Urun Dana") helpers for the investor
 * suitability step and the offering status, shared by the investor and admin
 * pages. The yearly investor limit follows POJK 57/2020: an investor with an
 * annual income up to Rp500 million may invest up to 5% of it a year across
 * SCF offerings, above that up to 10%. Legal entities and investors with a
 * capital-market account held for two years or more are exempt.
 */
import { getJson, postPublic, type TxStep } from '@/lib/tokenization';

export type ScfExemption = 'none' | 'legal_entity' | 'capital_market_2y';

export const SCF_EXEMPTION_LABEL: Record<ScfExemption, string> = {
  none: 'No exemption',
  legal_entity: 'Legal entity (badan hukum)',
  capital_market_2y: 'Capital-market account held 2 years or more',
};

/** On-chain exemption code (ScfInvestorLimitModule.Exemption) to label. */
export const SCF_EXEMPTION_BY_CODE: Record<number, ScfExemption> = { 0: 'none', 1: 'legal_entity', 2: 'capital_market_2y' };

export const SCF_INCOME_THRESHOLD_IDR = 500_000_000;

/** Yearly limit percentage for an annual income in rupiah. */
export function scfLimitPercent(incomeIdr: number): 5 | 10 {
  return incomeIdr <= SCF_INCOME_THRESHOLD_IDR ? 5 : 10;
}

/**
 * The text the investor signs. Must match `declarationMessage` in
 * api/_tokenization/scf/profile.ts exactly.
 */
export function scfDeclarationMessage(wallet: `0x${string}`, incomeIdr: bigint, exemption: ScfExemption): string {
  return [
    'Tawf SCF suitability declaration (testnet)',
    `Wallet: ${wallet}`,
    `Annual income (IDR): ${incomeIdr.toString()}`,
    `Exemption: ${exemption}`,
  ].join('\n');
}

export interface ScfProfileResult {
  wallet: `0x${string}`;
  bracket: number;
  percent: number | null;
  limitIdr: string;
  limit: string;
  exemption: ScfExemption;
  steps: TxStep[];
}

export function submitScfProfile(body: {
  wallet: `0x${string}`;
  incomeIdr: string;
  exemption: ScfExemption;
  signature: `0x${string}`;
}): Promise<ScfProfileResult> {
  return postPublic<ScfProfileResult>('scf/profile', body);
}

export interface ScfStatus {
  configured: boolean;
  distributor?: `0x${string}`;
  token?: `0x${string}`;
  limitModule?: `0x${string}`;
  anchor?: `0x${string}`;
  status?: 'Pending' | 'Subscription' | 'Active' | 'Matured' | 'Defaulted' | 'Cancelled';
  faceValue?: string;
  maturity?: number;
  minRaise?: string;
  minSubscription?: string;
  issuerTreasury?: `0x${string}`;
  raised?: string;
  subscriptionDeadline?: number;
  lastPeriod?: number;
  reserve?: string;
  offeringCap?: string;
  investor?: { wallet: `0x${string}`; limit: string; used: string; remaining: string; exemption: number } | null;
}

export function getScfStatus(wallet?: `0x${string}`): Promise<ScfStatus> {
  return getJson<ScfStatus>(`scf/status${wallet ? `?wallet=${wallet}` : ''}`);
}
