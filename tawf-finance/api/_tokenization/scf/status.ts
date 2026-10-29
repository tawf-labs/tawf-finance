import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, parseAbi, type Address } from 'viem'
import { publicClient, addresses, isScfConfigured, methodGuard, readableError } from '../_lib/operator.js'
import { scfLimitModuleAbi, sukukDistributorAbi } from '../_lib/abis.js'

const extraAbi = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function subscriptionDeadline() view returns (uint40)',
  'function lastPeriod() view returns (uint16)',
  'function reserveOutstanding() view returns (uint256)',
  'function reserveSnapshotAt() view returns (uint64)',
  'function isFullyBacked() view returns (bool)',
])

const STATUS = ['Pending', 'Subscription', 'Active', 'Matured', 'Defaulted', 'Cancelled'] as const

/**
 * Public state of the securities crowdfunding (SCF) offering, and the
 * wallet's POJK 57/2020 investor limit when `wallet` is given.
 *
 *   GET /api/tokenization/scf/status?wallet=0x...
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, 'GET')) return
  if (!isScfConfigured()) {
    res.status(200).json({ configured: false })
    return
  }

  try {
    const dist = addresses.scfDistributor
    const [terms, status, raised, deadline, lastPeriod, reserve, snapshotAt, fullyBacked, offering] = await Promise.all([
      publicClient.readContract({ address: dist, abi: sukukDistributorAbi, functionName: 'terms' }) as Promise<readonly unknown[]>,
      publicClient.readContract({ address: dist, abi: sukukDistributorAbi, functionName: 'status' }),
      publicClient.readContract({ address: addresses.scfToken, abi: extraAbi, functionName: 'totalSupply' }),
      publicClient.readContract({ address: dist, abi: extraAbi, functionName: 'subscriptionDeadline' }),
      publicClient.readContract({ address: dist, abi: extraAbi, functionName: 'lastPeriod' }),
      publicClient.readContract({ address: dist, abi: extraAbi, functionName: 'reserveOutstanding' }),
      publicClient.readContract({ address: dist, abi: extraAbi, functionName: 'reserveSnapshotAt' }),
      publicClient.readContract({ address: dist, abi: extraAbi, functionName: 'isFullyBacked' }),
      publicClient.readContract({ address: addresses.scfLimitModule, abi: scfLimitModuleAbi, functionName: 'offeringOf', args: [addresses.scfCompliance] }),
    ])

    let investor: Record<string, string | number> | null = null
    const w = req.query?.wallet
    if (typeof w === 'string' && isAddress(w)) {
      const [limit, used, remaining, exemption] = (await publicClient.readContract({
        address: addresses.scfLimitModule,
        abi: scfLimitModuleAbi,
        functionName: 'remainingOf',
        args: [getAddress(w) as Address],
      })) as readonly [bigint, bigint, bigint, number]
      investor = {
        wallet: getAddress(w),
        limit: limit.toString(),
        used: used.toString(),
        remaining: remaining.toString(),
        exemption: Number(exemption),
      }
    }

    res.status(200).json({
      configured: true,
      distributor: dist,
      token: addresses.scfToken,
      limitModule: addresses.scfLimitModule,
      anchor: addresses.scfAnchor,
      status: STATUS[Number(status)] ?? String(status),
      faceValue: String(terms[1]),
      maturity: Number(terms[2]),
      minRaise: String(terms[3]),
      minSubscription: String(terms[4]),
      issuerTreasury: terms[6],
      raised: String(raised),
      subscriptionDeadline: Number(deadline),
      lastPeriod: Number(lastPeriod),
      reserve: String(reserve),
      supply: String(raised),
      reserveSnapshotAt: Number(snapshotAt),
      isFullyBacked: Boolean(fullyBacked),
      offeringCap: String((offering as readonly unknown[])[1]),
      investor,
    })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Could not read the offering') })
  }
}
