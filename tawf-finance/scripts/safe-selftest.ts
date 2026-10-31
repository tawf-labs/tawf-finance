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
import depJson from '../src/web3/tokenization.deployments.json' with { type: 'json' }
// A call that passes the duty policy (minting allocate on our series) so the fail-closed checks reach the store.
const policyCall = {
  duty: 'minting' as const,
  address: (depJson as Record<string, string>).tawfSeries as Address,
  abi: [{ type: 'function', name: 'allocate', inputs: [{ name: 'investors', type: 'address[]' }, { name: 'epoch', type: 'uint256' }, { name: 'snapshotAt', type: 'uint64' }, { name: 'balance', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [], stateMutability: 'nonpayable' }] as const,
  functionName: 'allocate',
  args: [['0xA000000000000000000000000000000000000001'], 1n, 1n, 1n, []] as const,
  description: 'selftest',
}
const realFetch = globalThis.fetch
delete process.env.DEMO_OPERATOR_KEY // a direct operator send would die with "DEMO_OPERATOR_KEY is not set"
process.env.MINTING_SAFE = '0x3333333333333333333333333333333333333333'
delete process.env.QUICKNODE_API_KEY
await rejects('no store', () => submitAdminTx(policyCall, 421614), /key-value store/)
process.env.QUICKNODE_API_KEY = 'k'
globalThis.fetch = (async () => { throw new Error('store down') }) as typeof fetch
const chainRead = publicClient as unknown as { readContract: unknown; multicall: unknown; getChainId: unknown }
const realRead = chainRead.readContract
chainRead.readContract = async (x: { functionName: string }) => (x.functionName === 'compliance' ? '0x7777777777777777777777777777777777777777' : 0n)
await rejects('store down', () => submitAdminTx(policyCall, 421614), /unreachable|store down/)
process.env.MINTING_SAFE = 'not-an-address'
await rejects('bad env', () => submitAdminTx(policyCall, 421614), /not a valid address/)
delete process.env.MINTING_SAFE
delete process.env.SAFES_REQUIRED
await rejects('required, no safe', () => submitAdminTx(policyCall, 421614), /SAFES_REQUIRED is on/)
process.env.MINTING_SAFE = '   '
await rejects('required, blank safe', () => submitAdminTx(policyCall, 421614), /SAFES_REQUIRED is on/)
delete process.env.MINTING_SAFE
await rejects('42161 no safe', () => submitAdminTx(policyCall, 42161), /never sends minting actions directly/)
process.env.SAFES_REQUIRED = 'false'
await rejects('explicit off, sepolia', () => submitAdminTx(policyCall, 421614), /DEMO_OPERATOR_KEY is not set/)
await rejects('explicit off, other chain', () => submitAdminTx(policyCall, 42161), /never sends minting actions directly/)
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

// ---- 5. Proposals, nonces, dedupe, cap, competing, rejection, policy, live index ----------------------
import deployments from '../src/web3/tokenization.deployments.json' with { type: 'json' }
import { encodeFunctionData, parseAbi } from 'viem'
const dep = deployments as Record<string, string>
const SERIES = dep.tawfSeries as Address
const DISTRIBUTOR = dep.scfDistributor as Address
const USDC = dep.mockUsdc as Address
const SAFE = '0x4444444444444444444444444444444444444444' as Address
process.env.MINTING_SAFE = SAFE
process.env.TREASURY_SAFE = SAFE
process.env.GOV_SAFE = SAFE
process.env.COMPLIANCE_SAFE = SAFE
const OWNERS = ['0xA000000000000000000000000000000000000001', '0xA000000000000000000000000000000000000002', '0xA000000000000000000000000000000000000003'] as Address[]
let safeNonce = 0n
const approved = new Set<string>() // owner:hash
const COMPLIANCE = '0x7777777777777777777777777777777777777777' as Address
chainRead.readContract = async (a: { functionName: string; args?: unknown[] }) => {
  if (a.functionName === 'nonce') return safeNonce
  if (a.functionName === 'getThreshold') return 2n
  if (a.functionName === 'getOwners') return OWNERS
  if (a.functionName === 'compliance') return COMPLIANCE
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
const seriesAbi = parseAbi(['function allocate(address[] investors, uint256 epoch, uint64 snapshotAt, uint256 balance, bytes32[] proof)'])
/** A policy-conforming minting proposal; `i` makes each one a different call. */
const mint = (i: number, description = `mint ${i}`) => ({
  duty: 'minting' as const, address: SERIES, abi: seriesAbi, functionName: 'allocate',
  args: [[OWNERS[0]], BigInt(i), 1n, 1n, []] as const, description,
})
{
  const kv = fakeKv()
  const p0 = await proposeToSafe(mint(0))
  const p1 = await proposeToSafe(mint(1))
  if (p0.nonce !== '0') throw new Error(`first proposal must target the Safe nonce, got ${p0.nonce}`)
  if (p1.nonce !== '1') throw new Error(`second proposal must queue behind, got ${p1.nonce}`)
  ok('queue')

  // AF2b: a double click returns the live twin instead of queuing nonce + 1
  const twin = await proposeToSafe(mint(1, 'clicked again'))
  if (twin.safeTxHash !== p1.safeTxHash || twin.nonce !== '1') throw new Error('a live identical proposal must be returned')
  if (kv.sets.size !== 2) throw new Error(`dedupe must not store a copy, have ${kv.sets.size}`)
  const parallel = await Promise.all([proposeToSafe(mint(9)), proposeToSafe(mint(9)), proposeToSafe(mint(9))])
  if (new Set(parallel.map((x) => x.safeTxHash)).size > 2) throw new Error('parallel double clicks should collapse')
  ok('dedupe double clicks')

  // proposals can still share a nonce when pinned: they compete
  const c1 = await proposeToSafe(mint(100), { nonce: 1n })
  if (c1.safeTxHash === p1.safeTxHash) throw new Error('a different call has a different hash')
  let rows = await listPending(['minting'])
  const at1 = rows.filter((r) => r.nonce === 1)
  if (at1.length !== 2 || at1.some((r) => r.competing !== 1)) throw new Error('two proposals on nonce 1 must show as competing')
  ok('competing proposals')

  // rejection: the standard Safe self-call, same nonce, dedupes
  const r1 = await rejectNonce('minting', 1n)
  const r1again = await rejectNonce('minting', 1n)
  if (r1.safeTxHash !== r1again.safeTxHash || r1.nonce !== '1') throw new Error('rejection must target the nonce and dedupe')
  rows = await listPending(['minting'])
  const rej = rows.find((r) => r.safeTxHash === r1.safeTxHash)!
  if (rej.to.toLowerCase() !== SAFE.toLowerCase() || rej.data !== '0x') throw new Error('rejection must be an empty call to the Safe itself')
  ok('rejection')

  // approvals, ready, execution makes the passed nonce disappear and the losers with it
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
  safeNonce = 1n
  rows = await listPending(['minting'])
  if (rows.some((r) => r.nonce === 0)) throw new Error('executed proposals are not listed')
  if (rows.find((r) => r.safeTxHash === r1.safeTxHash)!.status !== 'ready') throw new Error('the approved rejection is next')
  safeNonce = 2n // the rejection executed: p1 and c1 targeted nonce 1
  rows = await listPending(['minting'])
  if (rows.some((r) => r.nonce === 1)) throw new Error('losers of a passed nonce are not listed')
  ok('approvals, ready, passed nonces drop out')
  await rejects('used nonce', () => rejectNonce('minting', 1n), /already used/)
  const next = await proposeToSafe(mint(500))
  if (Number(next.nonce) < 2) throw new Error(`a new proposal must not land below the Safe nonce, got ${next.nonce}`)
  ok('next nonce')
}

// ---- 6. AF2c: nonce window; AF4b: old pending proposals stay visible -----------------------------------
{
  safeNonce = 0n
  fakeKv()
  const hashes: Hex[] = []
  for (let i = 0; i <= 20; i++) hashes.push((await proposeToSafe(mint(1000 + i))).safeTxHash)
  await rejects('queue full', () => proposeToSafe(mint(2000)), /queue is full/)
  await rejects('pinned beyond window', () => proposeToSafe(mint(2001), { nonce: 21n }), /queue is full/)
  const rows = await listPending(['minting'])
  if (rows.length !== 21) throw new Error(`expected 21 listed, got ${rows.length}`)
  // an old proposal is still listed (and rejectable) 60 days later: the index is by nonce, not by week
  const realNow = Date.now
  Date.now = () => realNow() + 60 * 24 * 3600 * 1000
  const later = await listPending(['minting'])
  Date.now = realNow
  if (later.length !== 21) throw new Error('old pending proposals must stay visible')
  await rejectNonce('minting', 0n) // still reachable
  // the Safe moves on: the passed nonces are not read any more and the window slides
  safeNonce = 5n
  const slid = await listPending(['minting'])
  if (slid.some((r) => r.nonce < 5)) throw new Error('nonces below the Safe nonce must be gone')
  const again = await proposeToSafe(mint(3000))
  if (again.nonce !== '21') throw new Error(`window slid, next free nonce is 21, got ${again.nonce}`)
  ok('nonce window and live index')
}

// ---- 7. AF1b: policy -------------------------------------------------------------------------------------
{
  fakeKv()
  safeNonce = 0n
  const erc20 = parseAbi(['function approve(address spender, uint256 amount)'])
  const dist = parseAbi(['function closeSubscription()'])
  const compl = parseAbi(['function callModuleFunction(bytes callData, address _module)'])
  const sandbox = parseAbi(['function setMode(uint8 mode)', 'function evil(uint256 x)'])
  const refuse = (label: string, c: Parameters<typeof proposeToSafe>[0]) => rejects(label, () => proposeToSafe(c), /Refused/)
  // unknown target
  await refuse('foreign target', { ...mint(1), address: '0x9999999999999999999999999999999999999999' })
  // another duty's function on this duty's Safe
  await refuse('treasury closes nothing on series', { duty: 'minting', address: DISTRIBUTOR, abi: dist, functionName: 'closeSubscription', description: 'x' })
  await refuse('minting cannot do treasury', { duty: 'compliance', address: SERIES, abi: seriesAbi, functionName: 'allocate', args: [[OWNERS[0]], 1n, 1n, 1n, []], description: 'x' })
  // approve: arbitrary spender refused, our distributor accepted
  await refuse('approve arbitrary spender', { duty: 'treasury', address: USDC, abi: erc20, functionName: 'approve', args: ['0x9999999999999999999999999999999999999999', 1n], description: 'x' })
  await refuse('approve on a foreign token', { duty: 'treasury', address: '0x9999999999999999999999999999999999999999', abi: erc20, functionName: 'approve', args: [DISTRIBUTOR, 1n], description: 'x' })
  await proposeToSafe({ duty: 'treasury', address: USDC, abi: erc20, functionName: 'approve', args: [DISTRIBUTOR, 1n], description: 'ok' })
  await proposeToSafe({ duty: 'treasury', address: DISTRIBUTOR, abi: dist, functionName: 'closeSubscription', description: 'ok' })
  // governance: callModuleFunction only to our compliance and only into our sandbox
  const inner = encodeFunctionData({ abi: sandbox, functionName: 'setMode', args: [1] })
  await refuse('foreign module', { duty: 'governance', address: COMPLIANCE, abi: compl, functionName: 'callModuleFunction', args: [inner, '0x9999999999999999999999999999999999999999'], description: 'x' })
  await refuse('foreign compliance', { duty: 'governance', address: '0x9999999999999999999999999999999999999999', abi: compl, functionName: 'callModuleFunction', args: [inner, dep.sandboxModule], description: 'x' })
  await refuse('unknown inner function', { duty: 'governance', address: COMPLIANCE, abi: compl, functionName: 'callModuleFunction', args: [encodeFunctionData({ abi: sandbox, functionName: 'evil', args: [1n] }), dep.sandboxModule], description: 'x' })
  await proposeToSafe({ duty: 'governance', address: COMPLIANCE, abi: compl, functionName: 'callModuleFunction', args: [inner, dep.sandboxModule], description: 'ok' })
  // the guardian proposes nothing but rejections
  process.env.GUARDIAN_SAFE = SAFE
  await refuse('guardian', { duty: 'guardian', address: SERIES, abi: seriesAbi, functionName: 'allocate', args: [[OWNERS[0]], 1n, 1n, 1n, []], description: 'x' })
  await rejectNonce('guardian', 0n)
  ok('duty policy')
}

// ---- 8. The panel decoder: decode, recompute, mismatch, policy verdict ------------------------------------
{
  const { decodeProposal } = await import('../src/web3/safeDecode.js')
  const { checkPolicy, deployedSet } = await import('../src/web3/safePolicy.js')
  const abi = parseAbi(['function distributeProfit(uint32 period, uint256 profitSen, uint256 epoch, bytes32[] proof)', 'function evil(uint256 x)'])
  const target = SERIES
  const data = encodeFunctionData({ abi, functionName: 'distributeProfit', args: [3, 1000n, 7n, []] })
  const d = decodeProposal(target, data, SAFE)
  if (!d.known || d.functionName !== 'distributeProfit' || d.reencoded !== data) throw new Error('known call must decode and re-encode identically')
  const hashOf = (dd: Hex) => safeTxHash(SAFE, { to: target, value: 0n, data: dd, operation: 0, safeTxGas: 0n, baseGas: 0n, gasPrice: 0n, gasToken: '0x0000000000000000000000000000000000000000', refundReceiver: '0x0000000000000000000000000000000000000000', nonce: 0n }, 421614)
  if (hashOf(d.reencoded!) !== hashOf(data)) throw new Error('recomputed hash must equal the hash of the same call')
  const evil = encodeFunctionData({ abi, functionName: 'evil', args: [1n] })
  if (decodeProposal(target, evil, SAFE).known) throw new Error('an unknown function must not decode as known')
  if (hashOf(data) === hashOf(evil)) throw new Error('hashes of different calls must differ')
  if (decodeProposal(target, (data + 'deadbeef') as Hex, SAFE).known) throw new Error('data with trailing bytes must not verify')
  const rejection = decodeProposal(SAFE, '0x', SAFE)
  if (!rejection.rejection || !rejection.known) throw new Error('rejection must be recognised')
  if (decodeProposal(target, '0x', SAFE).known) throw new Error('an empty call to another address is not a rejection')
  // the panel's policy verdict: right duty and our target passes, anything else is red
  const set = deployedSet(dep, [COMPLIANCE])
  if (!checkPolicy('treasury', SAFE, target, d, set).ok) throw new Error('treasury distributeProfit on our series is allowed')
  if (checkPolicy('minting', SAFE, target, d, set).ok) throw new Error('minting may not distribute profit')
  if (checkPolicy('treasury', SAFE, '0x9999999999999999999999999999999999999999', d, set).ok) throw new Error('foreign target must be refused')
  if (!checkPolicy('guardian', SAFE, SAFE, rejection, set).ok) throw new Error('a rejection is allowed for any duty')
  if (checkPolicy('treasury', SAFE, target, rejection, set).ok) throw new Error('a rejection to another address is refused')
  ok('decoder, mismatch guard and policy verdict')
}
globalThis.fetch = realFetch
void arbitrumSepolia
void realRead
console.log('safe-selftest all ok')
