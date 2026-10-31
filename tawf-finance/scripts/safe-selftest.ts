/**
 * Offline checks for the Safe flow (api/_tokenization/_lib/safe.ts, src/web3/safe.ts).
 * Run: DEMO_OPERATOR_KEY=0x01 npx tsx scripts/safe-selftest.ts
 * The Safe contract and the key-value store are stubbed here. The real Safe contract is exercised by
 * contracts/test/SafeApproveFlow.t.sol on a fork of Arbitrum Sepolia.
 */
import { concat, encodeAbiParameters, keccak256, toHex, type Address, type Hex } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import { safeTxHash, packApprovedHashSignatures, type SafeTxMessage } from '../src/web3/safe.js'
import {
  submitAdminTx, proposeToSafe, listPending, safesRequired, assertLiveChain, assertOperatorFallbackAllowed,
} from '../api/_tokenization/_lib/safe.js'
import { selfServiceIssuer, selfServiceAgent } from '../api/_tokenization/_lib/identity.js'
import { publicClient } from '../api/_tokenization/_lib/operator.js'

const ok = (m: string) => console.log(`safe-selftest ${m} ok`)
async function rejects(label: string, run: () => Promise<unknown> | unknown, match: RegExp) {
  try {
    await run()
  } catch (e) {
    if (!match.test((e as Error).message)) throw new Error(`${label}: wrong error: ${(e as Error).message}`)
    return
  }
  throw new Error(`${label}: expected a rejection`)
}

// ---- 1. SafeTx hash matches a hand-built EIP-712 hash and the GnosisSafe typehash -----------------
const SAFE_TX_TYPEHASH = keccak256(toHex('SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)'))
const DOMAIN_TYPEHASH = keccak256(toHex('EIP712Domain(uint256 chainId,address verifyingContract)'))
if (SAFE_TX_TYPEHASH !== '0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8') throw new Error('SafeTx typehash mismatch')
{
  const safe = '0x1111111111111111111111111111111111111111' as Address
  const tx: SafeTxMessage = {
    to: '0x2222222222222222222222222222222222222222', value: 0n, data: '0xdeadbeef', operation: 0,
    safeTxGas: 0n, baseGas: 0n, gasPrice: 0n,
    gasToken: '0x0000000000000000000000000000000000000000', refundReceiver: '0x0000000000000000000000000000000000000000', nonce: 7n,
  }
  const domainSeparator = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }], [DOMAIN_TYPEHASH, 421614n, safe]))
  const structHash = keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'uint256' }],
    [SAFE_TX_TYPEHASH, tx.to, tx.value, keccak256(tx.data), tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.nonce],
  ))
  if (keccak256(concat(['0x1901', domainSeparator, structHash])) !== safeTxHash(safe, tx, 421614)) throw new Error('hash mismatch')
  ok('safeTxHash')
}

// ---- 2. Approved-hash signatures are sorted by owner and 65 bytes each ------------------------------
{
  const a = '0xaAaAaAaaAaAaAaaAaaAAAAAAAAaaaAaAaaAaaAaa' as Address
  const b = '0x1111111111111111111111111111111111111111' as Address
  const c = '0x9999999999999999999999999999999999999999' as Address
  const sig = packApprovedHashSignatures([a, c, b])
  if ((sig.length - 2) / 2 !== 65 * 3) throw new Error('signature length')
  const parts = [0, 1, 2].map((i) => sig.slice(2 + i * 130, 2 + (i + 1) * 130))
  const owners = parts.map((p) => ('0x' + p.slice(24, 64)).toLowerCase())
  if (owners.join() !== [b, c, a].map((x) => x.toLowerCase()).join()) throw new Error(`not sorted: ${owners}`)
  for (const p of parts) if (!p.endsWith('0'.repeat(64) + '01')) throw new Error('s must be 0 and v must be 1')
  ok('approved-hash signatures')
}

// ---- 3. Fail closed ---------------------------------------------------------------------------------
process.env.SAFE_SLOT_RECHECK_MS = '5'
const call = {
  duty: 'minting' as const,
  address: '0x2222222222222222222222222222222222222222' as Address,
  abi: [{ type: 'function', name: 'ping', inputs: [], outputs: [], stateMutability: 'nonpayable' }] as const,
  functionName: 'ping',
  description: 'selftest',
}
const realFetch = globalThis.fetch
delete process.env.DEMO_OPERATOR_KEY // a direct operator send would die with "DEMO_OPERATOR_KEY is not set"
process.env.MINTING_SAFE = '0x3333333333333333333333333333333333333333'
delete process.env.QUICKNODE_API_KEY
await rejects('no store', () => submitAdminTx(call, 421614), /key-value store/)
process.env.QUICKNODE_API_KEY = 'k'
globalThis.fetch = (async () => { throw new Error('store down') }) as typeof fetch
const chainRead = publicClient as unknown as { readContract: unknown; multicall: unknown; getChainId: unknown }
const realRead = chainRead.readContract
chainRead.readContract = async () => 0n
await rejects('store down', () => submitAdminTx(call, 421614), /unreachable|store down/)
process.env.MINTING_SAFE = 'not-an-address'
await rejects('bad env', () => submitAdminTx(call, 421614), /not a valid address/)
delete process.env.MINTING_SAFE
delete process.env.SAFES_REQUIRED
await rejects('required, no safe', () => submitAdminTx(call, 421614), /SAFES_REQUIRED is on/)
process.env.MINTING_SAFE = '   '
await rejects('required, blank safe', () => submitAdminTx(call, 421614), /SAFES_REQUIRED is on/)
delete process.env.MINTING_SAFE
await rejects('42161 no safe', () => submitAdminTx(call, 42161), /never sends minting actions directly/)
process.env.SAFES_REQUIRED = 'false'
await rejects('explicit off, sepolia', () => submitAdminTx(call, 421614), /DEMO_OPERATOR_KEY is not set/)
await rejects('explicit off, other chain', () => submitAdminTx(call, 42161), /never sends minting actions directly/)
if (safesRequired(42161) !== true) throw new Error('off must not work elsewhere')
delete process.env.SAFES_REQUIRED
if (!safesRequired(421614)) throw new Error('SAFES_REQUIRED must be on by default')
void assertOperatorFallbackAllowed
ok('fail closed')

// ---- 4. Test issuer / agent, chain guards, live chain ----------------------------------------------
await rejects('issuer 42161', () => selfServiceIssuer(42161), /testnet only/)
await rejects('agent 42161', () => selfServiceAgent(42161), /testnet only/)
await rejects('issuer required', () => selfServiceIssuer(421614), /SAFES_REQUIRED is on/)
await rejects('agent required', () => selfServiceAgent(421614), /SAFES_REQUIRED is on/)
process.env.SAFES_REQUIRED = 'false'
process.env.DEMO_OPERATOR_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001'
selfServiceIssuer(421614)
selfServiceAgent(421614)
delete process.env.SAFES_REQUIRED
chainRead.getChainId = async () => 1
await rejects('live chain mismatch', () => assertLiveChain(), /differs from deployments\.json/)
ok('issuer, agent and live chain')

// ---- 5. Proposals, nonces, approvals, stale ----------------------------------------------------------
const SAFE = '0x4444444444444444444444444444444444444444' as Address
process.env.MINTING_SAFE = SAFE
const OWNERS = ['0xA000000000000000000000000000000000000001', '0xA000000000000000000000000000000000000002', '0xA000000000000000000000000000000000000003'] as Address[]
let safeNonce = 0n
const approved = new Set<string>() // owner:hash
chainRead.readContract = async (a: { functionName: string; args?: unknown[] }) => {
  if (a.functionName === 'nonce') return safeNonce
  if (a.functionName === 'getThreshold') return 2n
  if (a.functionName === 'getOwners') return OWNERS
  if (a.functionName === 'getTransactionHash') {
    const x = a.args as [Address, bigint, Hex, number, bigint, bigint, bigint, Address, Address, bigint]
    return safeTxHash(SAFE, { to: x[0], value: x[1], data: x[2], operation: 0, safeTxGas: x[4], baseGas: x[5], gasPrice: x[6], gasToken: x[7], refundReceiver: x[8], nonce: x[9] }, 421614)
  }
  throw new Error('unexpected read ' + a.functionName)
}
chainRead.multicall = async (a: { contracts: { args: [Address, Hex] }[] }) =>
  a.contracts.map((c) => (approved.has(`${c.args[0]}:${c.args[1]}`) ? 1n : 0n))

function fakeKv() {
  const lists = new Map<string, string[]>()
  const sets = new Map<string, string>()
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    await sleep(Math.random() * 10)
    const m = url.pathname.match(/\/kv\/rest\/v1\/(sets|lists)(?:\/([^/]+))?(\/items)?$/)
    if (!m) return new Response('?', { status: 404 })
    const [, kind, rawKey, items] = m
    const key = rawKey ? decodeURIComponent(rawKey) : ''
    if (kind === 'sets') {
      if (method === 'POST') { const b = JSON.parse(String(init?.body)); sets.set(b.key, b.value); return json({}) }
      return sets.has(key) ? json({ data: { value: sets.get(key) } }) : new Response('', { status: 404 })
    }
    if (method === 'POST' && items) {
      const l = lists.get(key); if (!l) return new Response('', { status: 404 })
      const { item } = JSON.parse(String(init?.body)); if (!l.includes(item)) l.push(item); return json({})
    }
    if (method === 'POST') { const b = JSON.parse(String(init?.body)); if (lists.has(b.key)) return new Response('', { status: 409 }); lists.set(b.key, [...b.items]); return json({}) }
    return lists.has(key) ? json({ data: { items: lists.get(key) } }) : new Response('', { status: 404 })
  }) as typeof fetch
  return { lists, sets }
}
{
  fakeKv()
  const out = await Promise.all(Array.from({ length: 5 }, (_, i) => proposeToSafe({ ...call, description: `p${i}` })))
  const nonces = out.map((o) => Number(o.nonce)).sort((a, b) => a - b)
  if (nonces.join() !== '0,1,2,3,4') throw new Error(`parallel nonces not distinct: ${nonces.join()}`)
  ok('5 parallel proposals ' + nonces.join())

  // first proposal targets the current Safe nonce, the rest queue behind it
  let rows = await listPending(['minting'])
  if (rows.length !== 5 || rows.some((r) => r.status === 'superseded')) throw new Error('expected 5 live proposals: ' + JSON.stringify(rows.map((r) => [r.nonce, r.status])))
  // approvals: 1 of 2 -> pending, 2 of 2 on the next nonce -> ready, on a later nonce -> pending
  const h0 = rows[0].safeTxHash, h1 = rows[1].safeTxHash
  approved.add(`${OWNERS[0]}:${h0}`)
  rows = await listPending(['minting'])
  if (rows[0].status !== 'pending' || rows[0].approvedBy.length !== 1) throw new Error('1 of 2 must stay pending')
  approved.add(`${OWNERS[2]}:${h0}`)
  approved.add(`${OWNERS[0]}:${h1}`)
  approved.add(`${OWNERS[1]}:${h1}`)
  rows = await listPending(['minting'])
  if (rows[0].status !== 'ready') throw new Error('threshold met on the next nonce must be ready')
  if (rows[1].status !== 'pending') throw new Error('a later nonce must wait even with the threshold met')
  if (rows[0].signatures !== packApprovedHashSignatures([OWNERS[0], OWNERS[2]])) throw new Error('signatures must be the approvers, sorted')
  // the Safe executes nonce 0: it is stale now and nonce 1 becomes ready
  safeNonce = 1n
  rows = await listPending(['minting'])
  if (rows.some((r) => r.nonce === 0)) throw new Error('stale proposals are hidden by default')
  if (rows[0].nonce !== 1 || rows[0].status !== 'ready') throw new Error('nonce 1 must be ready next')
  const all = await listPending(['minting'], true)
  if (all.find((r) => r.nonce === 0)?.status !== 'stale') throw new Error('nonce below the Safe nonce is stale')
  ok('pending, approvals, ready and stale')

  // a new proposal after the nonce moved targets the first free nonce at or above the Safe nonce
  const next = await proposeToSafe({ ...call, description: 'after' })
  if (Number(next.nonce) !== 5) throw new Error(`expected nonce 5, got ${next.nonce}`)
  ok('next nonce')
}
globalThis.fetch = realFetch
void arbitrumSepolia
void realRead
console.log('safe-selftest all ok')
