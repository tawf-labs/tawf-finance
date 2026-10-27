import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Hex } from 'viem'
import {
  publicClient,
  ledgerClient,
  reserveLedgerAddress,
  addresses,
  isConfigured,
  CONNECTOR_URL,
  CONNECTOR_API_KEY,
  fetchLeafProof, fetchWithTimeout,
  readableError,
  pool,
  isPoolConfigured,
} from './_lib/operator.js'
import { reserveLedgerAbi, trexTokenAbi, tawfSeriesAbi, depositoPoolLedgerAbi } from './_lib/abis.js'

/**
 * Public, cached aggregate for the /proof-of-reserve page (Model B):
 *   - the Tawf deposito series: token supply on Arbitrum vs Tawf's dedicated
 *     account balance at the BPRS (anchored DEPOSITO_RESERVE on seriesId),
 *     backing ratio and fully-backed flag, plus profits credited vs the last
 *     distributed period.
 *   - the regional Deposito Pool: token supply vs the total of Tawf's
 *     balances at its BPRS, with each bank's balance from the pool ledger.
 * Also returns the last BPRS sync time.
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
    // --- Tawf deposito series (needs the Tawf Network ledger; tolerate it missing) ---
    let seriesLine: Record<string, unknown> | null = null
    try {
      const ledger = ledgerClient()
      const reserve = reserveLedgerAddress()

      const [seriesSupply, seriesRatio, seriesBacked, seriesLastPeriod, seriesSnap] = await Promise.all([
        publicClient.readContract({ address: addresses.tawfSeriesToken, abi: trexTokenAbi, functionName: 'totalSupply' }) as Promise<bigint>,
        publicClient.readContract({ address: addresses.tawfSeries, abi: tawfSeriesAbi, functionName: 'ratioBps' }) as Promise<bigint>,
        publicClient.readContract({ address: addresses.tawfSeries, abi: tawfSeriesAbi, functionName: 'isFullyBacked' }) as Promise<boolean>,
        publicClient.readContract({ address: addresses.tawfSeries, abi: tawfSeriesAbi, functionName: 'lastPeriod' }) as Promise<number>,
        ledger.readContract({ address: reserve, abi: reserveLedgerAbi, functionName: 'latestDepositoReserve', args: [addresses.tawfSeriesId] }) as Promise<{ snapshotAt: bigint; amount: bigint }>,
      ])
      let seriesAnchored = false
      let seriesEpoch: string | null = null
      if (seriesSnap.snapshotAt > 0n) {
        try {
          const proof = await fetchLeafProof('tawf.deposito.reserve', addresses.tawfSeriesId, seriesSnap.snapshotAt, seriesSnap.amount)
          if (proof) { seriesAnchored = true; seriesEpoch = proof.epoch }
        } catch { seriesAnchored = false }
      }

      // Profits credited (from the connector) vs distributed on chain.
      let profitsCredited: { period: number; amountIdr: number }[] = []
      if (CONNECTOR_URL) {
        try {
          const r = await fetchWithTimeout(`${CONNECTOR_URL}/tawf/status`, { headers: { 'x-api-key': CONNECTOR_API_KEY } })
          if (r.ok) {
            const s = (await r.json()) as { account?: { profitCredits?: { period: number; amountIdr: number }[] } }
            profitsCredited = s.account?.profitCredits ?? []
          }
        } catch { profitsCredited = [] }
      }

      seriesLine = {
        kind: 'series' as const,
        label: 'Tawf Deposito Series 1 (BPRS Demo)',
        symbol: 'tDEP-TAWF-S1',
        subject: addresses.tawfSeriesId,
        supply: seriesSupply.toString(),
        reserve: seriesSnap.amount.toString(),
        ratioBps: Number(seriesRatio),
        fullyBacked: seriesBacked,
        snapshotAt: Number(seriesSnap.snapshotAt),
        anchored: seriesAnchored,
        epoch: seriesEpoch,
        lastDistributedPeriod: Number(seriesLastPeriod),
        profitsCredited,
        anchorTxHash: null as Hex | null,
      }
    } catch (err) {
      console.error('[tokenization] series reserve unavailable', err)
      seriesLine = null
    }

    // --- Regional Deposito Pool ---
    let poolLine: Record<string, unknown> | null = null
    if (isPoolConfigured()) {
      const [poolSupply, poolRatio, poolBacked, poolLastPeriod, poolAt, poolTotal, poolEpoch, poolBanks] = await Promise.all([
        publicClient.readContract({ address: pool.token, abi: trexTokenAbi, functionName: 'totalSupply' }) as Promise<bigint>,
        publicClient.readContract({ address: pool.series, abi: tawfSeriesAbi, functionName: 'ratioBps' }) as Promise<bigint>,
        publicClient.readContract({ address: pool.series, abi: tawfSeriesAbi, functionName: 'isFullyBacked' }) as Promise<boolean>,
        publicClient.readContract({ address: pool.series, abi: tawfSeriesAbi, functionName: 'lastPeriod' }) as Promise<number>,
        publicClient.readContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'snapshotAt' }),
        publicClient.readContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'totalBalance' }),
        publicClient.readContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'reserveEpoch' }),
        publicClient.readContract({ address: pool.ledger, abi: depositoPoolLedgerAbi, functionName: 'banks' }) as Promise<
          readonly [readonly Hex[], readonly string[], readonly string[], readonly bigint[]]
        >,
      ])
      const [ids, names, refs, bals] = poolBanks
      poolLine = {
        kind: 'pool' as const,
        label: 'Tawf Deposito Pool: Jawa Barat',
        symbol: 'tDEP-JABAR-1',
        subject: pool.seriesId,
        ledger: pool.ledger,
        supply: poolSupply.toString(),
        reserve: String(poolTotal),
        ratioBps: Number(poolRatio),
        fullyBacked: poolBacked,
        snapshotAt: Number(poolAt),
        anchored: Number(poolAt) > 0,
        epoch: String(poolEpoch),
        lastDistributedPeriod: Number(poolLastPeriod),
        banks: ids.map((id, i) => ({ id, name: names[i], accountRef: refs[i], balanceSen: bals[i].toString() })),
        anchorTxHash: null as Hex | null,
      }
    }

    let lastSyncAt: string | null = null
    if (CONNECTOR_URL) {
      try {
        const r = await fetchWithTimeout(`${CONNECTOR_URL}/status`, { headers: { 'x-api-key': CONNECTOR_API_KEY } })
        if (r.ok) {
          const s = (await r.json()) as { lastRunAt?: string | null }
          lastSyncAt = s.lastRunAt ?? null
        }
      } catch { lastSyncAt = null }
    }

    res.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=120')
    res.status(200).json({
      series: seriesLine,
      pool: poolLine,
      lastSyncAt,
      ledgerChainId: Number(addresses.ledgerChainId),
      anchor: addresses.anchor,
    })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Failed to load reserve') })
  }
}
