import { getJson } from '@/lib/tokenization';

export interface ClaimMeta {
  issuer: `0x${string}`;
  uri: string;
  validSignature: boolean;
  trusted: boolean;
  /** Valid signature, trusted issuer, trusted for this topic. */
  verified: boolean;
  /** Why there is no tick, or null when verified. */
  reason: string | null;
}

export interface TokenIdentityView {
  token: `0x${string}`;
  identity: `0x${string}` | null;
  originator: (ClaimMeta & { name: string; licence: string; kind: string; originatorId: `0x${string}` }) | null;
  platform: (ClaimMeta & { name: string; licence: string; platformId: `0x${string}` }) | null;
  partner: (ClaimMeta & { name: string; entity: string }) | null;
  docs: (ClaimMeta & { documentHash: `0x${string}`; documentUri: string }) | null;
}

export function getTokenIdentity(token: `0x${string}`): Promise<TokenIdentityView> {
  return getJson<TokenIdentityView>(`token-identity?token=${token}`);
}

/** True when at least one of the four claims verified on chain. */
export function hasVerifiedIdentity(v: TokenIdentityView | null): boolean {
  return !!v && !!v.identity && [v.originator, v.platform, v.partner, v.docs].some((c) => c?.verified);
}

export { safeDocumentLink, IPFS_GATEWAY } from './documentLink';
