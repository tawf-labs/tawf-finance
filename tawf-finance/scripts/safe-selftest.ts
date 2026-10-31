/**
 * Offline check of the Safe transaction hash used by api/_tokenization/_lib/safe.ts.
 * Run: DEMO_OPERATOR_KEY=0x01 npx tsx scripts/safe-selftest.ts
 * Recomputes the hash by hand (SafeTx typehash, domain separator, 0x1901 prefix) and compares it
 * with the viem EIP-712 hash, and checks the SafeTx typehash against the constant in GnosisSafe.sol.
 */
import { concat, encodeAbiParameters, keccak256, toHex, type Address, type Hex } from 'viem'
import { safeTxHash, type SafeTxMessage } from '../api/_tokenization/_lib/safe.js'

const SAFE_TX_TYPEHASH = keccak256(
  toHex('SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)'),
)
const DOMAIN_TYPEHASH = keccak256(toHex('EIP712Domain(uint256 chainId,address verifyingContract)'))
const KNOWN_SAFE_TX_TYPEHASH = '0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8'

const safe = '0x1111111111111111111111111111111111111111' as Address
const tx: SafeTxMessage = {
  to: '0x2222222222222222222222222222222222222222',
  value: 0n,
  data: '0xdeadbeef',
  operation: 0,
  safeTxGas: 0n,
  baseGas: 0n,
  gasPrice: 0n,
  gasToken: '0x0000000000000000000000000000000000000000',
  refundReceiver: '0x0000000000000000000000000000000000000000',
  nonce: 7n,
}
const chainId = 421614

if (SAFE_TX_TYPEHASH !== KNOWN_SAFE_TX_TYPEHASH) throw new Error(`SafeTx typehash mismatch: ${SAFE_TX_TYPEHASH}`)

const domainSeparator = keccak256(
  encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }], [DOMAIN_TYPEHASH, BigInt(chainId), safe]),
)
const structHash = keccak256(
  encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'uint256' }],
    [SAFE_TX_TYPEHASH, tx.to, tx.value, keccak256(tx.data), tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.nonce],
  ),
)
const manual: Hex = keccak256(concat(['0x1901', domainSeparator, structHash]))
const lib = safeTxHash(safe, tx, chainId)
if (manual !== lib) throw new Error(`hash mismatch: manual ${manual} lib ${lib}`)
console.log('safe-selftest ok', lib)

// ---- Fail-closed rules for submitAdminTx --------------------------------------------------
import { submitAdminTx } from '../api/_tokenization/_lib/safe.js'

const call = {
  duty: 'minting' as const,
  address: '0x2222222222222222222222222222222222222222' as Address,
  abi: [{ type: 'function', name: 'ping', inputs: [], outputs: [], stateMutability: 'nonpayable' }] as const,
  functionName: 'ping',
  description: 'selftest',
}
async function rejects(label: string, run: () => Promise<unknown>, match: RegExp) {
  try {
    await run()
  } catch (e) {
    const msg = (e as Error).message
    if (!match.test(msg)) throw new Error(`${label}: wrong error: ${msg}`)
    return
  }
  throw new Error(`${label}: expected a rejection`)
}

process.env.SAFE_TX_SERVICE_URL = 'http://safe.test/tx-service'
const realFetch = globalThis.fetch
delete process.env.DEMO_OPERATOR_KEY // a direct operator send would die with "DEMO_OPERATOR_KEY is not set"
process.env.MINTING_SAFE = '0x3333333333333333333333333333333333333333'
// 1. Safe set, Transaction Service down: error from the service, never an operator send.
globalThis.fetch = (async () => { throw new Error('service down') }) as typeof fetch
await rejects('service down', () => submitAdminTx(call, 421614), /service down|Safe Transaction Service/)
// 2. Safe set, Transaction Service answers 500.
globalThis.fetch = (async () => new Response('boom', { status: 500 })) as typeof fetch
await rejects('service 500', () => submitAdminTx(call, 421614), /Safe Transaction Service 500/)
// 3. Safe env set to garbage: error, no fallback.
process.env.MINTING_SAFE = 'not-an-address'
await rejects('bad env', () => submitAdminTx(call, 421614), /not a valid address/)
// 4. No Safe on another chain: fail closed.
delete process.env.MINTING_SAFE
await rejects('mainnet no safe', () => submitAdminTx(call, 42161), /never sends minting actions directly/)
// 5. No Safe on Arbitrum Sepolia and SAFES_REQUIRED on (the default): error, no operator send.
delete process.env.SAFES_REQUIRED
await rejects('required on, no safe', () => submitAdminTx(call, 421614), /SAFES_REQUIRED is on/)
process.env.MINTING_SAFE = '   ' // blank is the same as missing
await rejects('required on, blank safe', () => submitAdminTx(call, 421614), /SAFES_REQUIRED is on/)
delete process.env.MINTING_SAFE
// 6. Explicitly off on Arbitrum Sepolia only: the operator path is attempted (fails here only for the missing key).
process.env.SAFES_REQUIRED = 'false'
await rejects('explicit off on sepolia', () => submitAdminTx(call, 421614), /DEMO_OPERATOR_KEY is not set/)
// 7. The switch cannot be turned off anywhere else.
await rejects('off does not help on 42161', () => submitAdminTx(call, 42161), /never sends minting actions directly/)
delete process.env.SAFES_REQUIRED
globalThis.fetch = realFetch
console.log('safe-selftest fail-closed ok')

// ---- Test ClaimIssuer is testnet only ---------------------------------------------------
import { selfServiceIssuer } from '../api/_tokenization/_lib/identity.js'
try {
  selfServiceIssuer(42161)
  throw new Error('selfServiceIssuer must refuse a non-Sepolia chain')
} catch (e) {
  if (!/testnet only/.test((e as Error).message)) throw e
}
console.log('safe-selftest test-issuer chain guard ok')

// ---- Test registry agent is testnet only ------------------------------------------------
import { selfServiceAgent } from '../api/_tokenization/_lib/identity.js'
try {
  selfServiceAgent(42161)
  throw new Error('selfServiceAgent must refuse a non-Sepolia chain')
} catch (e) {
  if (!/testnet only/.test((e as Error).message)) throw e
}
console.log('safe-selftest test-registry-agent chain guard ok')

// ---- SAFES_REQUIRED for the test issuer / agent, live chain check --------------------------
import { safesRequired, assertLiveChain } from '../api/_tokenization/_lib/safe.js'
import { publicClient } from '../api/_tokenization/_lib/operator.js'
delete process.env.SAFES_REQUIRED
if (!safesRequired(421614) || !safesRequired(42161)) throw new Error('SAFES_REQUIRED must be on by default')
process.env.SAFES_REQUIRED = 'false'
if (safesRequired(421614) !== false) throw new Error('explicit false must switch it off on 421614')
if (safesRequired(42161) !== true) throw new Error('explicit false must not switch it off elsewhere')
delete process.env.SAFES_REQUIRED
// no testClaimIssuer / testRegistryAgent in deployments yet -> error while required
for (const [name, fn] of [['issuer', () => selfServiceIssuer(421614)], ['agent', () => selfServiceAgent(421614)]] as const) {
  try {
    fn()
    throw new Error(`${name}: expected an error with SAFES_REQUIRED on`)
  } catch (e) {
    if (!/SAFES_REQUIRED is on/.test((e as Error).message)) throw e
  }
}
process.env.SAFES_REQUIRED = 'false'
selfServiceIssuer(421614)
process.env.DEMO_OPERATOR_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001'
selfServiceAgent(421614) // legacy operator fallback allowed when explicitly off on Sepolia
delete process.env.SAFES_REQUIRED
// live RPC chain id differing from deployments.json is an error
;(publicClient as unknown as { getChainId: () => Promise<number> }).getChainId = async () => 1
await rejects('live chain mismatch', () => assertLiveChain(), /differs from deployments\.json/)
console.log('safe-selftest SAFES_REQUIRED + live chain ok')

// ---- Concurrent proposals get distinct nonces ---------------------------------------------
import { proposeToSafe, listPending } from '../api/_tokenization/_lib/safe.js'
const SAFE = '0x4444444444444444444444444444444444444444'
process.env.MINTING_SAFE = SAFE
process.env.TREASURY_SAFE = '0x5555555555555555555555555555555555555555'
interface FakeTx { nonce: number; safeTxHash: string; origin: unknown }
function fakeService(opts: { foreignOnce?: boolean } = {}) {
  const txs: FakeTx[] = []
  let injected = false
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.pathname.replace('/tx-service', '')
    await sleep(Math.random() * 15) // let requests interleave
    const method = init?.method ?? 'GET'
    if (method === 'GET' && /\/api\/v1\/safes\/0x[0-9a-fA-F]{40}\/$/.test(path)) return json({ nonce: 0 })
    if (method === 'GET' && path.endsWith('/multisig-transactions/')) {
      const q = url.searchParams
      if (q.get('nonce') !== null) return json({ results: txs.filter((t) => t.nonce === Number(q.get('nonce'))) })
      if (q.get('ordering') === '-nonce') return json({ results: [...txs].sort((a, b) => b.nonce - a.nonce).slice(0, 1) })
      return json({ results: txs })
    }
    if (method === 'POST' && path.endsWith('/multisig-transactions/')) {
      const b = JSON.parse(String(init?.body))
      txs.push({ nonce: Number(b.nonce), safeTxHash: b.contractTransactionHash, origin: b.origin })
      if (opts.foreignOnce && !injected) {
        injected = true // another instance wins the same nonce right after us
        txs.push({ nonce: Number(b.nonce), safeTxHash: '0x' + 'ab'.repeat(32), origin: '{}' })
      }
      return json({})
    }
    if (method === 'DELETE') {
      const hash = path.split('/').filter(Boolean).pop()!
      const i = txs.findIndex((t) => t.safeTxHash === hash)
      if (i >= 0) txs.splice(i, 1)
      return json({})
    }
    return new Response('unexpected ' + method + ' ' + path, { status: 404 })
  }) as typeof fetch
  return txs
}
process.env.DEMO_OPERATOR_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001'
{
  const txs = fakeService()
  const out = await Promise.all(Array.from({ length: 5 }, (_, i) => proposeToSafe({ ...call, description: `p${i}` })))
  const nonces = out.map((o) => Number(o.nonce)).sort((a, b) => a - b)
  if (nonces.join() !== '0,1,2,3,4') throw new Error(`parallel nonces not distinct: ${nonces.join()}`)
  if (txs.length !== 5) throw new Error('expected 5 queued txs')
  console.log('safe-selftest 5 parallel proposals ok', nonces.join())
}
{
  const txs = fakeService({ foreignOnce: true }) // cross-instance clash on the first nonce
  const out = await proposeToSafe(call)
  if (Number(out.nonce) !== 1) throw new Error(`expected a retry on nonce 1, got ${out.nonce}`)
  if (new Set(txs.map((t) => t.nonce)).size !== txs.length) throw new Error('a nonce is shared after the retry')
  console.log('safe-selftest conflict retry ok')
}
{
  // The pending note may be a string, a JSON string, an object or junk: always a string or null.
  const txs = fakeService()
  txs.push({ nonce: 0, safeTxHash: '0x' + '01'.repeat(32), origin: { note: { deep: 1 } } })
  txs.push({ nonce: 1, safeTxHash: '0x' + '02'.repeat(32), origin: JSON.stringify({ note: 'ok' }) })
  txs.push({ nonce: 2, safeTxHash: '0x' + '03'.repeat(32), origin: 42 })
  const rows = await listPending(['minting'])
  for (const r of rows) if (r.note !== null && typeof r.note !== 'string') throw new Error('note must be a string')
  console.log('safe-selftest pending note strings ok')
}
