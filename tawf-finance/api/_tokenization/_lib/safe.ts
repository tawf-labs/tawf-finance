/**
 * Admin actions that need people: queue them on the duty's Gnosis Safe instead of signing with the operator.
 *
 * One Safe per duty (canonical Safe contracts, no custom multisig):
 *   governance  GOV_SAFE        beacons, authorities, role admin, offerings, hooks, series config
 *   treasury    TREASURY_SAFE   money out: distribute, settle, closeSubscription, releaseHeldProfit, Tawf share
 *   minting     MINTING_SAFE    series allocate (mints), token mint and burn
 *   compliance  COMPLIANCE_SAFE claims, identities, SCF profiles and usage resets
 *   guardian    GUARDIAN_SAFE   pause only
 * Data posts (FX, ledger snapshots, profit records, anchor roots) stay on the operator key and never use this.
 *
 * No hosted Safe service exists for Arbitrum Sepolia, so the flow is on chain:
 *   1. propose: the API reads the Safe nonce, picks a free nonce, computes the SafeTx hash with
 *      Safe.getTransactionHash and stores the proposal in the key-value store (append-only, one key per
 *      proposal, no read-modify-write).
 *   2. approve: each owner calls Safe.approveHash(hash) from the admin UI with their own wallet.
 *   3. execute: once `threshold` owners approved and the nonce is next, anyone calls Safe.execTransaction
 *      with the approved-hash signatures (`packApprovedHashSignatures`).
 * The API holds no Safe signer key and cannot approve or execute anything.
 *
 * Env: GOV_SAFE, TREASURY_SAFE, MINTING_SAFE, COMPLIANCE_SAFE, GUARDIAN_SAFE (addresses),
 * SAFES_REQUIRED ("false" only on Arbitrum Sepolia switches the operator fallback back on), and the
 * key-value store key (QUICKNODE_API_KEY) that already backs the activity index.
 */
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  type Abi,
  type Address,
  type Hex,
} from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import { addresses, walletClient, publicClient } from './operator.js'
import { kvEnabled, kvGetJson, kvListAdd, kvListGet, kvPool, kvSetJson } from './qn-kv.js'
import { safeAbi, ZERO_ADDRESS, packApprovedHashSignatures } from '../../../src/web3/safe.js'

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

export interface Proposal {
  proposed: true
  duty: Duty
  safe: Address
  safeTxHash: Hex
  nonce: string
  description: string
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
  /** Short text shown in the admin UI. */
  description: string
}

/** What is stored per proposal (one key each, written once). */
interface StoredProposal {
  id: string
  duty: Duty
  safe: Address
  to: Address
  data: Hex
  nonce: string
  hash: Hex
  description: string
  createdAt: number
}

const listKey = (safe: Address) => `tawf:safe:list:${safe.toLowerCase()}`
const slotKey = (safe: Address, nonce: bigint) => `tawf:safe:slot:${safe.toLowerCase()}:${nonce}`
const propKey = (safe: Address, hash: Hex) => `tawf:safe:prop:${safe.toLowerCase()}:${hash}`

const MAX_SLOT_ATTEMPTS = 25
const slotRecheckMs = () => Number(process.env.SAFE_SLOT_RECHECK_MS ?? 250)

/**
 * Queue `call` on the duty's Safe. Picks the next free nonce at or above the Safe's current nonce
 * (the first proposal targets the current nonce, later ones queue with nonce + 1), computes the hash with
 * Safe.getTransactionHash and stores the proposal. Slots are claimed with an append-only list per nonce:
 * the first item the store returns wins, so a clash between two API instances resolves the same way for everyone and the
 * loser moves on to the next nonce (a late loser shows as superseded in the panel).
 */
export async function proposeToSafe(call: AdminCall): Promise<Proposal> {
  const safe = safeFor(call.duty)
  if (!safe) throw new Error(`${DUTY_ENV[call.duty]} is not set`)
  if (!kvEnabled()) throw new Error('Safe proposals need the key-value store (QUICKNODE_API_KEY is not set)')
  const data = encodeFunctionData({ abi: call.abi as Abi, functionName: call.functionName, args: call.args as never })
  const safeNonce = (await publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'nonce' })) as bigint
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')
  const item = `${Date.now().toString().padStart(15, '0')}-${id}`

  let nonce = safeNonce
  for (let attempt = 0; ; attempt++, nonce++) {
    if (attempt >= MAX_SLOT_ATTEMPTS) throw new Error('No free Safe nonce: too many proposals are waiting')
    await kvListAdd(slotKey(safe, nonce), item)
    // The first item the store returns owns the slot. Look again after a short pause so a claim that was
    // still in flight is seen before we decide (a late loser also shows as superseded in the panel).
    if ((await kvListGet(slotKey(safe, nonce)))[0] !== item) continue
    await new Promise((r) => setTimeout(r, slotRecheckMs()))
    if ((await kvListGet(slotKey(safe, nonce)))[0] === item) break
  }

  const hash = (await publicClient.readContract({
    address: safe,
    abi: safeAbi,
    functionName: 'getTransactionHash',
    args: [call.address, 0n, data, 0, 0n, 0n, 0n, ZERO_ADDRESS, ZERO_ADDRESS, nonce],
  })) as Hex
  const stored: StoredProposal = {
    id, duty: call.duty, safe, to: call.address, data, nonce: nonce.toString(), hash,
    description: call.description, createdAt: Date.now(),
  }
  await kvSetJson(propKey(safe, hash), stored)
  await kvListAdd(listKey(safe), hash)
  return { proposed: true, duty: call.duty, safe, safeTxHash: hash, nonce: nonce.toString(), description: call.description }
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


export type ProposalStatus = 'pending' | 'ready' | 'stale' | 'superseded'

export interface PendingTx {
  duty: Duty
  safe: Address
  safeTxHash: Hex
  nonce: number
  to: Address
  data: Hex
  method: string | null
  description: string
  createdAt: number
  /** Owners that approved this hash on chain. */
  approvedBy: Address[]
  required: number
  owners: Address[]
  safeNonce: number
  /** pending: waiting for approvals or an earlier nonce. ready: threshold met and it is the next nonce.
   *  stale: the Safe nonce moved past it (executed or replaced). superseded: another proposal won its nonce. */
  status: ProposalStatus
  /** Packed approved-hash signatures to pass to execTransaction (approvals so far, sorted by owner). */
  signatures: Hex
}

/** The first four bytes of the call data are the selector, shown when nothing better is known. */
function methodOf(data: Hex): string | null {
  return data.length >= 10 ? data.slice(0, 10) : null
}

/** Proposals of every configured Safe with their on-chain approvals, for the Pending approvals panels. */
export async function listPending(only?: Duty[], includeStale = false): Promise<PendingTx[]> {
  if (!kvEnabled()) return []
  const out: PendingTx[] = []
  for (const duty of only ?? DUTIES) {
    const safe = safeFor(duty)
    if (!safe) continue
    const hashes = [...new Set(await kvListGet(listKey(safe)))] as Hex[]
    if (hashes.length === 0) continue
    const [safeNonce, threshold, owners] = (await Promise.all([
      publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'nonce' }),
      publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'getThreshold' }),
      publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'getOwners' }),
    ])) as [bigint, bigint, Address[]]
    const props = (await kvPool(hashes, 6, (h) => kvGetJson<StoredProposal | null>(propKey(safe, h), null))).filter(
      (p): p is StoredProposal => p !== null,
    )
    // The proposal whose claim comes first owns its nonce; later claimants are superseded.
    const winners = new Map<string, string>()
    await kvPool([...new Set(props.map((p) => p.nonce))], 6, async (n) => {
      const claims = await kvListGet(slotKey(safe, BigInt(n)))
      winners.set(n, claims[0]?.split('-').slice(1).join('-') ?? '')
    })
    for (const p of props) {
      const nonce = BigInt(p.nonce)
      const stale = nonce < safeNonce
      if (stale && !includeStale) continue
      const superseded = !stale && winners.get(p.nonce) !== p.id
      const approvals = stale
        ? []
        : await publicClient.multicall({
            allowFailure: false,
            contracts: owners.map((o) => ({ address: safe, abi: safeAbi, functionName: 'approvedHashes', args: [o, p.hash] }) as const),
          })
      const approvedBy = owners.filter((_, i) => (approvals as readonly bigint[])[i] === 1n)
      const met = BigInt(approvedBy.length) >= threshold
      out.push({
        duty, safe, safeTxHash: p.hash, nonce: Number(p.nonce), to: p.to, data: p.data, method: methodOf(p.data),
        description: p.description, createdAt: p.createdAt, approvedBy, required: Number(threshold),
        owners, safeNonce: Number(safeNonce),
        status: stale ? 'stale' : superseded ? 'superseded' : met && nonce === safeNonce ? 'ready' : 'pending',
        signatures: packApprovedHashSignatures(approvedBy),
      })
    }
  }
  return out.sort((a, b) => a.nonce - b.nonce || a.createdAt - b.createdAt)
}
