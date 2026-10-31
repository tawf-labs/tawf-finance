/**
 * Propose admin actions to the Gnosis Safe that owns the duty, instead of signing them with the
 * operator key.
 *
 * One Safe per duty (the canonical Safe contracts on Arbitrum Sepolia, no custom multisig):
 *   governance  GOV_SAFE        beacons, authorities, role admin, offerings, hooks, series config
 *   treasury    TREASURY_SAFE   money out: distribute, settle, closeSubscription, releaseHeldProfit
 *   minting     MINTING_SAFE    series allocate (mints), token mint and burn
 *   compliance  COMPLIANCE_SAFE claims, identities, SCF profiles and usage resets
 *   guardian    GUARDIAN_SAFE   pause only
 * Data posts (FX, ledger snapshots, profit records, anchor roots) stay on the operator key.
 *
 * `submitAdminTx` proposes to the Safe Transaction Service when the duty's Safe is configured and
 * falls back to the operator signing only when it is not (the pre-Safe testnet stack). The operator
 * EOA is only a PROPOSER: the Safe owners add it as a delegate (Safe{Wallet}, Settings), so it can
 * queue a transaction but never confirm or execute one. Owners approve in Safe{Wallet}.
 *
 * Env: GOV_SAFE, TREASURY_SAFE, MINTING_SAFE, COMPLIANCE_SAFE, GUARDIAN_SAFE (addresses),
 * SAFE_TX_SERVICE_URL (default https://api.safe.global/tx-service/arb-sepolia), SAFE_API_KEY
 * (Bearer key from the Safe developer dashboard, needed above the anonymous rate limit).
 */
import {
  encodeFunctionData,
  getAddress,
  hashTypedData,
  isAddress,
  type Abi,
  type Address,
  type Hex,
} from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import { account, addresses, fetchWithTimeout, walletClient, publicClient } from './operator.js'

export type Duty = 'governance' | 'treasury' | 'minting' | 'compliance' | 'guardian'

export const DUTY_ENV: Record<Duty, string> = {
  governance: 'GOV_SAFE',
  treasury: 'TREASURY_SAFE',
  minting: 'MINTING_SAFE',
  compliance: 'COMPLIANCE_SAFE',
  guardian: 'GUARDIAN_SAFE',
}

export const DUTIES = Object.keys(DUTY_ENV) as Duty[]

/**
 * Safe Transaction Service base URL per chain, pinned here. Arbitrum Sepolia (421614) has NO hosted service
 * in Safe's own network list (safe-core-sdk api-kit config, checked Oct 2026), so it is null and
 * SAFE_TX_SERVICE_URL (a self-hosted service) must be set there. Arbitrum One uses the hosted one.
 */
export const SAFE_SERVICE_BY_CHAIN: Record<number, string | null> = {
  421614: null,
  42161: 'https://api.safe.global/tx-service/arb1',
}

const SERVICE_URL = (chainId: number = Number(addresses.chainId)) => {
  const url = process.env.SAFE_TX_SERVICE_URL ?? SAFE_SERVICE_BY_CHAIN[chainId] ?? ''
  if (!url) throw new Error(`No Safe Transaction Service for chain ${chainId}: set SAFE_TX_SERVICE_URL`)
  return url.replace(/\/$/, '')
}

/**
 * Whether Safes are mandatory. ON unless SAFES_REQUIRED is explicitly "false" AND the chain is Arbitrum
 * Sepolia. When on, a missing or blank Safe env, a missing testClaimIssuer or testRegistryAgent, or a live
 * RPC chain id that differs from deployments.json is an error and never an operator fallback.
 */
export function safesRequired(chainId: number = Number(addresses.chainId)): boolean {
  return !(process.env.SAFES_REQUIRED === 'false' && chainId === arbitrumSepolia.id)
}

let liveChain: Promise<number> | null = null
/** Chain id from the live RPC, compared with deployments.json. Throws on a mismatch. */
export async function assertLiveChain(): Promise<number> {
  liveChain ??= publicClient.getChainId()
  let live: number
  try {
    live = await liveChain
  } catch (e) {
    liveChain = null
    throw e
  }
  if (live !== Number(addresses.chainId)) {
    throw new Error(`RPC chain id ${live} differs from deployments.json chain id ${addresses.chainId}`)
  }
  return live
}

/**
 * The Safe for a duty, or null when its env var is unset. A value that is set but not a valid
 * address THROWS: a typo must never turn into "no Safe, operator sends directly".
 */
export function safeFor(duty: Duty): Address | null {
  const v = process.env[DUTY_ENV[duty]]
  if (v === undefined || v.trim() === '') return null
  if (!isAddress(v.trim())) throw new Error(`${DUTY_ENV[duty]} is set but is not a valid address`)
  return getAddress(v.trim()) as Address
}

/** The operator may send a Safe-duty action itself only on Arbitrum Sepolia, and only with no Safe set. */
export function assertOperatorFallbackAllowed(duty: Duty, chainId: number): void {
  if (chainId !== arbitrumSepolia.id) {
    throw new Error(`${DUTY_ENV[duty]} is not set: off Arbitrum Sepolia the operator never sends ${duty} actions directly`)
  }
  if (safesRequired(chainId)) {
    throw new Error(`${DUTY_ENV[duty]} is not set and SAFES_REQUIRED is on: the operator does not send ${duty} actions directly`)
  }
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' }
  if (process.env.SAFE_API_KEY) h.authorization = `Bearer ${process.env.SAFE_API_KEY}`
  return h
}

const SAFE_TX_TYPES = {
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
} as const

const ZERO = '0x0000000000000000000000000000000000000000' as Address

export interface SafeTxMessage {
  to: Address
  value: bigint
  data: Hex
  operation: 0 | 1
  safeTxGas: bigint
  baseGas: bigint
  gasPrice: bigint
  gasToken: Address
  refundReceiver: Address
  nonce: bigint
}

/** EIP-712 hash the Safe owners sign (identical to GnosisSafe.getTransactionHash). */
export function safeTxHash(safe: Address, tx: SafeTxMessage, chainId: number = arbitrumSepolia.id): Hex {
  return hashTypedData({
    domain: { chainId, verifyingContract: safe },
    types: SAFE_TX_TYPES,
    primaryType: 'SafeTx',
    message: tx,
  })
}

async function svc<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(`${SERVICE_URL()}${path}`, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) } }, 15_000)
  const text = await res.text()
  if (!res.ok) throw new Error(`Safe Transaction Service ${res.status}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : {}) as T
}

/** Next free nonce: the Safe's on-chain nonce, or one past the highest nonce in its pending queue. */
export async function nextNonce(safe: Address): Promise<bigint> {
  const info = await svc<{ nonce: number | string }>(`/api/v1/safes/${safe}/`)
  let next = BigInt(info.nonce)
  const queued = await svc<{ results: { nonce: number | string }[] }>(
    `/api/v1/safes/${safe}/multisig-transactions/?executed=false&ordering=-nonce&limit=1`,
  )
  const top = queued.results?.[0]
  if (top && BigInt(top.nonce) + 1n > next) next = BigInt(top.nonce) + 1n
  return next
}

// One proposal at a time per Safe inside this process, so parallel requests do not read the same nonce.
const safeLocks = new Map<string, Promise<unknown>>()
function withSafeLock<T>(safe: Address, fn: () => Promise<T>): Promise<T> {
  const prev = safeLocks.get(safe) ?? Promise.resolve()
  const run = prev.catch(() => undefined).then(fn)
  safeLocks.set(safe, run.catch(() => undefined))
  return run
}

const MAX_NONCE_ATTEMPTS = 5

export interface Proposal {
  proposed: true
  duty: Duty
  safe: Address
  safeTxHash: Hex
  nonce: string
  description: string
  /** Where the owners approve. */
  safeUrl: string
}

export interface DirectSend {
  proposed: false
  txHash: Hex
}

export interface AdminCall {
  duty: Duty
  address: Address
  abi: Abi | readonly unknown[]
  functionName: string
  args?: readonly unknown[]
  /** Short text shown in Safe{Wallet} and in the admin UI. */
  description: string
}

export function safeAppUrl(safe: Address): string {
  return `https://app.safe.global/transactions/queue?safe=arb-sepolia:${safe}`
}

/** Queue `call` on the duty's Safe. The operator signs the hash as a delegate (proposer only). */
export async function proposeToSafe(call: AdminCall): Promise<Proposal> {
  const safe = safeFor(call.duty)
  if (!safe) throw new Error(`${DUTY_ENV[call.duty]} is not set`)
  const data = encodeFunctionData({ abi: call.abi as Abi, functionName: call.functionName, args: call.args as never })
  return withSafeLock(safe, async () => {
    for (let attempt = 1; ; attempt++) {
      const nonce = await nextNonce(safe)
      const acct = account()
      const tx: SafeTxMessage = {
        to: call.address,
        value: 0n,
        data,
        operation: 0,
        safeTxGas: 0n,
        baseGas: 0n,
        gasPrice: 0n,
        gasToken: ZERO,
        refundReceiver: ZERO,
        nonce,
      }
      const hash = safeTxHash(safe, tx)
      const signature = await acct.signTypedData({
        domain: { chainId: arbitrumSepolia.id, verifyingContract: safe },
        types: SAFE_TX_TYPES,
        primaryType: 'SafeTx',
        message: tx,
      })
      await svc(`/api/v1/safes/${safe}/multisig-transactions/`, {
        method: 'POST',
        body: JSON.stringify({
          to: tx.to,
          value: '0',
          data: tx.data,
          operation: 0,
          safeTxGas: '0',
          baseGas: '0',
          gasPrice: '0',
          gasToken: ZERO,
          refundReceiver: ZERO,
          nonce: nonce.toString(),
          contractTransactionHash: hash,
          sender: acct.address,
          signature,
          origin: JSON.stringify({ name: 'Tawf admin', url: 'https://tawf.finance', note: call.description }),
        }),
      })
      // Another instance may have queued a different transaction on the same nonce meanwhile (the service
      // accepts both). If so, withdraw ours and try the next free nonce.
      const same = await svc<{ results: { safeTxHash: string }[] }>(
        `/api/v1/safes/${safe}/multisig-transactions/?executed=false&nonce=${nonce}`,
      )
      const clash = (same.results ?? []).some((t) => t.safeTxHash.toLowerCase() !== hash.toLowerCase())
      if (!clash) {
        return { proposed: true, duty: call.duty, safe, safeTxHash: hash, nonce: nonce.toString(), description: call.description, safeUrl: safeAppUrl(safe) } as Proposal
      }
      await withdraw(safe, hash)
      if (attempt >= MAX_NONCE_ATTEMPTS) throw new Error(`Could not get a free Safe nonce after ${attempt} attempts`)
    }
  })
}

/** Remove our own queued transaction (the service lets its proposer delete it with a signed request). */
async function withdraw(safe: Address, safeTxHash: Hex): Promise<void> {
  const acct = account()
  const totp = BigInt(Math.floor(Date.now() / 1000 / 3600))
  const signature = await acct.signTypedData({
    domain: { name: 'Safe Transaction Service', version: '1.0', chainId: arbitrumSepolia.id, verifyingContract: safe },
    types: { DeleteRequest: [{ name: 'safeTxHash', type: 'bytes32' }, { name: 'totp', type: 'uint256' }] },
    primaryType: 'DeleteRequest',
    message: { safeTxHash, totp },
  })
  await svc(`/api/v1/multisig-transactions/${safeTxHash}/`, { method: 'DELETE', body: JSON.stringify({ signature }) })
}

/**
 * The single entry point for an admin action. With the duty's Safe configured it proposes and
 * returns the Safe tx hash (the action happens after the owners approve). If the proposal fails
 * (service down, timeout, rejected) it throws: it NEVER falls back to the operator once a Safe is
 * set. Only with no Safe set, on Arbitrum Sepolia, does the operator sign and send, as before the
 * Safes existed. Data posts (FX, ledger snapshots, profit records, anchor roots) do not use this.
 */
export async function submitAdminTx(call: AdminCall, chainId?: number): Promise<Proposal | DirectSend> {
  // The chain id comes from the live RPC and must equal deployments.json. A test may pass one explicitly.
  const chain = chainId ?? (await assertLiveChain())
  if (safeFor(call.duty)) return proposeToSafe(call)
  assertOperatorFallbackAllowed(call.duty, chain)
  const txHash = (await walletClient().writeContract({
    address: call.address,
    abi: call.abi as Abi,
    functionName: call.functionName,
    args: call.args as never,
  } as never)) as Hex
  await publicClient.waitForTransactionReceipt({ hash: txHash })
  return { proposed: false, txHash }
}

export interface PendingTx {
  duty: Duty
  safe: Address
  safeTxHash: Hex
  nonce: number
  to: Address
  method: string | null
  confirmations: number
  required: number
  submittedAt: string
  note: string | null
  safeUrl: string
}

/** Queued (not executed) transactions of every configured Safe, for the Pending approvals panels. */
export async function listPending(only?: Duty[]): Promise<PendingTx[]> {
  const out: PendingTx[] = []
  for (const duty of only ?? DUTIES) {
    const safe = safeFor(duty)
    if (!safe) continue
    const r = await svc<{ results: Record<string, unknown>[] }>(
      `/api/v1/safes/${safe}/multisig-transactions/?executed=false&ordering=nonce&limit=50`,
    )
    for (const t of r.results ?? []) {
      // origin is free text from any client: a JSON string, an already parsed object, or something else.
      let note: string | null = null
      try {
        const o = typeof t.origin === 'string' ? (JSON.parse(t.origin) as unknown) : t.origin
        const n = o && typeof o === 'object' ? (o as { note?: unknown }).note : undefined
        note = typeof n === 'string' ? n : n == null ? null : JSON.stringify(n).slice(0, 200)
      } catch {
        note = typeof t.origin === 'string' && t.origin.length < 200 ? t.origin : null
      }
      const dd = t.dataDecoded as { method?: string } | null | undefined
      out.push({
        duty,
        safe,
        safeTxHash: t.safeTxHash as Hex,
        nonce: Number(t.nonce),
        to: t.to as Address,
        method: dd?.method ?? null,
        confirmations: Array.isArray(t.confirmations) ? t.confirmations.length : 0,
        required: Number(t.confirmationsRequired ?? 0),
        submittedAt: String(t.submissionDate ?? ''),
        note,
        safeUrl: safeAppUrl(safe),
      })
    }
  }
  return out
}
