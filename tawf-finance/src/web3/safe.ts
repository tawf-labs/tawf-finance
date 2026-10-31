/**
 * Gnosis Safe helpers shared by the admin UI and the API. No hosted Safe service is used: Arbitrum
 * Sepolia has none. Owners approve a transaction ON CHAIN with Safe.approveHash(hash) and anyone
 * executes it with Safe.execTransaction once the threshold of approved hashes is reached.
 *
 * Canonical Safe v1.4.1 deployments on Arbitrum Sepolia (421614), from safe-deployments:
 *   SafeProxyFactory 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67
 *   Safe             0x41675C099F32341bf84BFc5382aF534df5C7461a
 *   SafeL2           0x29fcB43b46531BcA003ddC8FCB67FFE91900C762
 */
import { concat, hashTypedData, pad, type Address, type Hex } from 'viem';

export const SAFE_PROXY_FACTORY_421614 = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as const;
export const SAFE_SINGLETON_421614 = '0x41675C099F32341bf84BFc5382aF534df5C7461a' as const;
export const SAFE_L2_SINGLETON_421614 = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762' as const;

export const safeAbi = [
  { type: 'function', name: 'nonce', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getThreshold', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getOwners', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { type: 'function', name: 'isOwner', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'bool' }] },
  {
    type: 'function',
    name: 'approvedHashes',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'hash', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  { type: 'function', name: 'approveHash', stateMutability: 'nonpayable', inputs: [{ name: 'hashToApprove', type: 'bytes32' }], outputs: [] },
  {
    type: 'function',
    name: 'getTransactionHash',
    stateMutability: 'view',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: '_nonce', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'execTransaction',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

export const SAFE_TX_TYPES = {
  SafeTx: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'operation', type: 'uint8' },
    { name: 'safeTxGas', type: 'uint256' },
    { name: 'baseGas', type: 'uint256' },
    { name: 'gasPrice', type: 'uint256' },
    { name: 'gasToken', type: 'address' },
    { name: 'refundReceiver', type: 'address' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

export interface SafeTxMessage {
  to: Address;
  value: bigint;
  data: Hex;
  operation: 0 | 1;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Address;
  refundReceiver: Address;
  nonce: bigint;
}

/** EIP-712 hash owners approve (identical to GnosisSafe.getTransactionHash). */
export function safeTxHash(safe: Address, tx: SafeTxMessage, chainId: number): Hex {
  return hashTypedData({
    domain: { chainId, verifyingContract: safe },
    types: SAFE_TX_TYPES,
    primaryType: 'SafeTx',
    message: tx,
  });
}

/**
 * Safe signatures for owners that approved the hash on chain: per owner `r = owner (left padded to 32
 * bytes), s = 0, v = 1`, sorted by owner address ascending, as checkNSignatures requires.
 */
export function packApprovedHashSignatures(owners: readonly Address[]): Hex {
  const sorted = [...owners].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
  return concat(sorted.map((o) => concat([pad(o, { size: 32 }), pad('0x', { size: 32 }), '0x01'])));
}
