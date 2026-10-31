/**
 * Reads WHO is behind a token from its ONCHAINID: the originator, the platform, the tokenization partner and
 * the offering documents, recorded as claims under topics 10 to 13 (see contracts/script/lib/TokenIdentitySetup.sol).
 *
 * A claim shows "verified on chain" only when all three hold: the issuer's signature is valid
 * (ClaimIssuer.isClaimValid), the issuer is a trusted issuer in the TrustedIssuersRegistry, and it is trusted
 * for that topic. Nothing here is read from our own store.
 */
import { decodeAbiParameters, getAddress, parseAbi, type Address, type Hex } from 'viem'
import { publicClient, addresses } from './operator.js'

export const TOPIC_ORIGINATOR = 10n
export const TOPIC_PLATFORM = 11n
export const TOPIC_TOKENIZATION_PARTNER = 12n
export const TOPIC_OFFERING_DOCS = 13n
const TOPICS = [TOPIC_ORIGINATOR, TOPIC_PLATFORM, TOPIC_TOKENIZATION_PARTNER, TOPIC_OFFERING_DOCS] as const

const ZERO = '0x0000000000000000000000000000000000000000' as Address

const abi = parseAbi([
  'function onchainID() view returns (address)',
  'function getClaimIdsByTopic(uint256 topic) view returns (bytes32[])',
  'function getClaim(bytes32 claimId) view returns (uint256 topic, uint256 scheme, address issuer, bytes signature, bytes data, string uri)',
  'function isClaimValid(address identity, uint256 claimTopic, bytes sig, bytes data) view returns (bool)',
  'function issuersRegistry() view returns (address)',
  'function isTrustedIssuer(address issuer) view returns (bool)',
  'function hasClaimTopic(address issuer, uint256 claimTopic) view returns (bool)',
])

export interface ClaimMeta {
  issuer: Address
  uri: string
  /** The issuer's signature over (identity, topic, data) is valid. */
  validSignature: boolean
  /** The issuer is in the TrustedIssuersRegistry and trusted for this topic. */
  trusted: boolean
  /** validSignature and trusted: the "verified on chain" tick. */
  verified: boolean
  /** Why there is no tick, or null when verified. */
  reason: string | null
}

export interface OriginatorClaim extends ClaimMeta { name: string; licence: string; kind: string; originatorId: Address }
export interface PlatformClaim extends ClaimMeta { name: string; licence: string; platformId: Address }
export interface PartnerClaim extends ClaimMeta { name: string; entity: string }
export interface DocsClaim extends ClaimMeta { documentHash: Hex; documentUri: string }

export interface TokenIdentityView {
  token: Address
  /** The token's ONCHAINID, or null when none is linked. */
  identity: Address | null
  originator: OriginatorClaim | null
  platform: PlatformClaim | null
  partner: PartnerClaim | null
  docs: DocsClaim | null
}

/** Claim data decoders, the field lists of TokenIdentitySetup.encode*. Return null on data that does not decode. */
export function decodeOriginator(data: Hex) {
  try {
    const [name, licence, kind, originatorId] = decodeAbiParameters([{ type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'address' }], data)
    return { name, licence, kind, originatorId: originatorId as Address }
  } catch { return null }
}
export function decodePlatform(data: Hex) {
  try {
    const [name, licence, platformId] = decodeAbiParameters([{ type: 'string' }, { type: 'string' }, { type: 'address' }], data)
    return { name, licence, platformId: platformId as Address }
  } catch { return null }
}
export function decodePartner(data: Hex) {
  try {
    const [name, entity] = decodeAbiParameters([{ type: 'string' }, { type: 'string' }], data)
    return { name, entity }
  } catch { return null }
}
export function decodeDocs(data: Hex) {
  try {
    const [documentHash, documentUri] = decodeAbiParameters([{ type: 'bytes32' }, { type: 'string' }], data)
    return { documentHash: documentHash as Hex, documentUri }
  } catch { return null }
}

/** Newest claim of a topic that decodes. A topic can hold one claim per issuer. */
async function claimsOf(identity: Address, topic: bigint, tir: Address | null) {
  const ids = (await publicClient.readContract({ address: identity, abi, functionName: 'getClaimIdsByTopic', args: [topic] })) as Hex[]
  const out: { meta: ClaimMeta; data: Hex }[] = []
  for (const id of ids) {
    const [, , issuer, signature, data, uri] = (await publicClient.readContract({ address: identity, abi, functionName: 'getClaim', args: [id] })) as readonly [bigint, bigint, Address, Hex, Hex, string]
    let validSignature = false
    try {
      validSignature = (await publicClient.readContract({ address: issuer, abi, functionName: 'isClaimValid', args: [identity, topic, signature, data] })) as boolean
    } catch { /* an issuer that is not a ClaimIssuer */ }
    // All three must pass for a tick: the issuer is a trusted issuer, trusted for THIS topic, and its signature is
    // valid for this identity, topic and data (a revoked claim or a removed signing key fails here).
    let knownIssuer = false
    let topicTrusted = false
    if (tir) {
      try {
        knownIssuer = (await publicClient.readContract({ address: tir, abi, functionName: 'isTrustedIssuer', args: [issuer] })) as boolean
        topicTrusted = knownIssuer && ((await publicClient.readContract({ address: tir, abi, functionName: 'hasClaimTopic', args: [issuer, topic] })) as boolean)
      } catch { /* registry unreachable: not trusted */ }
    }
    const reason = !knownIssuer
      ? 'The issuer is not a trusted issuer.'
      : !topicTrusted
        ? 'The issuer is not trusted for this claim topic.'
        : !validSignature
          ? 'The issuer signature is not valid (claim revoked or signing key removed).'
          : null
    out.push({ meta: { issuer: getAddress(issuer) as Address, uri, validSignature, trusted: topicTrusted, verified: reason === null, reason }, data })
  }
  return out
}

/** Prefer a verified claim, else any claim that decodes. */
function pick<T>(list: { meta: ClaimMeta; data: Hex }[], decode: (d: Hex) => T | null): (T & ClaimMeta) | null {
  const decoded = list.map((c) => ({ meta: c.meta, v: decode(c.data) })).filter((c): c is { meta: ClaimMeta; v: T } => c.v !== null)
  const best = decoded.find((c) => c.meta.verified) ?? decoded[0]
  return best ? ({ ...best.v, ...best.meta } as T & ClaimMeta) : null
}

export async function readTokenIdentity(token: Address): Promise<TokenIdentityView> {
  const identity = (await publicClient.readContract({ address: token, abi, functionName: 'onchainID' })) as Address
  const view: TokenIdentityView = { token, identity: identity === ZERO ? null : (getAddress(identity) as Address), originator: null, platform: null, partner: null, docs: null }
  if (!view.identity) return view
  let tir: Address | null = null
  try {
    tir = (await publicClient.readContract({ address: addresses.identityRegistry, abi, functionName: 'issuersRegistry' })) as Address
  } catch { tir = null }
  const [o, p, t, d] = await Promise.all(TOPICS.map((topic) => claimsOf(view.identity as Address, topic, tir)))
  view.originator = pick(o, decodeOriginator)
  view.platform = pick(p, decodePlatform)
  view.partner = pick(t, decodePartner)
  view.docs = pick(d, decodeDocs)
  return view
}
