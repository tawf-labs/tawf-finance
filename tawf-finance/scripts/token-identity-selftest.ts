/**
 * Offline checks for api/_tokenization/_lib/token-identity.ts. Run:
 *   DEMO_OPERATOR_KEY=0x01 npx tsx scripts/token-identity-selftest.ts
 * The chain is stubbed: each claim is checked against the issuer signature, the TrustedIssuersRegistry and the topic.
 */
import { encodeAbiParameters, type Address, type Hex } from 'viem'
import { publicClient, addresses } from '../api/_tokenization/_lib/operator.js'
import { readTokenIdentity, decodeOriginator } from '../api/_tokenization/_lib/token-identity.js'

const TOKEN = '0x1000000000000000000000000000000000000001' as Address
const IDENT = '0x2000000000000000000000000000000000000002' as Address
const TIR = '0x3000000000000000000000000000000000000003' as Address
const GOOD = '0x4000000000000000000000000000000000000004' as Address
const OTHER = '0x5000000000000000000000000000000000000005' as Address
const ZERO = '0x0000000000000000000000000000000000000000'

const enc = {
  10: encodeAbiParameters([{ type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'address' }], ['Demo BPRS', 'OJK-1', 'BPRS', ZERO]),
  11: encodeAbiParameters([{ type: 'string' }, { type: 'string' }, { type: 'address' }], ['Demo Platform', 'REG-1', ZERO]),
  12: encodeAbiParameters([{ type: 'string' }, { type: 'string' }], ['Tawf Labs', 'PT Tawf Labs Teknologi']),
  13: encodeAbiParameters([{ type: 'bytes32' }, { type: 'string' }], [('0x' + 'ab'.repeat(32)) as Hex, 'ipfs://doc']),
} as Record<number, Hex>

interface Scenario {
  onchainID: Address
  // topic -> list of { issuer, data, validSig }
  claims: Record<number, { issuer: Address; data: Hex; validSig: boolean }[]>
  trusted: Set<string> // issuers in the registry
  topics: Map<string, Set<number>> // issuer -> trusted topics
}
let sc: Scenario
const rc = publicClient as unknown as { readContract: unknown }
rc.readContract = async (a: { address: Address; functionName: string; args?: unknown[] }) => {
  switch (a.functionName) {
    case 'onchainID': return sc.onchainID
    case 'issuersRegistry': return TIR
    case 'getClaimIdsByTopic': return (sc.claims[Number(a.args![0])] ?? []).map((_, i) => `0x${Number(a.args![0]).toString(16).padStart(2, '0')}${i.toString(16).padStart(62, '0')}`)
    case 'getClaim': {
      const id = String(a.args![0]); const topic = parseInt(id.slice(2, 4), 16); const i = parseInt(id.slice(4), 16)
      const c = sc.claims[topic][i]
      return [BigInt(topic), 1n, c.issuer, '0x1234', c.data, '']
    }
    case 'isClaimValid': {
      const topic = Number(a.args![1]); const issuer = a.address
      const c = (sc.claims[topic] ?? []).find((x) => x.issuer === issuer)
      return c?.validSig ?? false
    }
    case 'isTrustedIssuer': return sc.trusted.has(String(a.args![0]))
    case 'hasClaimTopic': return sc.topics.get(String(a.args![0]))?.has(Number(a.args![1])) ?? false
  }
  throw new Error('unexpected ' + a.functionName)
}
void addresses
const all = (issuer: Address, validSig = true) => ({ 10: [{ issuer, data: enc[10], validSig }], 11: [{ issuer, data: enc[11], validSig }], 12: [{ issuer, data: enc[12], validSig }], 13: [{ issuer, data: enc[13], validSig }] })
const trust = (issuer: Address, topics = [10, 11, 12, 13]) => ({ trusted: new Set([issuer]), topics: new Map([[issuer, new Set(topics)]]) })
const ok = (m: string) => console.log(`token-identity-selftest ${m} ok`)

// no identity linked
sc = { onchainID: ZERO as Address, claims: {}, trusted: new Set(), topics: new Map() }
let v = await readTokenIdentity(TOKEN)
if (v.identity !== null || v.originator || v.docs) throw new Error('a token without an onchainID must have no identity')
ok('no onchainID')

// identity without claims
sc = { onchainID: IDENT, claims: {}, trusted: new Set(), topics: new Map() }
v = await readTokenIdentity(TOKEN)
if (!v.identity || v.originator || v.platform || v.partner || v.docs) throw new Error('an empty identity has no claims')
ok('identity with no claims')

// everything verifies
sc = { onchainID: IDENT, claims: all(GOOD), ...trust(GOOD) }
v = await readTokenIdentity(TOKEN)
if (!v.originator?.verified || v.originator.name !== 'Demo BPRS' || v.originator.kind !== 'BPRS') throw new Error('originator must verify and decode')
if (!v.platform?.verified || v.platform.licence !== 'REG-1') throw new Error('platform')
if (!v.partner?.verified || v.partner.entity !== 'PT Tawf Labs Teknologi') throw new Error('partner')
if (!v.docs?.verified || v.docs.documentUri !== 'ipfs://doc' || v.docs.documentHash !== '0x' + 'ab'.repeat(32)) throw new Error('docs')
ok('all four verify')

// an issuer nobody trusts: no tick, with the reason
sc = { onchainID: IDENT, claims: all(OTHER), trusted: new Set([GOOD]), topics: new Map() }
v = await readTokenIdentity(TOKEN)
if (v.originator?.verified || !/not a trusted issuer/.test(v.originator?.reason ?? '')) throw new Error('an unknown issuer must not verify')
ok('untrusted issuer')

// a trusted issuer that is not trusted for the topic
sc = { onchainID: IDENT, claims: all(GOOD), ...trust(GOOD, [10]) }
v = await readTokenIdentity(TOKEN)
if (!v.originator?.verified) throw new Error('topic 10 is trusted')
if (v.docs?.verified || !/not trusted for this claim topic/.test(v.docs?.reason ?? '')) throw new Error('topic 13 is not trusted for this issuer')
ok('issuer not trusted for the topic')

// signature no longer valid (claim revoked, signing key removed)
sc = { onchainID: IDENT, claims: all(GOOD, false), ...trust(GOOD) }
v = await readTokenIdentity(TOKEN)
if (v.originator?.verified || !/signature is not valid/.test(v.originator?.reason ?? '')) throw new Error('an invalid signature must not verify')
ok('revoked or removed-key claim')

// two claims for a topic: the verified one wins
sc = { onchainID: IDENT, claims: { 10: [{ issuer: OTHER, data: enc[10], validSig: true }, { issuer: GOOD, data: enc[10], validSig: true }] }, trusted: new Set([GOOD]), topics: new Map([[GOOD, new Set([10])]]) }
v = await readTokenIdentity(TOKEN)
if (!v.originator?.verified || v.originator.issuer.toLowerCase() !== GOOD.toLowerCase()) throw new Error('the verified claim must be preferred')
ok('verified claim preferred')

// data that does not decode is dropped, not shown
sc = { onchainID: IDENT, claims: { 10: [{ issuer: GOOD, data: '0xdeadbeef', validSig: true }] }, ...trust(GOOD) }
v = await readTokenIdentity(TOKEN)
if (v.originator !== null || decodeOriginator('0xdeadbeef') !== null) throw new Error('undecodable data must not become a claim')
ok('undecodable data')
console.log('token-identity-selftest all ok')

// ---- TI3: document links ---------------------------------------------------------------------------------------
import { safeDocumentLink, IPFS_GATEWAY } from '../src/lib/documentLink.js'
const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
const cases: [string, boolean, string | null][] = [
  ['https://example.org/akad.pdf', true, 'https://example.org/akad.pdf'],
  ['https://example.org/akad.pdf', false, null], // an unverified claim never gets a link
  [`ipfs://${CID}`, true, `${IPFS_GATEWAY}${CID}`],
  [`ipfs://${CID}/akad.pdf`, true, `${IPFS_GATEWAY}${CID}/akad.pdf`],
  [`ipfs://ipfs/${CID}`, true, `${IPFS_GATEWAY}${CID}`],
  [`ipfs://${CID}`, false, null],
  ['javascript:alert(1)', true, null],
  ['JAVASCRIPT:alert(1)', true, null],
  ['data:text/html;base64,PHNjcmlwdD4=', true, null],
  ['http://example.org/akad.pdf', true, null], // plain http is not enough
  ['//example.org/akad.pdf', true, null],
  ['/relative/akad.pdf', true, null],
  ['https://user:pass@example.org/x', true, null],
  ['ipfs://x', true, null], // not a CID
  [`ipfs://${CID}/../../etc`, true, null],
  ['ipfs://https://evil.example', true, null],
  ['', true, null],
  ['not a url', true, null],
]
for (const [uri, verified, want] of cases) {
  const got = safeDocumentLink(uri, verified)
  if (got !== want) throw new Error(`safeDocumentLink(${JSON.stringify(uri)}, ${verified}) = ${got}, wanted ${want}`)
}
ok('document links')
