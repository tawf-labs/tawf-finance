import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address, type Hex } from 'viem'
import {
  publicClient,
  walletClient,
  account,
  pool,
  isPoolConfigured,
  methodGuard,
  requirePasscode,
  readableError,
} from '../_lib/operator.js'
import { depositoPoolLedgerAbi, tawfSeriesAbi, trexTokenAbi } from '../_lib/abis.js'
import { fundTreasuryForSen } from '../series/distribute-profit.js'
import type { IdentityStep } from '../_lib/identity.js'

const TX_TIMEOUT_MS = 30_000

type Action = 'reserve' | 'allocate' | 'distribute' | 'settle'

/** `{ "<bankId>": idr }` to parallel arrays of bank ids and sen amounts. */
function perBank(input: unknown): { ids: Hex[]; sen: bigint[] } | null {
  if (!input || typeof input !== 'object') return null
  const ids: Hex[] = []
  const sen: bigint[] = []
  for (const [id, v] of Object.entries(input as Record<string, unknown>)) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return null
    const idr = Number(v)
    if (!Number.isFinite(idr) || idr < 0) return null
    ids.push(id as Hex)
    sen.push(BigInt(Math.round(idr * 100)))
  }
  return ids.length ? { ids, sen } : null
}

/**
 * Operator actions for the regional Tawf Deposito Pool. The pool's series
 * verifies facts against its DepositoPoolLedger, where the operator records
 * Tawf's balance and credited profit at each BPRS. In production those
 * figures come from each bank's core banking through the bprs-connector.
 * Amounts are in rupiah.
 *
 *   POST /api/tokenization/pool/admin { action: "reserve", balances: { "<bankId>": idr } }
 *   POST /api/tokenization/pool/admin { action: "allocate", investors: ["0x.."] }
 *   POST /api/tokenization/pool/admin { action: "distribute", profits: { "<bankId>": idr } }
 *   POST /api/tokenization/pool/admin { action: "settle", principalIdr? }   (default: at par)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isPoolConfigured()) {
    res.status(503).json({ error: 'The Deposito Pool is not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  const steps: IdentityStep[] = []
  try {
    const action = req.body?.action as Action
    const wc = walletClient()
    const send = async (label: string, write: () => Promise<Hex>) => {
      const hash = await write()
      await publicClient.waitForTransactionReceipt({ hash, timeout: TX_TIMEOUT_MS })
      steps.push({ label, txHash: hash })
    }
    const chainNow = async () => (await publicClient.getBlock()).timestamp
    const nextEpoch = async () =>
      (await publicClient.readContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'epochs' })) as bigint
    const knownBanks = async (ids: Hex[]): Promise<boolean> => {
      const [listed] = (await publicClient.readContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'banks' })) as readonly [readonly Hex[], ...unknown[]]
      const set = new Set(listed.map((x) => x.toLowerCase()))
      return ids.every((id) => set.has(id.toLowerCase()))
    }
    const lastPeriod = async () =>
      Number(await publicClient.readContract({ address: pool.series, abi: tawfSeriesAbi, functionName: 'lastPeriod' }))

    switch (action) {
      case 'reserve': {
        const b = perBank(req.body?.balances)
        if (!b || !(await knownBanks(b.ids))) {
          res.status(400).json({ error: 'balances must map this pool\'s bank ids to rupiah amounts.' })
          return
        }
        const at = await chainNow()
        await send('Bank balances recorded on the pool ledger', () =>
          wc.writeContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'postReserve', args: [at, b.ids, b.sen] }),
        )
        break
      }
      case 'allocate': {
        const list = Array.isArray(req.body?.investors) ? (req.body.investors as unknown[]) : []
        const investors: Address[] = []
        for (const a of list) {
          if (typeof a !== 'string' || !isAddress(a)) {
            res.status(400).json({ error: `Invalid investor address: ${String(a)}` })
            return
          }
          investors.push(getAddress(a) as Address)
        }
        if (investors.length === 0) {
          res.status(400).json({ error: 'investors must be a non-empty array of addresses.' })
          return
        }
        const [at, total, epoch] = await Promise.all([
          publicClient.readContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'snapshotAt' }),
          publicClient.readContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'totalBalance' }),
          publicClient.readContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'reserveEpoch' }),
        ])
        const args = [investors, epoch as bigint, BigInt(at), total as bigint, []] as const
        await publicClient.simulateContract({ account: account().address, address: pool.series, abi: tawfSeriesAbi, functionName: 'allocate', args })
        await send(`Allocated ${investors.length} subscriber(s)`, () =>
          wc.writeContract({ address: pool.series, abi: tawfSeriesAbi, functionName: 'allocate', args }),
        )
        break
      }
      case 'distribute': {
        const p = perBank(req.body?.profits)
        if (!p || !(await knownBanks(p.ids))) {
          res.status(400).json({ error: 'profits must map this pool\'s bank ids to rupiah amounts.' })
          return
        }
        const period = (await lastPeriod()) + 1
        const total = p.sen.reduce((a, v) => a + v, 0n)
        const epoch = await nextEpoch()
        await send(`Bank profit for period ${period} recorded on the pool ledger`, () =>
          wc.writeContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'postProfit', args: [period, p.ids, p.sen] }),
        )
        await fundTreasuryForSen(total, wc, pool.series)
        await send(`Profit period ${period} distributed`, () =>
          wc.writeContract({ address: pool.series, abi: tawfSeriesAbi, functionName: 'distributeProfit', args: [period, total, epoch, []] }),
        )
        break
      }
      case 'settle': {
        const supply = (await publicClient.readContract({ address: pool.token, abi: trexTokenAbi, functionName: 'totalSupply' })) as bigint
        const principal = req.body?.principalIdr === undefined ? supply : BigInt(Math.round(Number(req.body.principalIdr) * 100))
        const finalPeriod = await lastPeriod()
        const at = await chainNow()
        const epoch = await nextEpoch()
        await send('Maturity recorded on the pool ledger', () =>
          wc.writeContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'postMaturity', args: [at, finalPeriod, principal] }),
        )
        await fundTreasuryForSen(principal, wc, pool.series)
        await send('Maturity settled', () =>
          wc.writeContract({ address: pool.series, abi: tawfSeriesAbi, functionName: 'settleMaturity', args: [at, finalPeriod, principal, epoch, []] }),
        )
        break
      }
      default:
        res.status(400).json({ error: 'action must be reserve, allocate, distribute or settle.' })
        return
    }

    res.status(200).json({ action, steps })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Pool action failed'), steps })
  }
}
