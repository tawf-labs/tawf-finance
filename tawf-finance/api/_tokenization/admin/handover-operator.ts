import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, keccak256, encodeAbiParameters, parseAbi, parseEther, type Address, type Hex } from 'viem'
import {
  publicClient,
  walletClient,
  account,
  addresses,
  isConfigured,
  methodGuard,
  requirePasscode,
  readableError,
} from '../_lib/operator.js'
import type { IdentityStep } from '../_lib/identity.js'
import deployments from '../../../src/web3/tokenization.deployments.json' with { type: 'json' }

const ZERO = '0x0000000000000000000000000000000000000000'
const DEFAULT_ADMIN = `0x${'0'.repeat(64)}` as Hex
const KEEP_ETH = parseEther('0.003')
// Stop starting new transactions after this, so the function returns before
// the platform limit. The route is idempotent: call it again to continue.
const BUDGET_MS = 40_000

const accessAbi = parseAbi([
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function grantRole(bytes32 role, address account)',
  'function ADMIN_ROLE() view returns (bytes32)',
  'function OPERATOR_ROLE() view returns (bytes32)',
  'function FX_ROLE() view returns (bytes32)',
  'function treasury() view returns (address)',
  'function setTreasury(address treasury_)',
])
const trexAbi = parseAbi([
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
  'function isAgent(address agent) view returns (bool)',
  'function addAgent(address agent)',
  'function compliance() view returns (address)',
])
const registryAbi = parseAbi(['function identity(address wallet) view returns (address)'])
const keysAbi = parseAbi([
  'function keyHasPurpose(bytes32 key, uint256 purpose) view returns (bool)',
  'function addKey(bytes32 key, uint256 purpose, uint256 keyType) returns (bool)',
])
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
])

const raw = deployments as Record<string, unknown>
const addr = (k: string): Address | null => {
  const v = raw[k]
  return typeof v === 'string' && isAddress(v) && v !== ZERO ? (getAddress(v) as Address) : null
}

/**
 * Hand every operator power on Arbitrum Sepolia to `newOperator`:
 * deposito series roles and treasury, sukuk distributor roles, T-REX agent
 * roles, the KYC ClaimIssuer management and claim keys, the treasury's
 * stablecoins and spare ETH, and finally ownership of the T-REX contracts.
 * The current operator keeps its roles (revoke them in a later step, after
 * DEMO_OPERATOR_KEY is switched and the new key is checked).
 *
 * Idempotent and resumable: every step checks state first, and the route
 * stops after ~40s with `done: false`. Call it again until `done: true`.
 *
 * `wallets` (optional) lists verified investor wallets whose ONCHAINID the
 * old operator manages. Each gets the new operator as a management (1) and
 * claim (3) key, so the new operator can keep adding claims (for example
 * screening) to existing investors. This needs the old key, so run it before
 * DEMO_OPERATOR_KEY is switched.
 *
 *   POST /api/tokenization/admin/handover-operator { newOperator, confirm: "HANDOVER", wallets?: string[] }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  const started = Date.now()
  const steps: IdentityStep[] = []
  try {
    const rawNew = req.body?.newOperator
    if (typeof rawNew !== 'string' || !isAddress(rawNew) || req.body?.confirm !== 'HANDOVER') {
      res.status(400).json({ error: 'Send { newOperator, confirm: "HANDOVER" }.' })
      return
    }
    const next = getAddress(rawNew) as Address
    const me = account().address
    if (next.toLowerCase() === me.toLowerCase()) {
      res.status(400).json({ error: 'newOperator is already the current operator.' })
      return
    }
    const wc = walletClient()
    let done = true
    const send = async (label: string, write: () => Promise<Hex>) => {
      if (Date.now() - started > BUDGET_MS) {
        done = false
        return
      }
      const hash = await write()
      await publicClient.waitForTransactionReceipt({ hash })
      steps.push({ label, txHash: hash })
    }
    const skip = (label: string) => steps.push({ label, skipped: true })

    // 1. AccessControl roles on the deposito series and sukuk distributors.
    const acContracts: [string, Address | null, string[]][] = [
      ['Deposito series', addr('tawfSeries'), ['ADMIN_ROLE', 'OPERATOR_ROLE', 'FX_ROLE']],
      ['Deposito series 2', addr('tawfSeries2'), ['ADMIN_ROLE', 'OPERATOR_ROLE', 'FX_ROLE']],
      ['Sukuk distributor', addr('sukukDistributor'), ['ADMIN_ROLE']],
      ['Sukuk distributor 2', addr('sukuk2Distributor'), ['ADMIN_ROLE']],
    ]
    for (const [name, target, roleNames] of acContracts) {
      if (!target) continue
      const roles: [string, Hex][] = [['DEFAULT_ADMIN_ROLE', DEFAULT_ADMIN]]
      for (const r of roleNames) {
        roles.push([r, (await publicClient.readContract({ address: target, abi: accessAbi, functionName: r as 'ADMIN_ROLE' })) as Hex])
      }
      for (const [rName, role] of roles) {
        const has = await publicClient.readContract({ address: target, abi: accessAbi, functionName: 'hasRole', args: [role, next] })
        if (has) skip(`${name}: ${rName} already granted`)
        else await send(`${name}: granted ${rName}`, () => wc.writeContract({ address: target, abi: accessAbi, functionName: 'grantRole', args: [role, next] }))
      }
    }

    // 2. T-REX agent roles (identity registry + every series and sukuk token).
    const tokens = ['tawfSeriesToken', 'tawfSeries2Token', 'sukukToken', 'sukuk2Token'].map(addr).filter(Boolean) as Address[]
    const agentTargets: [string, Address][] = [['Identity registry', addresses.identityRegistry], ...tokens.map((t, i) => [`Token ${i + 1}`, t] as [string, Address])]
    for (const [name, target] of agentTargets) {
      const is = await publicClient.readContract({ address: target, abi: trexAbi, functionName: 'isAgent', args: [next] })
      if (is) skip(`${name}: already an agent`)
      else await send(`${name}: added agent`, () => wc.writeContract({ address: target, abi: trexAbi, functionName: 'addAgent', args: [next] }))
    }

    // 3. KYC ClaimIssuer keys: management (1) and claim signer (3), ECDSA (1).
    const keyHash = keccak256(encodeAbiParameters([{ type: 'address' }], [next]))
    for (const [purpose, label] of [[1n, 'management'], [3n, 'claim signer']] as const) {
      const has = await publicClient.readContract({ address: addresses.claimIssuer, abi: keysAbi, functionName: 'keyHasPurpose', args: [keyHash, purpose] })
      if (has) skip(`ClaimIssuer: ${label} key already set`)
      else await send(`ClaimIssuer: added ${label} key`, () => wc.writeContract({ address: addresses.claimIssuer, abi: keysAbi, functionName: 'addKey', args: [keyHash, purpose, 1n] }))
    }

    // 3b. Existing investor identities managed by the old operator.
    const rawWallets: unknown = req.body?.wallets
    const wallets = Array.isArray(rawWallets) ? rawWallets.filter((w): w is string => typeof w === 'string' && isAddress(w)) : []
    const meHash = keccak256(encodeAbiParameters([{ type: 'address' }], [me]))
    for (const w of wallets.slice(0, 200)) {
      const identity = (await publicClient.readContract({ address: addresses.identityRegistry, abi: registryAbi, functionName: 'identity', args: [getAddress(w)] })) as Address
      const short = `${w.slice(0, 6)}…${w.slice(-4)}`
      if (identity === ZERO) {
        skip(`Identity ${short}: not registered`)
        continue
      }
      const managed = await publicClient.readContract({ address: identity, abi: keysAbi, functionName: 'keyHasPurpose', args: [meHash, 1n] })
      if (!managed) {
        skip(`Identity ${short}: not managed by the old operator, left as is`)
        continue
      }
      for (const [purpose, label] of [[1n, 'management'], [3n, 'claim']] as const) {
        const has = await publicClient.readContract({ address: identity, abi: keysAbi, functionName: 'keyHasPurpose', args: [keyHash, purpose] })
        if (has) skip(`Identity ${short}: ${label} key already set`)
        else await send(`Identity ${short}: added ${label} key`, () => wc.writeContract({ address: identity, abi: keysAbi, functionName: 'addKey', args: [keyHash, purpose, 1n] }))
      }
    }

    // 4. Treasury: point the series at the new operator and move the funds.
    for (const [name, series] of [['Deposito series', addr('tawfSeries')], ['Deposito series 2', addr('tawfSeries2')]] as const) {
      if (!series) continue
      const t = (await publicClient.readContract({ address: series, abi: accessAbi, functionName: 'treasury' })) as Address
      if (t.toLowerCase() === next.toLowerCase()) skip(`${name}: treasury already moved`)
      else if (t.toLowerCase() !== me.toLowerCase()) skip(`${name}: treasury is ${t}, not the operator, left as is`)
      else await send(`${name}: treasury set to the new operator`, () => wc.writeContract({ address: series, abi: accessAbi, functionName: 'setTreasury', args: [next] }))
    }
    for (const [symbol, token] of [['mUSDC', addresses.mockUsdc], ['mUSDT', addresses.mockUsdt], ['mUSDG', addresses.mockUsdg]] as const) {
      if (!token || token === ZERO) continue
      const bal = (await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [me] })) as bigint
      if (bal === 0n) skip(`${symbol}: nothing to move`)
      else await send(`${symbol}: moved treasury balance`, () => wc.writeContract({ address: token, abi: erc20Abi, functionName: 'transfer', args: [next, bal] }))
    }

    // 5. Ownership last: T-REX registries, factory, tokens and compliances.
    const compliances: Address[] = []
    for (const t of tokens) compliances.push((await publicClient.readContract({ address: t, abi: trexAbi, functionName: 'compliance' })) as Address)
    const owned: [string, Address | null][] = [
      ['Identity registry', addresses.identityRegistry],
      ['Identity registry storage', addr('identityRegistryStorage')],
      ['Claim topics registry', addr('claimTopicsRegistry')],
      ['Trusted issuers registry', addr('trustedIssuersRegistry')],
      ['Implementation authority', addr('implementationAuthority')],
      ['Identity factory', addr('idFactory')],
      ...tokens.map((t, i) => [`Token ${i + 1}`, t] as [string, Address]),
      ...[...new Set(compliances.map((c) => c.toLowerCase()))].map((c, i) => [`Compliance ${i + 1}`, getAddress(c)] as [string, Address]),
    ]
    for (const [name, target] of owned) {
      if (!target) continue
      const owner = (await publicClient.readContract({ address: target, abi: trexAbi, functionName: 'owner' })) as Address
      if (owner.toLowerCase() === next.toLowerCase()) skip(`${name}: already owned by the new operator`)
      else if (owner.toLowerCase() !== me.toLowerCase()) skip(`${name}: owned by ${owner}, left as is`)
      else await send(`${name}: ownership transferred`, () => wc.writeContract({ address: target, abi: trexAbi, functionName: 'transferOwnership', args: [next] }))
    }

    // 6. Spare ETH for gas, keeping a little on the old key.
    if (done) {
      const eth = await publicClient.getBalance({ address: me })
      if (eth <= KEEP_ETH * 2n) skip('ETH: nothing spare to move')
      else await send('ETH: moved spare gas funds', () => wc.sendTransaction({ to: next, value: eth - KEEP_ETH }))
    }

    res.status(200).json({ from: me, to: next, done, steps })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Handover failed'), steps })
  }
}
