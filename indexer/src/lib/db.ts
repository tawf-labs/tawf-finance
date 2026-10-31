// Small helpers shared by the indexing functions. Ponder's context and event types depend on which contracts the
// config includes (a contract whose address is not deployed yet is left out), so the handlers take loose types here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { activity } from 'ponder:schema'

export type Ctx = { db: any }
export type Ev = {
  id: string
  args: Record<string, any>
  log: { address: `0x${string}`; logIndex: number }
  block: { number: bigint; timestamp: bigint }
  transaction: { hash: `0x${string}` }
}

export const ts = (e: Ev) => Number(e.block.timestamp)

export type Product = 'pool' | 'series1' | 'series2' | 'scf' | 'ledger' | 'identity'

/** One activity row per event, same fields as ActivityEvent in the app's activity API. */
export async function recordActivity(
  { db }: Ctx,
  e: Ev,
  product: Product,
  kind: string,
  f: {
    investor?: `0x${string}` | null
    token?: `0x${string}` | null
    coin?: bigint | null
    sen?: bigint | null
    limit?: bigint | null
    onchainId?: `0x${string}` | null
    period?: number | null
  } = {},
) {
  await db
    .insert(activity)
    .values({
      id: `${e.transaction.hash}:${e.log.logIndex}`,
      product,
      kind,
      txHash: e.transaction.hash,
      blockNumber: e.block.number,
      timestamp: ts(e),
      contract: e.log.address,
      investor: f.investor ?? null,
      token: f.token ?? null,
      coin: f.coin ?? null,
      sen: f.sen ?? null,
      limit: f.limit ?? null,
      onchainId: f.onchainId ?? null,
      period: f.period ?? null,
    })
    .onConflictDoNothing()
}
