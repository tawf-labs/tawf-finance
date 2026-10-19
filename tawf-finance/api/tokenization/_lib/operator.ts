/**
 * Server-side operator context for the tokenization serverless functions.
 *
 * Holds the viem clients for Arbitrum Sepolia (where the T-REX tokens, the
 * controller and the distributors live) and for the Tawf Network L3 (where the
 * ReserveLedger records placements and reserve snapshots). The demo operator
 * key controls every on-chain role; the Tawf Network RPC may sit behind a
 * bearer-token proxy. The relayer serves Merkle proofs; the bprs-connector
 * drives the core-banking sync.
 *
 * Deployments are imported with a JSON import attribute, which Vercel's ESM
 * Node runtime requires.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  encodeAbiParameters,
  stringToHex,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import deployments from '../../../src/web3/tokenization.deployments.json' with { type: 'json' }

const ARB_RPC_URL = process.env.ARB_SEPOLIA_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc'

export const RELAYER_URL = (process.env.RELAYER_URL ?? '').replace(/\/$/, '')
export const CONNECTOR_URL = (process.env.CONNECTOR_URL ?? '').replace(/\/$/, '')
export const CONNECTOR_API_KEY = process.env.CONNECTOR_API_KEY ?? ''

const ZERO = '0x0000000000000000000000000000000000000000'

function operatorKey(): Hex {
  const k = process.env.DEMO_OPERATOR_KEY
  if (!k) throw new Error('DEMO_OPERATOR_KEY is not set')
  return (k.startsWith('0x') ? k : `0x${k}`) as Hex
}

export const account = () => privateKeyToAccount(operatorKey())

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(ARB_RPC_URL),
})

export const walletClient = () =>
  createWalletClient({
    account: account(),
    chain: arbitrumSepolia,
    transport: http(ARB_RPC_URL),
  })

// --- Tawf Network L3 (read-only; behind an optional bearer-token proxy) ------

function ledgerTransport() {
  const url = process.env.TAWF_NETWORK_RPC_URL
  if (!url) throw new Error('TAWF_NETWORK_RPC_URL is not set')
  const token = process.env.TAWF_NETWORK_RPC_TOKEN
  return http(url, token ? { fetchOptions: { headers: { Authorization: `Bearer ${token}` } } } : undefined)
}

const ledgerChain = defineChain({
  id: Number(deployments.ledgerChainId ?? 7142026),
  name: 'Tawf Network',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.TAWF_NETWORK_RPC_URL ?? ''] } },
})

export const ledgerClient = () =>
  createPublicClient({ chain: ledgerChain, transport: ledgerTransport() })

/**
 * Write-capable client for the Tawf Network L3, signing with
 * TAWF_NETWORK_OPERATOR_KEY (the account that holds OPERATOR_ROLE on the
 * SukukLedger). Used to record on the L3 a fact observed on Arbitrum One, such
 * as markIssued after the subscription closes Active. Returns null when the
 * key is not configured, so callers can degrade gracefully.
 */
export function ledgerWalletClient() {
  const url = process.env.TAWF_NETWORK_RPC_URL
  const key = process.env.TAWF_NETWORK_OPERATOR_KEY
  if (!url || !key) return null
  const operator = privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as Hex)
  return createWalletClient({ account: operator, chain: ledgerChain, transport: ledgerTransport() })
}

/** SukukLedger address on the L3, from env (the ledger lives in tawf-network). */
export function sukukLedgerAddress(): Address | null {
  const addr = process.env.SUKUK_LEDGER
  return addr ? (addr as Address) : null
}

/** ReserveLedger address on the L3, from env (the ledger lives in tawf-network). */
export function reserveLedgerAddress(): Address {
  const addr = process.env.RESERVE_LEDGER
  if (!addr) throw new Error('RESERVE_LEDGER is not set')
  return addr as Address
}

// --- Deployed addresses + ids ------------------------------------------------

export const addresses = {
  chainId: deployments.chainId,
  ledgerChainId: BigInt(deployments.ledgerChainId ?? 7142026),
  anchor: deployments.anchor as Address,
  operator: deployments.operator as Address,
  mockUsdc: deployments.mockUsdc as Address,
  identityRegistry: deployments.identityRegistry as Address,
  claimIssuer: deployments.claimIssuer as Address,
  implementationAuthority: deployments.implementationAuthority as Address,
  kycClaimTopic: BigInt(deployments.kycClaimTopic ?? 1),
  tawfScreenedTopic: BigInt(deployments.tawfScreenedTopic ?? 2),
  ojkSandboxTopic: BigInt(deployments.ojkSandboxTopic ?? 3),
  identityProxyBytecode: (deployments.identityProxyBytecode ?? '0x') as Hex,
  // Tawf deposito series (Model B)
  tawfSeries: (deployments.tawfSeries ?? ZERO) as Address,
  tawfSeriesToken: (deployments.tawfSeriesToken ?? ZERO) as Address,
  tawfSeriesId: (deployments.tawfSeriesId ?? ZERO) as Hex,
  sandboxModule: (deployments.sandboxModule ?? ZERO) as Address,
  fxInitialRate: BigInt(deployments.fxInitialRate ?? 0),
  // sukuk
  sukukToken: deployments.sukukToken as Address,
  sukukDistributor: deployments.sukukDistributor as Address,
  sukukId: deployments.sukukId as Hex,
}

export function isConfigured(): boolean {
  return addresses.tawfSeries !== ZERO && addresses.sukukDistributor !== ZERO
}

// --- Guards ------------------------------------------------------------------

export function methodGuard(req: VercelRequest, res: VercelResponse, method = 'POST'): boolean {
  if (req.method !== method) {
    res.status(405).json({ error: 'Method not allowed' })
    return false
  }
  return true
}

/** Compares x-demo-passcode to DEMO_PASSCODE; responds 401 and returns false if invalid. */
export function requirePasscode(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.DEMO_PASSCODE
  const got = req.headers['x-demo-passcode']
  if (!expected || got !== expected) {
    res.status(401).json({ error: 'Invalid or missing demo passcode' })
    return false
  }
  return true
}

// --- Leaf + proof helpers ----------------------------------------------------

/** keccak256 of a dotted leaf-kind name, e.g. "tawf.deposito.placement". */
export function kind(name: string): Hex {
  return keccak256(stringToHex(name))
}

/**
 * Canonical ledger leaf hash, identical to contracts/src/lib/LedgerLeaf.sol:
 * keccak256(keccak256(abi.encode(ledgerChainId, kind, subject, a, b))).
 */
export function leafHash(kindHash: Hex, subject: Hex, a: bigint, b: bigint): Hex {
  const inner = keccak256(
    encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }],
      [addresses.ledgerChainId, kindHash, subject, a, b],
    ),
  )
  return keccak256(inner)
}

export interface RelayerProof {
  epoch: string
  leaf: Hex
  proof: Hex[]
  root: Hex
}

/** Ask the relayer to compute and prove a leaf. Returns null if not anchored. */
export async function fetchLeafProof(
  kindName: string,
  subject: Hex,
  a: bigint,
  b: bigint,
): Promise<RelayerProof | null> {
  if (!RELAYER_URL) throw new Error('RELAYER_URL is not set')
  const params = new URLSearchParams({ kind: kindName, subject, a: a.toString(), b: b.toString() })
  const res = await fetch(`${RELAYER_URL}/leaf?${params.toString()}`)
  if (res.status === 400 || res.status === 404) return null
  if (!res.ok) throw new Error(`Relayer error (${res.status})`)
  return (await res.json()) as RelayerProof
}

/** Prove an already-computed leaf hash. Returns null if not anchored yet. */
export async function fetchProofForLeaf(leaf: Hex): Promise<RelayerProof | null> {
  if (!RELAYER_URL) throw new Error('RELAYER_URL is not set')
  const res = await fetch(`${RELAYER_URL}/proof?leaf=${leaf}`)
  if (res.status === 400 || res.status === 404) return null
  if (!res.ok) throw new Error(`Relayer error (${res.status})`)
  return (await res.json()) as RelayerProof
}

// --- Readable custom-error mapping -------------------------------------------

export function readableError(err: unknown): string {
  const anyErr = err as {
    shortMessage?: string
    message?: string
    cause?: { data?: { errorName?: string } }
  }
  const name = anyErr?.cause?.data?.errorName
  switch (name) {
    case 'ReserveInsufficient':
      return 'The anchored account balance does not cover this supply. Refresh the reserve first.'
    case 'ReserveNotNewer':
      return 'A newer reserve snapshot is already recorded on chain.'
    case 'RateStale':
      return 'The posted FX rate is stale. Post a fresh USDC/IDR rate first.'
    case 'RateUnset':
      return 'No FX rate is posted yet. Post a USDC/IDR rate first.'
    case 'NotEligible':
      return 'This wallet is not eligible: it needs a verified identity (run the faucet), and for the Tawf series it must also pass the series mode (PILOT only / screened group / OJK sandbox).'
    case 'NoPending':
      return 'No pending subscription to cancel.'
    case 'ProfitPeriodNotSequential':
      return 'Distribute the next profit period in order.'
    case 'PlacementAlreadyUsed':
      return 'This placement is already tokenized.'
    case 'UnknownProduct':
      return 'Unknown product id.'
    case 'ProofInvalid':
      return 'The Merkle proof did not verify against the anchored root.'
    case 'StaleReserve':
      return 'A newer reserve snapshot is already recorded on chain.'
    case 'WrongStatus':
      return 'The sukuk is not in the right state for this action.'
    case 'ExceedsFaceValue':
      return 'This would exceed the sukuk face value.'
    case 'BelowMinimum':
      return 'Below the minimum subscription.'
  }
  if (/not verified|not eligible/i.test(anyErr?.message ?? '')) {
    return 'Recipient is not a verified identity. Run the faucet for that wallet first.'
  }
  return anyErr?.shortMessage ?? anyErr?.message ?? 'Transaction failed'
}
