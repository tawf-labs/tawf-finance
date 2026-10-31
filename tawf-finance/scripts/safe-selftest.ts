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
// 5. No Safe on Arbitrum Sepolia: the operator path is attempted (it fails here only for the missing key).
await rejects('testnet fallback', () => submitAdminTx(call, 421614), /DEMO_OPERATOR_KEY is not set/)
globalThis.fetch = realFetch
console.log('safe-selftest fail-closed ok')
