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
  nonceManager,
  keccak256,
  encodeAbiParameters,
  stringToHex,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { safeEqual } from './qn-auth.js'
import { arbitrumSepolia } from 'viem/chains'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import deployments from '../../../src/web3/tokenization.deployments.json' with { type: 'json' }

const ARB_RPC_URL = process.env.ARB_SEPOLIA_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc'

export const RELAYER_URL = (process.env.RELAYER_URL ?? '').replace(/\/$/, '')
export const CONNECTOR_URL = (process.env.CONNECTOR_URL ?? '').replace(/\/$/, '')

/**
 * fetch with a deadline. The relayer and connector run on the Tawf Network
 * host; if it is unreachable a plain fetch hangs until the platform kills the
 * function, so reads give up after 10s and connector writes (which wait for
 * L3 receipts) after 60s.
 */
export function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 10_000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
}
export const CONNECTOR_API_KEY = process.env.CONNECTOR_API_KEY ?? ''

const ZERO = '0x0000000000000000000000000000000000000000'

function operatorKey(): Hex {
  const k = process.env.DEMO_OPERATOR_KEY
  if (!k) throw new Error('DEMO_OPERATOR_KEY is not set')
  return (k.startsWith('0x') ? k : `0x${k}`) as Hex
}

/**
 * The operator account. viem's nonceManager remembers the last nonce it
 * handed out (per address, for the life of the warm function), so a run of
 * transactions does not reuse a nonce when the RPC's pending count lags.
 */
export const account = () => privateKeyToAccount(operatorKey(), { nonceManager })

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(ARB_RPC_URL),
})

const NONCE_RETRIES = 2

/**
 * Whether the node rejected a transaction because its nonce was already used.
 * Such a transaction was never accepted, so sending it again with a fresh
 * nonce cannot double an action. ("already known" is not matched: that one
 * may already be in the mempool.)
 */
export function isNonceTooLow(err: unknown): boolean {
  for (let e = err as { message?: string; details?: string; cause?: unknown } | undefined, i = 0; e && i < 6; e = e.cause as typeof e, i++) {
    if (/nonce too low|nonce provided for the transaction is lower than/i.test(`${e.message ?? ''} ${e.details ?? ''}`)) return true
  }
  return false
}

/** Retry `fn` when the node rejects the nonce, after resetting the nonce cache. */
function withNonceRetry<F extends (...args: never[]) => Promise<unknown>>(fn: F, address: Address): F {
  return (async (...args: Parameters<F>) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn(...args)
      } catch (err) {
        if (attempt >= NONCE_RETRIES || !isNonceTooLow(err)) throw err
        nonceManager.reset({ address, chainId: arbitrumSepolia.id })
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
      }
    }
  }) as F
}

/**
 * Wallet client for the operator. Sends that the node rejects for a stale
 * nonce are retried (up to twice, with a short backoff) after the nonce cache
 * is reset, so a lagging public RPC does not fail a multi-step route.
 */
export const walletClient = () => {
  const acct = account()
  const wc = createWalletClient({
    account: acct,
    chain: arbitrumSepolia,
    transport: http(ARB_RPC_URL),
  })
  wc.writeContract = withNonceRetry(wc.writeContract, acct.address)
  wc.sendTransaction = withNonceRetry(wc.sendTransaction, acct.address)
  wc.deployContract = withNonceRetry(wc.deployContract, acct.address)
  return wc
}

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

/**
 * Write-capable L3 client for the Shariah board (DPS) role-play in the demo,
 * signing with TAWF_NETWORK_DPS_KEY. Null when the key is not configured.
 */
export function boardWalletClient() {
  const url = process.env.TAWF_NETWORK_RPC_URL
  const key = process.env.TAWF_NETWORK_DPS_KEY
  if (!url || !key) return null
  const board = privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as Hex)
  return createWalletClient({ account: board, chain: ledgerChain, transport: ledgerTransport() })
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
  mockUsdt: (deployments.mockUsdt ?? ZERO) as Address,
  // Mock USDG the pool vault settles in on testnet (a MockUSDC instance, same faucet ABI).
  mockUsdg: ((deployments as Record<string, unknown>).mockUsdg ?? ZERO) as Address,
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
  fxInitialRateUsdc: BigInt(deployments.fxInitialRateUsdc ?? 0),
  fxInitialRateUsdt: BigInt(deployments.fxInitialRateUsdt ?? 0),
  // sukuk
  sukukToken: deployments.sukukToken as Address,
  sukukDistributor: deployments.sukukDistributor as Address,
  sukukId: deployments.sukukId as Hex,
  // Second, short-dated sukuk used for maturity tests (optional).
  sukuk2Token: ((deployments as Record<string, unknown>).sukuk2Token ?? ZERO) as Address,
  sukuk2Distributor: ((deployments as Record<string, unknown>).sukuk2Distributor ?? ZERO) as Address,
  sukuk2Id: ((deployments as Record<string, unknown>).sukuk2Id ?? ZERO) as Hex,
  // Securities crowdfunding (SCF) offering: its own operator-gated anchor and
  // the POJK 57/2020 investor-limit module (optional).
  scfAnchor: ((deployments as Record<string, unknown>).scfAnchor ?? ZERO) as Address,
  scfLimitModule: ((deployments as Record<string, unknown>).scfLimitModule ?? ZERO) as Address,
  scfToken: ((deployments as Record<string, unknown>).scfToken ?? ZERO) as Address,
  scfCompliance: ((deployments as Record<string, unknown>).scfCompliance ?? ZERO) as Address,
  scfDistributor: ((deployments as Record<string, unknown>).scfDistributor ?? ZERO) as Address,
  scfId: ((deployments as Record<string, unknown>).scfId ?? ZERO) as Hex,
}

/** Regional Tawf Deposito Pool (optional): a series whose anchor is a DepositoPoolLedger. */
const rawDeployments = deployments as Record<string, unknown>
export const pool = {
  series: (rawDeployments.depositoPool ?? ZERO) as Address,
  token: (rawDeployments.depositoPoolToken ?? ZERO) as Address,
  sandbox: (rawDeployments.depositoPoolSandbox ?? ZERO) as Address,
  ledger: (rawDeployments.depositoPoolLedger ?? ZERO) as Address,
  seriesId: (rawDeployments.depositoPoolId ?? ZERO) as Hex,
}

export function isPoolConfigured(): boolean {
  return pool.series !== ZERO && pool.ledger !== ZERO
}

export interface SeriesTarget {
  series: Address
  token: Address
  sandbox: Address
  seriesId: Hex
  isPool: boolean
}

/**
 * The deposito series a request targets: `series=pool` (query or body)
 * selects the regional Deposito Pool, anything else the BPRS Demo series 1.
 */
export function seriesTarget(req: VercelRequest): SeriesTarget {
  const pick = String((req.query?.series as string | undefined) ?? (req.body?.series as string | undefined) ?? '')
  if (pick === 'pool' && isPoolConfigured()) {
    return { series: pool.series, token: pool.token, sandbox: pool.sandbox, seriesId: pool.seriesId, isPool: true }
  }
  return {
    series: addresses.tawfSeries,
    token: addresses.tawfSeriesToken,
    sandbox: addresses.sandboxModule,
    seriesId: addresses.tawfSeriesId,
    isPool: false,
  }
}

/** Whether the SCF offering is deployed. */
export function isScfConfigured(): boolean {
  return addresses.scfDistributor !== ZERO && addresses.scfLimitModule !== ZERO && addresses.scfAnchor !== ZERO
}

/** The sukuk a request targets: `sukuk=2` (query or body) selects the test sukuk. */
export function sukukTarget(req: VercelRequest): { distributor: Address; token: Address; sukukId: Hex; which: 1 | 2 } {
  const pick = String((req.query?.sukuk as string | undefined) ?? (req.body?.sukuk as string | number | undefined) ?? '1')
  if (pick === '2' && addresses.sukuk2Distributor !== ZERO) {
    return { distributor: addresses.sukuk2Distributor, token: addresses.sukuk2Token, sukukId: addresses.sukuk2Id, which: 2 }
  }
  return { distributor: addresses.sukukDistributor, token: addresses.sukukToken, sukukId: addresses.sukukId, which: 1 }
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
  if (!safeEqual(got, expected)) {
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
  const res = await fetchWithTimeout(`${RELAYER_URL}/leaf?${params.toString()}`)
  if (res.status === 400 || res.status === 404) return null
  if (!res.ok) throw new Error(`Relayer error (${res.status})`)
  return (await res.json()) as RelayerProof
}

/** Prove an already-computed leaf hash. Returns null if not anchored yet. */
export async function fetchProofForLeaf(leaf: Hex): Promise<RelayerProof | null> {
  if (!RELAYER_URL) throw new Error('RELAYER_URL is not set')
  const res = await fetchWithTimeout(`${RELAYER_URL}/proof?leaf=${leaf}`)
  if (res.status === 400 || res.status === 404) return null
  if (!res.ok) throw new Error(`Relayer error (${res.status})`)
  return (await res.json()) as RelayerProof
}

// --- Readable custom-error mapping -------------------------------------------

// Env values that must never reach an API response: RPC URLs carry provider keys.
const SECRET_ENV = [
  'ARB_SEPOLIA_RPC_URL',
  'ETHERSCAN_API_KEY',
  'QUICKNODE_API_KEY',
  'QN_STREAM_TOKEN',
  'QN_ALERT_TOKEN',
  'ACTIVITY_RPC_URL',
  'TAWF_NETWORK_RPC_URL',
  'TAWF_NETWORK_RPC_TOKEN',
  'TAWF_NETWORK_DPS_KEY',
  'TAWF_NETWORK_OPERATOR_KEY',
  'DEMO_OPERATOR_KEY',
  'CONNECTOR_API_KEY',
  'RELAYER_URL',
  'CONNECTOR_URL',
  'DIDIT_API_KEY',
  'DIDIT_WEBHOOK_SECRET',
  'DEMO_PASSCODE',
]

/** Strip URLs, secret env values and 32-byte hex keys from text sent to clients. */
export function redact(text: string): string {
  let out = text
  for (const name of SECRET_ENV) {
    const v = process.env[name]
    if (v && v.length >= 8) out = out.split(v).join('[redacted]')
  }
  return out
    .replace(/\b(?:https?|wss?):\/\/[^\s"'<>]+/gi, '[rpc]')
    .replace(/\b(?:0x)?[0-9a-fA-F]{64}\b/g, '[redacted]')
}

function isRateLimited(err: unknown): boolean {
  for (let e = err as { status?: number; message?: string; cause?: unknown } | undefined, i = 0; e && i < 6; e = e.cause as typeof e, i++) {
    if (e.status === 429 || /\b429\b|too many requests|rate limit/i.test(e.message ?? '')) return true
  }
  return false
}

/**
 * Client-safe error text for an API response. The full error is logged on the
 * server; the response never carries RPC URLs, keys or request dumps.
 */
export function readableError(err: unknown, fallback = 'Transaction failed'): string {
  console.error('[tokenization]', err)
  if (isRateLimited(err)) return 'The network is busy (rate limited). Please try again in a few seconds.'
  if (isNonceTooLow(err)) return 'The network is busy (a previous transaction is still settling). Please try again in a few seconds.'
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
    case 'SubscriptionClosed':
      return 'The subscription window has closed.'
    case 'SubscriptionStillOpen':
      return 'The subscription is still open and not fully subscribed. Close it after the window ends.'
    case 'RedemptionAlreadyOpen':
      return 'Maturity is already settled: redemption is open.'
    case 'RedemptionNotOpen':
      return 'Redemption opens at maturity, once it is settled.'
    case 'ProfitAfterMaturity':
      return 'Maturity is settled: no more profit periods can be distributed.'
    case 'ProfitPeriodsOutstanding':
      return 'Distribute every profit period before settling maturity.'
    case 'ZeroAmount':
      return 'Enter an amount greater than zero.'
    case 'ConversionZero':
      return 'The amount is too small to convert at the posted rate.'
    case 'StablecoinAlreadyAdded':
      return 'That settlement coin is already on the allowlist.'
    case 'BadBank':
      return 'Unknown bank for this pool.'
    case 'StaleSnapshot':
      return 'A newer bank balance snapshot is already recorded.'
    case 'PeriodNotSequential':
      return 'Distribute the next profit period in order.'
    case 'NothingToClaim':
      return 'Nothing to claim for this wallet.'
    case 'InvalidMaxAge':
      return 'The maximum reserve age must be above zero.'
    case 'NotEligible':
      return 'This wallet is not eligible: it needs a verified identity (run the faucet), and for the Tawf series it must also pass the series mode (PILOT only / screened group / OJK sandbox).'
    case 'NoPending':
      return 'No pending subscription to cancel.'
    case 'NotStablecoin':
      return 'That settlement coin is not on the series allowlist. Add it (USDC/USDT) first.'
    case 'BadDecimals':
      return 'A settlement coin must have 6 decimals.'
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
    case 'TransfersFrozen':
      return 'The sukuk has matured: transfers between holders are frozen.'
    case 'ReleaseNotSequential':
      return 'Release the board\'s held profit in order (next release index).'
    case 'ZeroRelease':
      return 'A release must be a positive amount.'
    case 'SweepDestinationNotSet':
      return 'No sweep destination is set yet. The Shariah board must approve one first.'
    case 'SweepDestinationAlreadySet':
    case 'SweepDestinationSet':
      return 'A sweep destination is already set for this sukuk.'
    case 'InvalidSweepDestination':
      return 'That address cannot receive unclaimed profit (never the issuer, an admin or the contract).'
    case 'ClaimWindowOpen':
      return 'Holders can still claim: the claim window has not ended yet.'
    case 'TawfShareLocked':
      return 'The profit-sharing ratio is fixed: investors have already committed under it.'
    case 'NisbahLocked':
      return 'This deal is already open to investors: its nisbah is fixed.'
    case 'InvalidNisbah':
      return 'The nisbah must be at most 50% of profit.'
    case 'NotHeld':
      return 'This sukuk has no profit held for Shariah review (or the review is closed).'
    case 'NotShariahSigner':
      return 'Only a Shariah signer of the institution can do this.'
    case 'NoReserveSnapshot':
      return 'No reserve snapshot is posted yet. Update the reserve first.'
    case 'ReserveTooOld':
      return 'The reserve snapshot is too old. Post a fresh reserve first.'
    case 'ExceedsFaceValue':
      return 'This would exceed the sukuk face value.'
    case 'BelowMinimum':
      return 'Below the minimum subscription.'
  }
  if (/function "transfer" reverted/i.test(anyErr?.message ?? '')) {
    return 'The test token transfer did not go through (the network was still catching up). Please try again in a few seconds.'
  }
  if (/Compliance not followed/i.test(anyErr?.message ?? '')) {
    return 'The token compliance rules rejected this: it would exceed an investor limit or a cap (for a Deposito Pool the per-investor or series cap, for an SCF offering the yearly POJK 57/2020 limit or the offering cap), or the wallet is not admitted.'
  }
  if (/not verified|not eligible/i.test(anyErr?.message ?? '')) {
    return 'Recipient is not a verified identity. Run the faucet for that wallet first.'
  }
  // viem's shortMessage is the one-line summary; message adds the URL, request body and docs.
  const text = anyErr?.shortMessage ?? anyErr?.message
  return text ? redact(text.split('\n')[0]) : fallback
}
