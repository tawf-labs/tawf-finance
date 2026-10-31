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
  submitAdminTx, proposeToSafe, rejectNonce, listPending, safesRequired, assertLiveChain, assertOperatorFallbackAllowed,
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

// ---- 5. Proposals, nonces, competing, rejection, dedupe, approvals, stale -----------------------------
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
    // The live list is SORTED, not in insertion order: the stub sorts on every read.
    if (method === 'POST' && items) {
      const l = lists.get(key); if (!l) return new Response('', { status: 404 })
      const { item } = JSON.parse(String(init?.body)); if (!l.includes(item)) l.push(item); return json({})
    }
    if (method === 'POST') { const b = JSON.parse(String(init?.body)); if (lists.has(b.key)) return new Response('', { status: 409 }); lists.set(b.key, [...b.items]); return json({}) }
    return lists.has(key) ? json({ data: { items: [...lists.get(key)!].sort() } }) : new Response('', { status: 404 })
  }) as typeof fetch
  return { lists, sets }
}
{
  const kv = fakeKv()
  // sequential proposals queue: nonce = max(Safe.nonce, highest pending + 1)
  const p0 = await proposeToSafe({ ...call, args: [], description: 'first' })
  const p1 = await proposeToSafe({ ...call, functionName: 'ping', description: 'second, different?' })
  // identical call on the same computed nonce would dedupe only when the nonce is pinned the same: pin it
  if (p0.nonce !== '0') throw new Error(`first proposal must target the Safe nonce, got ${p0.nonce}`)
  if (p1.nonce !== '1') throw new Error(`second proposal must queue behind, got ${p1.nonce}`)
  const same = await proposeToSafe({ ...call, description: 'again' }, { nonce: 1n })
  if (same.safeTxHash !== p1.safeTxHash) throw new Error('an identical proposal on the same nonce must dedupe to the same hash')
  if (kv.sets.size !== 2) throw new Error(`dedupe must not store a second proposal, have ${kv.sets.size}`)
  ok('queue and dedupe')

  // several proposals may share a nonce and compete
  const other = { ...call, abi: [{ type: 'function', name: 'pong', inputs: [], outputs: [], stateMutability: 'nonpayable' }] as const, functionName: 'pong' }
  const c1 = await proposeToSafe(other, { nonce: 1n })
  if (c1.safeTxHash === p1.safeTxHash) throw new Error('a different call has a different hash')
  let rows = await listPending(['minting'])
  const at1 = rows.filter((r) => r.nonce === 1)
  if (at1.length !== 2 || at1.some((r) => r.competing !== 1)) throw new Error('two proposals on nonce 1 must show as competing')
  if (rows.find((r) => r.nonce === 0)?.competing !== 0) throw new Error('nonce 0 has no competitor')
  ok('competing proposals')

  // rejection: the standard Safe self-call with empty data, same nonce, dedupes
  const r1 = await rejectNonce('minting', 1n)
  const r1again = await rejectNonce('minting', 1n)
  if (r1.safeTxHash !== r1again.safeTxHash || r1.nonce !== '1') throw new Error('rejection must target the nonce and dedupe')
  rows = await listPending(['minting'])
  const rej = rows.find((r) => r.safeTxHash === r1.safeTxHash)!
  if (rej.to.toLowerCase() !== SAFE.toLowerCase() || rej.data !== '0x') throw new Error('rejection must be an empty call to the Safe itself')
  if (rows.filter((r) => r.nonce === 1).length !== 3) throw new Error('the rejection competes with the proposals it rejects')
  ok('rejection')

  // approvals, ready, execution makes losers stale, then the queue moves
  const h0 = p0.safeTxHash
  approved.add(`${OWNERS[0]}:${h0}`)
  rows = await listPending(['minting'])
  if (rows.find((r) => r.safeTxHash === h0)!.status !== 'pending') throw new Error('1 of 2 stays pending')
  approved.add(`${OWNERS[2]}:${h0}`)
  approved.add(`${OWNERS[0]}:${r1.safeTxHash}`)
  approved.add(`${OWNERS[1]}:${r1.safeTxHash}`)
  rows = await listPending(['minting'])
  const row0 = rows.find((r) => r.safeTxHash === h0)!
  if (row0.status !== 'ready') throw new Error('threshold met on the next nonce is ready')
  if (rows.find((r) => r.safeTxHash === r1.safeTxHash)!.status !== 'pending') throw new Error('a later nonce waits even with the threshold met')
  if (row0.signatures !== packApprovedHashSignatures([OWNERS[0], OWNERS[2]])) throw new Error('signatures are the approvers, sorted')
  safeNonce = 1n // nonce 0 executed
  rows = await listPending(['minting'])
  if (rows.some((r) => r.nonce === 0)) throw new Error('executed proposals are hidden')
  if (rows.find((r) => r.safeTxHash === r1.safeTxHash)!.status !== 'ready') throw new Error('the approved rejection is next')
  safeNonce = 2n // the rejection executed: p1 and c1 targeted nonce 1, they are stale now
  rows = await listPending(['minting'])
  if (rows.length !== 0) throw new Error('losers of nonce 1 are stale and hidden')
  const all = await listPending(['minting'], true)
  if (!all.filter((r) => r.nonce === 1).every((r) => r.status === 'stale')) throw new Error('competing losers must be stale')
  ok('approvals, ready, stale')

  // the next proposal goes to the Safe nonce
  const next = await proposeToSafe({ ...call, description: 'after' })
  if (next.nonce !== '2') throw new Error(`expected nonce 2, got ${next.nonce}`)
  // a rejection cannot target a used nonce
  await rejects('used nonce', () => rejectNonce('minting', 1n), /already used/)
  ok('next nonce')
}

// ---- 6. Parallel proposals may share a nonce, never lose one ------------------------------------------
{
  safeNonce = 0n
  fakeKv()
  const out = await Promise.all(Array.from({ length: 5 }, (_, i) => proposeToSafe({ ...call, args: [], description: `p${i}`, functionName: 'ping' })))
  const hashes = new Set(out.map((o) => o.safeTxHash))
  // identical calls on the same nonce dedupe to one proposal, which is exactly the double-click case
  if (hashes.size > 5 || hashes.size < 1) throw new Error('unexpected hashes')
  const rows = await listPending(['minting'])
  if (rows.length !== hashes.size) throw new Error('every distinct proposal must be listed')
  ok('parallel proposals')
}

// ---- 7. The panel decoder: decode, recompute, mismatch -------------------------------------------------
{
  const { decodeProposal } = await import('../src/web3/safeDecode.js')
  const { encodeFunctionData, parseAbi } = await import('viem')
  const abi = parseAbi(['function distributeProfit(uint32 period, uint256 profitSen, uint256 epoch, bytes32[] proof)', 'function evil(uint256 x)'])
  const target = '0x2222222222222222222222222222222222222222' as Address
  const data = encodeFunctionData({ abi, functionName: 'distributeProfit', args: [3, 1000n, 7n, []] })
  const d = decodeProposal(target, data, SAFE)
  if (!d.known || d.functionName !== 'distributeProfit' || d.reencoded !== data) throw new Error('known call must decode and re-encode identically')
  const hashOf = (dd: Hex) => safeTxHash(SAFE, { to: target, value: 0n, data: dd, operation: 0, safeTxGas: 0n, baseGas: 0n, gasPrice: 0n, gasToken: '0x0000000000000000000000000000000000000000', refundReceiver: '0x0000000000000000000000000000000000000000', nonce: 0n }, 421614)
  if (hashOf(d.reencoded!) !== hashOf(data)) throw new Error('recomputed hash must equal the hash of the same call')
  // the stored hash of a different call does not match what the panel shows
  const evil = encodeFunctionData({ abi, functionName: 'evil', args: [1n] })
  const storedForEvil = hashOf(evil)
  if (decodeProposal(target, evil, SAFE).known) throw new Error('an unknown function must not decode as known')
  if (hashOf(data) === storedForEvil) throw new Error('hashes of different calls must differ')
  // trailing junk after a valid call: decodes but does not re-encode to the same bytes, so it is not verified
  const junk = (data + 'deadbeef') as Hex
  const dj = decodeProposal(target, junk, SAFE)
  if (dj.known) throw new Error('data with trailing bytes must not verify')
  const rejection = decodeProposal(SAFE, '0x', SAFE)
  if (!rejection.rejection || !rejection.known) throw new Error('rejection must be recognised')
  if (decodeProposal(target, '0x', SAFE).known) throw new Error('an empty call to another address is not a rejection')
  ok('decoder and mismatch guard')
}
globalThis.fetch = realFetch
void arbitrumSepolia
void realRead
console.log('safe-selftest all ok')
