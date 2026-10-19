import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  publicClient,
  ledgerClient,
  reserveLedgerAddress,
  addresses,
  isConfigured,
} from '../_lib/operator.js'
import { tawfSeriesAbi, sandboxModuleAbi, trexTokenAbi, trexComplianceAbi, reserveLedgerAbi } from '../_lib/abis.js'
import type { Address, Hex } from 'viem'

const MODES = ['PILOT_ONLY', 'SCREENED_GROUP', 'SANDBOX_ADMITTED'] as const

/**
 * Public, cached snapshot of the Tawf deposito series for the investor and
 * admin pages: terms, posted FX rate, token supply vs anchored account
 * balance, backing ratio, sandbox mode + caps, redemption state, and (when a
 * wallet is given) that wallet's pending escrow, holdings and eligibility.
 *
 *   GET /api/tokenization/series/status?wallet=0x..
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }

  try {
    const series = addresses.tawfSeries
    const token = addresses.tawfSeriesToken
    const sandbox = addresses.sandboxModule

    const compliance = (await publicClient.readContract({
      address: token,
      abi: trexComplianceAbi,
      functionName: 'compliance',
    })) as Address

    const [termsRaw, rateRaw, reserveSen, ratioBps, fullyBacked, lastPeriod, redemptionOpen, supply, cfg, investors, snap] =
      await Promise.all([
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'seriesTerms' }) as Promise<{ seriesId: Hex; tenorMonths: number; nisbahBps: number }>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'rate' }) as Promise<readonly [bigint, bigint, bigint, boolean]>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'reserve' }) as Promise<bigint>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'ratioBps' }) as Promise<bigint>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'isFullyBacked' }) as Promise<boolean>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'lastPeriod' }) as Promise<number>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'redemptionOpen' }) as Promise<boolean>,
        publicClient.readContract({ address: token, abi: trexTokenAbi, functionName: 'totalSupply' }) as Promise<bigint>,
        publicClient.readContract({ address: sandbox, abi: sandboxModuleAbi, functionName: 'configOf', args: [compliance] }) as Promise<readonly [number, Address, Address, bigint, bigint, bigint, bigint, boolean]>,
        publicClient.readContract({ address: sandbox, abi: sandboxModuleAbi, functionName: 'investorCount', args: [compliance] }) as Promise<bigint>,
        ledgerClient().readContract({ address: reserveLedgerAddress(), abi: reserveLedgerAbi, functionName: 'latestDepositoReserve', args: [addresses.tawfSeriesId] }) as Promise<{ snapshotAt: bigint; amount: bigint }>,
      ])

    const wallet = typeof req.query.wallet === 'string' ? (req.query.wallet as Address) : null
    let walletView: { pending: string; holdings: string; claimable: string; eligible: boolean } | null = null
    if (wallet) {
      const [pending, holdings, claimable, eligible] = await Promise.all([
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'pending', args: [wallet] }) as Promise<bigint>,
        publicClient.readContract({ address: token, abi: trexTokenAbi, functionName: 'balanceOf', args: [wallet] }) as Promise<bigint>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'claimable', args: [wallet] }) as Promise<bigint>,
        publicClient.readContract({ address: sandbox, abi: sandboxModuleAbi, functionName: 'isEligible', args: [compliance, wallet] }) as Promise<boolean>,
      ])
      walletView = {
        pending: pending.toString(),
        holdings: holdings.toString(),
        claimable: claimable.toString(),
        eligible,
      }
    }

    res.setHeader('cache-control', 's-maxage=15, stale-while-revalidate=60')
    res.status(200).json({
      series,
      token,
      sandboxModule: sandbox,
      compliance,
      seriesId: termsRaw.seriesId,
      tenorMonths: Number(termsRaw.tenorMonths),
      nisbahBps: Number(termsRaw.nisbahBps),
      rate: {
        idrPerUsdc: rateRaw[0].toString(),
        updatedAt: Number(rateRaw[1]),
        maxAge: Number(rateRaw[2]),
        fresh: rateRaw[3],
      },
      supply: supply.toString(),
      reserveSen: reserveSen.toString(),
      ratioBps: Number(ratioBps),
      fullyBacked,
      lastPeriod: Number(lastPeriod),
      redemptionOpen,
      ledgerSnapshotAt: Number(snap.snapshotAt),
      ledgerReserveSen: snap.amount.toString(),
      sandbox: {
        mode: MODES[cfg[0]] ?? `Unknown(${cfg[0]})`,
        treasury: cfg[1],
        claimIssuer: cfg[2],
        maxInvestors: cfg[3].toString(),
        maxBalancePerInvestor: cfg[4].toString(),
        seriesCap: cfg[5].toString(),
        seriesEnd: Number(cfg[6]),
        investorCount: investors.toString(),
      },
      wallet: walletView,
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? 'Failed to load series' })
  }
}
