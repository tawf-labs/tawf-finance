import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, parseAbi, type Address, type Hex } from 'viem'
import {
  publicClient,
  walletClient,
  addresses,
  isScfConfigured,
  methodGuard,
  requirePasscode,
  readableError,
  kind,
  leafHash,
} from '../_lib/operator.js'
import { identityRegistryAbi, mockTokenAbi, operatorAnchorAbi, scfLimitModuleAbi, sukukDistributorAbi } from '../_lib/abis.js'
import type { IdentityStep } from '../_lib/identity.js'

const TX_TIMEOUT_MS = 30_000

const extraAbi = parseAbi([
  'function lastPeriod() view returns (uint16)',
  'function totalSupply() view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

type Action = 'reserve' | 'close' | 'distribute' | 'settle' | 'resetUsage'

/**
 * Issuer and platform actions for the securities crowdfunding (SCF) offering.
 * The offering verifies facts against its own operator-gated LedgerAnchor:
 * each fact is pushed as a single-leaf root, so the proof is empty. In
 * production these facts come from the platform's records (the SME's
 * reported profit and the redemption), signed off by the platform's Shariah
 * board, the same way the BPRS facts come from the Tawf Network ledger.
 *
 *   POST /api/tokenization/scf/admin { action: "reserve" }                 refresh the reserve snapshot
 *   POST /api/tokenization/scf/admin { action: "close" }                   close the subscription
 *   POST /api/tokenization/scf/admin { action: "distribute", amount }      next profit period (USDC)
 *   POST /api/tokenization/scf/admin { action: "settle", amount? }         maturity (default: at par)
 *   POST /api/tokenization/scf/admin { action: "resetUsage", wallet }      clear an investor's usage this period
 *
 * resetUsage is the recovery step after a cancelled raise: refunds burn the
 * tokens but never reduce the investor's yearly usage, so the platform clears
 * it explicitly.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isScfConfigured()) {
    res.status(503).json({ error: 'The crowdfunding offering is not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  const steps: IdentityStep[] = []
  try {
    const action = req.body?.action as Action
    const wc = walletClient()
    const dist = addresses.scfDistributor
    const send = async (label: string, write: () => Promise<Hex>) => {
      const hash = await write()
      await publicClient.waitForTransactionReceipt({ hash, timeout: TX_TIMEOUT_MS })
      steps.push({ label, txHash: hash })
    }
    const anchorFact = async (name: string, a: bigint, b: bigint): Promise<bigint> => {
      const epoch = (await publicClient.readContract({ address: addresses.scfAnchor, abi: operatorAnchorAbi, functionName: 'epochs' })) as bigint
      const leaf = leafHash(kind(name), addresses.scfId, a, b)
      await send(`Anchored ${name}`, () => wc.writeContract({ address: addresses.scfAnchor, abi: operatorAnchorAbi, functionName: 'push', args: [leaf] }))
      return epoch
    }
    const fund = async (amount: bigint) => {
      await send('Minted test mUSDC for the issuer payment', () =>
        wc.writeContract({ address: addresses.mockUsdc, abi: mockTokenAbi, functionName: 'faucet', args: [amount] }),
      )
      await send('Approved the distributor', () =>
        wc.writeContract({ address: addresses.mockUsdc, abi: extraAbi, functionName: 'approve', args: [dist, amount] }),
      )
    }
    const usdc = (v: unknown): bigint => BigInt(Math.round(Number(v ?? 0) * 1e6))

    switch (action) {
      case 'reserve': {
        const terms = (await publicClient.readContract({ address: dist, abi: sukukDistributorAbi, functionName: 'terms' })) as readonly unknown[]
        const face = terms[1] as bigint
        const at = BigInt(Math.floor(Date.now() / 1000))
        const epoch = await anchorFact('tawf.sukuk.reserve', at, face)
        await send('Reserve snapshot recorded', () =>
          wc.writeContract({ address: dist, abi: sukukDistributorAbi, functionName: 'updateReserve', args: [at, face, epoch, []] }),
        )
        break
      }
      case 'close':
        await send('Subscription closed', () => wc.writeContract({ address: dist, abi: sukukDistributorAbi, functionName: 'closeSubscription' }))
        break
      case 'distribute': {
        const amount = usdc(req.body?.amount)
        if (amount <= 0n) {
          res.status(400).json({ error: 'amount (USDC) must be positive.' })
          return
        }
        const period = Number(await publicClient.readContract({ address: dist, abi: extraAbi, functionName: 'lastPeriod' })) + 1
        const epoch = await anchorFact('tawf.sukuk.distribution', BigInt(period), amount)
        await fund(amount)
        await send(`Profit period ${period} distributed`, () =>
          wc.writeContract({ address: dist, abi: sukukDistributorAbi, functionName: 'distribute', args: [period, amount, epoch, []] }),
        )
        break
      }
      case 'settle': {
        const supply = (await publicClient.readContract({ address: addresses.scfToken as Address, abi: extraAbi, functionName: 'totalSupply' })) as bigint
        const amount = req.body?.amount === undefined ? supply : usdc(req.body.amount)
        const epoch = await anchorFact('tawf.sukuk.redemption', amount, 0n)
        if (amount > 0n) await fund(amount)
        await send('Maturity settled', () =>
          wc.writeContract({ address: dist, abi: sukukDistributorAbi, functionName: 'settleMaturity', args: [amount, epoch, []] }),
        )
        break
      }
      case 'resetUsage': {
        const w = req.body?.wallet
        if (typeof w !== 'string' || !isAddress(w)) {
          res.status(400).json({ error: 'wallet must be a valid address.' })
          return
        }
        const identity = (await publicClient.readContract({
          address: addresses.identityRegistry,
          abi: identityRegistryAbi,
          functionName: 'identity',
          args: [getAddress(w) as Address],
        })) as Address
        if (identity === '0x0000000000000000000000000000000000000000') {
          res.status(400).json({ error: 'This wallet has no registered identity.' })
          return
        }
        const period = (await publicClient.readContract({ address: addresses.scfLimitModule, abi: scfLimitModuleAbi, functionName: 'currentPeriod' })) as bigint
        await send(`Usage reset for period ${period}`, () =>
          wc.writeContract({ address: addresses.scfLimitModule, abi: scfLimitModuleAbi, functionName: 'resetUsage', args: [identity, period] }),
        )
        break
      }
      default:
        res.status(400).json({ error: 'action must be reserve, close, distribute, settle or resetUsage.' })
        return
    }

    const status = Number(await publicClient.readContract({ address: dist, abi: sukukDistributorAbi, functionName: 'status' }))
    res.status(200).json({ action, status, steps })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'SCF action failed'), steps })
  }
}
