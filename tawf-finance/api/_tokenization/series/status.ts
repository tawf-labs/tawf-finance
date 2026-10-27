import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  publicClient,
  ledgerClient,
  reserveLedgerAddress,
  addresses,
  isConfigured,
  readableError,
} from '../_lib/operator.js'
import { tawfSeriesAbi, sandboxModuleAbi, trexTokenAbi, trexComplianceAbi, reserveLedgerAbi, mockTokenAbi } from '../_lib/abis.js'
import type { Address, Hex } from 'viem'

const MODES = ['PILOT_ONLY', 'SCREENED_GROUP', 'SANDBOX_ADMITTED'] as const

/**
 * Public, cached snapshot of the Tawf deposito series for the investor and
 * admin pages: terms, the per-coin posted FX rates, token supply vs anchored
 * account balance, backing ratio, sandbox mode + caps, redemption state,
 * treasury balances + series allowances per settlement coin, and (when a
 * wallet is given) that wallet's per-coin pending escrow, holdings, claimable
 * profit (sen) and eligibility.
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

    const coinAddrs = (await publicClient.readContract({
      address: series,
      abi: tawfSeriesAbi,
      functionName: 'allowedStablecoins',
    })) as readonly Address[]

    const [termsRaw, reserveSen, ratioBps, fullyBacked, lastPeriod, redemptionOpen, supply, treasury, cfg, investors, snap] =
      await Promise.all([
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'seriesTerms' }) as Promise<{ seriesId: Hex; tenorMonths: number; nisbahBps: number }>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'reserve' }) as Promise<bigint>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'ratioBps' }) as Promise<bigint>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'isFullyBacked' }) as Promise<boolean>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'lastPeriod' }) as Promise<number>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'redemptionOpen' }) as Promise<boolean>,
        publicClient.readContract({ address: token, abi: trexTokenAbi, functionName: 'totalSupply' }) as Promise<bigint>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'treasury' }) as Promise<Address>,
        publicClient.readContract({ address: sandbox, abi: sandboxModuleAbi, functionName: 'configOf', args: [compliance] }) as Promise<readonly [number, Address, Address, bigint, bigint, bigint, bigint, boolean]>,
        publicClient.readContract({ address: sandbox, abi: sandboxModuleAbi, functionName: 'investorCount', args: [compliance] }) as Promise<bigint>,
        ledgerClient().readContract({ address: reserveLedgerAddress(), abi: reserveLedgerAbi, functionName: 'latestDepositoReserve', args: [addresses.tawfSeriesId] }) as Promise<{ snapshotAt: bigint; amount: bigint }>,
      ])

    // Per-coin: posted rate (+ freshness), treasury balance and series allowance.
    const coins = await Promise.all(
      coinAddrs.map(async (coin) => {
        const [rateRaw, allowed, treasuryBal, allowance] = await Promise.all([
          publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'rate', args: [coin] }) as Promise<readonly [bigint, bigint, bigint, boolean]>,
          publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'isStablecoin', args: [coin] }) as Promise<boolean>,
          publicClient.readContract({ address: coin, abi: mockTokenAbi, functionName: 'balanceOf', args: [treasury] }) as Promise<bigint>,
          publicClient.readContract({ address: coin, abi: mockTokenAbi, functionName: 'allowance', args: [treasury, series] }) as Promise<bigint>,
        ])
        return {
          address: coin,
          allowed,
          rate: {
            idrPerToken: rateRaw[0].toString(),
            updatedAt: Number(rateRaw[1]),
            maxAge: Number(rateRaw[2]),
            fresh: rateRaw[3],
          },
          treasuryBalance: treasuryBal.toString(),
          seriesAllowance: allowance.toString(),
        }
      }),
    )

    const wallet = typeof req.query.wallet === 'string' ? (req.query.wallet as Address) : null
    let walletView:
      | { pending: Record<string, string>; holdings: string; claimableSen: string; eligible: boolean }
      | null = null
    if (wallet) {
      const [holdings, claimableSen, eligible] = await Promise.all([
        publicClient.readContract({ address: token, abi: trexTokenAbi, functionName: 'balanceOf', args: [wallet] }) as Promise<bigint>,
        publicClient.readContract({ address: series, abi: tawfSeriesAbi, functionName: 'claimableSen', args: [wallet] }) as Promise<bigint>,
        publicClient.readContract({ address: sandbox, abi: sandboxModuleAbi, functionName: 'isEligible', args: [compliance, wallet] }) as Promise<boolean>,
      ])
      const pendingEntries = await Promise.all(
        coinAddrs.map(async (coin) => {
          const p = (await publicClient.readContract({
            address: series,
            abi: tawfSeriesAbi,
            functionName: 'pending',
            args: [wallet, coin],
          })) as bigint
          return [coin, p.toString()] as const
        }),
      )
      walletView = {
        pending: Object.fromEntries(pendingEntries),
        holdings: holdings.toString(),
        claimableSen: claimableSen.toString(),
        eligible,
      }
    }

    res.setHeader('cache-control', 's-maxage=15, stale-while-revalidate=60')
    res.status(200).json({
      series,
      token,
      sandboxModule: sandbox,
      compliance,
      treasury,
      seriesId: termsRaw.seriesId,
      tenorMonths: Number(termsRaw.tenorMonths),
      nisbahBps: Number(termsRaw.nisbahBps),
      coins,
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
    res.status(500).json({ error: readableError(err, 'Failed to load series') })
  }
}
