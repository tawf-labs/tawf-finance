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
import { decodeProposal } from '../../../src/web3/safeDecode.js'
import { checkPolicy, deployedSet, seriesTokens, type DeployedSet } from '../../../src/web3/safePolicy.js'
import { trexComplianceAbi } from './abis.js'
import deployments from '../../../src/web3/tokenization.deployments.json' with { type: 'json' }

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

let deployedCache: Promise<DeployedSet> | null = null
/** Our contracts from deployments.json plus the compliance contract of each series token (read on chain). */
export function loadDeployedSet(): Promise<DeployedSet> {
  deployedCache ??= (async () => {
    const raw = deployments as Record<string, unknown>
    const compliances = await Promise.all(
      seriesTokens(raw).map((token) => publicClient.readContract({ address: token, abi: trexComplianceAbi, functionName: 'compliance' }) as Promise<Address>),
    )
    return deployedSet(raw, compliances)
  })().catch((e) => {
    deployedCache = null
    throw e
  })
  return deployedCache
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
  /** Internal: a Safe rejection (empty call from the Safe to itself). */
  rejection?: boolean
}

/** What is stored per proposal (one key each, written once). */
interface StoredProposal {
  duty: Duty
  safe: Address
  to: Address
  data: Hex
  nonce: string
  hash: Hex
  description: string
  createdAt: number
}

const propKey = (safe: Address, hash: Hex) => `tawf:safe:prop:${safe.toLowerCase()}:${hash}`

// Live index: one append-only list of proposal hashes PER NONCE. The panel reads the lists for nonces in
// [Safe.nonce, Safe.nonce + NONCE_WINDOW], so every proposal that can still run stays visible however old it is,
// and the lists of nonces the Safe has passed are simply never read again (that is the pruning).
const nonceKey = (safe: Address, nonce: bigint) => `tawf:safe:n:${safe.toLowerCase()}:${nonce}`
/** Proposals are accepted and shown only up to Safe.nonce + NONCE_WINDOW. */
export const NONCE_WINDOW = 20n

async function readStored(safe: Address, safeNonce: bigint): Promise<StoredProposal[]> {
  const nonces = Array.from({ length: Number(NONCE_WINDOW) + 1 }, (_, i) => safeNonce + BigInt(i))
  const lists = await kvPool(nonces, 6, (n) => kvListGet(nonceKey(safe, n)))
  const hashes = [...new Set(lists.flat())] as Hex[]
  return (await kvPool(hashes, 6, (h) => kvGetJson<StoredProposal | null>(propKey(safe, h), null))).filter(
    (p): p is StoredProposal => p !== null,
  )
}

/**
 * Queue `call` on the duty's Safe, the way the Safe apps do. The proposal targets
 * nonce = max(Safe.nonce, highest pending nonce + 1) among nonces up to Safe.nonce + NONCE_WINDOW, unless
 * `opts.nonce` pins one (a rejection must target the nonce it burns). Several proposals may share a nonce: they
 * compete, whichever executes first wins and the others become stale. A live proposal of the same duty with the
 * same target and data is returned instead of queuing a copy (double click). A proposal is stored under its
 * SafeTx hash. The call must pass the duty policy (our contracts, that duty's functions) before it is stored.
 */
export async function proposeToSafe(call: AdminCall, opts: { nonce?: bigint } = {}): Promise<Proposal> {
  const safe = safeFor(call.duty)
  if (!safe) throw new Error(`${DUTY_ENV[call.duty]} is not set`)
  if (!kvEnabled()) throw new Error('Safe proposals need the key-value store (QUICKNODE_API_KEY is not set)')
  const data = call.rejection
    ? ('0x' as Hex)
    : encodeFunctionData({ abi: call.abi as Abi, functionName: call.functionName, args: call.args as never })
  const to = call.rejection ? safe : call.address
  const verdict = checkPolicy(call.duty, safe, to, decodeProposal(to, data, safe), await loadDeployedSet())
  if (!verdict.ok) throw new Error(`Refused: ${verdict.reason}`)

  const safeNonce = (await publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'nonce' })) as bigint
  const live = await readStored(safe, safeNonce)
  let nonce = opts.nonce
  if (nonce === undefined) {
    const twin = live.find((p) => p.duty === call.duty && p.to.toLowerCase() === to.toLowerCase() && p.data === data)
    if (twin) {
      return { proposed: true, duty: twin.duty, safe, safeTxHash: twin.hash, nonce: twin.nonce, description: twin.description }
    }
    nonce = safeNonce
    for (const p of live) if (BigInt(p.nonce) + 1n > nonce) nonce = BigInt(p.nonce) + 1n
  } else if (nonce < safeNonce) {
    throw new Error(`Nonce ${nonce} is already used: the Safe is at nonce ${safeNonce}`)
  }
  if (nonce > safeNonce + NONCE_WINDOW) {
    throw new Error(`The approval queue is full: nonce ${nonce} is more than ${NONCE_WINDOW} ahead of the Safe. Execute or reject pending proposals first.`)
  }
  const hash = (await publicClient.readContract({
    address: safe,
    abi: safeAbi,
    functionName: 'getTransactionHash',
    args: [to, 0n, data, 0, 0n, 0n, 0n, ZERO_ADDRESS, ZERO_ADDRESS, nonce],
  })) as Hex
  const existing = await kvGetJson<StoredProposal | null>(propKey(safe, hash), null)
  if (!existing) {
    const stored: StoredProposal = {
      duty: call.duty, safe, to, data, nonce: nonce.toString(), hash,
      description: call.description, createdAt: Date.now(),
    }
    await kvSetJson(propKey(safe, hash), stored)
  }
  // Append-only and idempotent: a duplicate hash is ignored by the list.
  await kvListAdd(nonceKey(safe, nonce), hash)
  return { proposed: true, duty: call.duty, safe, safeTxHash: hash, nonce: nonce.toString(), description: existing?.description ?? call.description }
}

/** The standard Safe rejection for `nonce`: a zero-value call from the Safe to itself with empty data. */
export function rejectNonce(duty: Duty, nonce: bigint): Promise<Proposal> {
  return proposeToSafe(
    { duty, address: ZERO_ADDRESS, abi: [], functionName: '', description: `Reject nonce ${nonce}: burn it so the queue moves`, rejection: true },
    { nonce },
  )
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


export type ProposalStatus = 'pending' | 'ready'

export interface PendingTx {
  duty: Duty
  safe: Address
  safeTxHash: Hex
  nonce: number
  to: Address
  data: Hex
  value: string
  method: string | null
  description: string
  createdAt: number
  /** Owners that approved this hash on chain. */
  approvedBy: Address[]
  required: number
  owners: Address[]
  safeNonce: number
  /** pending: waiting for approvals or an earlier nonce. ready: threshold met and it is the next nonce.
   *  Proposals the Safe has passed (executed, rejected or replaced by a competing one) are no longer listed. */
  status: ProposalStatus
  /** Other live proposals competing for the same nonce. Whichever executes first wins. */
  competing: number
  /** Packed approved-hash signatures to pass to execTransaction (approvals so far, sorted by owner). */
  signatures: Hex
}

/** The first four bytes of the call data are the selector, shown when nothing better is known. */
function methodOf(data: Hex): string | null {
  return data.length >= 10 ? data.slice(0, 10) : null
}

/** Proposals of every configured Safe with their on-chain approvals, for the Pending approvals panels. */
export async function listPending(only?: Duty[]): Promise<PendingTx[]> {
  if (!kvEnabled()) return []
  const out: PendingTx[] = []
  for (const duty of only ?? DUTIES) {
    const safe = safeFor(duty)
    if (!safe) continue
    const [safeNonce, threshold, owners] = (await Promise.all([
      publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'nonce' }),
      publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'getThreshold' }),
      publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'getOwners' }),
    ])) as [bigint, bigint, Address[]]
    // Only nonces that can still run, up to the window. Everything the Safe has passed is gone from the index.
    const props = await readStored(safe, safeNonce)
    if (props.length === 0) continue
    const perNonce = new Map<string, number>()
    for (const p of props) if (BigInt(p.nonce) >= safeNonce) perNonce.set(p.nonce, (perNonce.get(p.nonce) ?? 0) + 1)
    for (const p of props) {
      const nonce = BigInt(p.nonce)
      const approvals = await publicClient.multicall({
            allowFailure: false,
            contracts: owners.map((o) => ({ address: safe, abi: safeAbi, functionName: 'approvedHashes', args: [o, p.hash] }) as const),
          })
      const approvedBy = owners.filter((_, i) => (approvals as readonly bigint[])[i] === 1n)
      const met = BigInt(approvedBy.length) >= threshold
      out.push({
        duty, safe, safeTxHash: p.hash, nonce: Number(p.nonce), to: p.to, data: p.data, value: '0', method: methodOf(p.data),
        description: p.description, createdAt: p.createdAt, approvedBy, required: Number(threshold),
        owners, safeNonce: Number(safeNonce),
        status: met && nonce === safeNonce ? 'ready' : 'pending',
        competing: (perNonce.get(p.nonce) ?? 1) - 1,
        signatures: packApprovedHashSignatures(approvedBy),
      })
    }
  }
  return out.sort((a, b) => a.nonce - b.nonce || a.createdAt - b.createdAt)
}
