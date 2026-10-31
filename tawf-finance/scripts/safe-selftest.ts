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
