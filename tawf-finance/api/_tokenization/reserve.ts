import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Hex, Address } from 'viem'
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
} from './_lib/operator.js'
import { reserveLedgerAbi, sukukDistributorAbi, trexTokenAbi, tawfSeriesAbi } from './_lib/abis.js'

/**
 * Public, cached aggregate for the /proof-of-reserve page (Model B):
 *   - the Tawf deposito series: token supply on Arbitrum vs Tawf's dedicated
 *     account balance at the BPRS (anchored DEPOSITO_RESERVE on seriesId),
 *     backing ratio and fully-backed flag, plus profits credited vs the last
 *     distributed period.
 *   - the sukuk: supply vs anchored outstanding.
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
    const ledger = ledgerClient()
    const reserve = reserveLedgerAddress()

    // --- Tawf deposito series ---
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

    const seriesLine = {
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

    // --- Sukuk ---
    const [sukukSupply, sukukReserve, sukukBacked, sukukSnap] = await Promise.all([
      publicClient.readContract({ address: addresses.sukukToken, abi: trexTokenAbi, functionName: 'totalSupply' }) as Promise<bigint>,
      publicClient.readContract({ address: addresses.sukukDistributor, abi: sukukDistributorAbi, functionName: 'reserveOutstanding' }) as Promise<bigint>,
      publicClient.readContract({ address: addresses.sukukDistributor, abi: sukukDistributorAbi, functionName: 'isFullyBacked' }) as Promise<boolean>,
      ledger.readContract({ address: reserve, abi: reserveLedgerAbi, functionName: 'latestSukukReserve', args: [addresses.sukukId] }) as Promise<{ snapshotAt: bigint; amount: bigint }>,
    ])
    let sukukAnchored = false
    let sukukEpoch: string | null = null
    if (sukukSnap.snapshotAt > 0n) {
      try {
        const proof = await fetchLeafProof('tawf.sukuk.reserve', addresses.sukukId, sukukSnap.snapshotAt, sukukSnap.amount)
        if (proof) { sukukAnchored = true; sukukEpoch = proof.epoch }
      } catch { sukukAnchored = false }
    }
    const sukukRatio = sukukSupply === 0n ? 10000 : Number((sukukReserve * 10000n) / sukukSupply)

    const sukukLine = {
      kind: 'sukuk' as const,
      label: 'BPRS Demo Sukuk 2026',
      symbol: 'tSUKUK-DEMO-2026',
      subject: addresses.sukukId as Address,
      supply: sukukSupply.toString(),
      reserve: sukukReserve.toString(),
      ratioBps: sukukRatio,
      fullyBacked: sukukBacked,
      snapshotAt: Number(sukukSnap.snapshotAt),
      anchored: sukukAnchored,
      epoch: sukukEpoch,
      anchorTxHash: null as Hex | null,
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
      sukuk: sukukLine,
      lastSyncAt,
      ledgerChainId: Number(addresses.ledgerChainId),
      anchor: addresses.anchor,
    })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Failed to load reserve') })
  }
}
