// TawfDepositoSeries: series 1, series 2 and the Deposito pool share one ABI.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ponder } from 'ponder:registry'
import { fxRate, walletPosition } from 'ponder:schema'
import config from '../ponder.config'
import { recordActivity, ts, type Ctx, type Ev, type Product } from './lib/db'

const PRODUCT: Record<string, Product> = { Series1: 'series1', Series2: 'series2', PoolSeries: 'pool' }
const ZERO = 0n

async function bump(ctx: Ctx, e: Ev, product: Product, wallet: `0x${string}`, d: Partial<Record<'subscribedCoin' | 'refundedCoin' | 'allocatedCoin' | 'allocatedSen' | 'profitClaimedCoin' | 'redeemedCoin', bigint>>) {
  const id = `${product}:${wallet.toLowerCase()}`
  const add = (row: any, k: string) => (row[k] as bigint) + (((d as any)[k] as bigint | undefined) ?? ZERO)
  await ctx.db
    .insert(walletPosition)
    .values({
      id,
      product,
      wallet,
      subscribedCoin: d.subscribedCoin ?? ZERO,
      refundedCoin: d.refundedCoin ?? ZERO,
      allocatedCoin: d.allocatedCoin ?? ZERO,
      allocatedSen: d.allocatedSen ?? ZERO,
      profitClaimedCoin: d.profitClaimedCoin ?? ZERO,
      redeemedCoin: d.redeemedCoin ?? ZERO,
      lastEventAt: ts(e),
    })
    .onConflictDoUpdate((row: any) => ({
      subscribedCoin: add(row, 'subscribedCoin'),
      refundedCoin: add(row, 'refundedCoin'),
      allocatedCoin: add(row, 'allocatedCoin'),
      allocatedSen: add(row, 'allocatedSen'),
      profitClaimedCoin: add(row, 'profitClaimedCoin'),
      redeemedCoin: add(row, 'redeemedCoin'),
      lastEventAt: ts(e),
    }))
}

const names = Object.keys(config.contracts).filter((n) => n in PRODUCT)
const on = (name: string, fn: (a: { event: any; context: any }) => Promise<void>) => (ponder as any).on(name, fn)

for (const c of names) {
  const product = PRODUCT[c]!

  on(`${c}:Subscribed`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, product, 'Subscribed', { investor: a.investor, token: a.token, coin: a.coinAmount })
    await bump(context, event, product, a.investor, { subscribedCoin: a.coinAmount })
  })
  on(`${c}:SubscriptionCancelled`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, product, 'SubscriptionCancelled', { investor: a.investor, token: a.token, coin: a.coinRefunded })
    await bump(context, event, product, a.investor, { refundedCoin: a.coinRefunded })
  })
  on(`${c}:Allocated`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, product, 'Allocated', { investor: a.investor, token: a.token, coin: a.coinUsed, sen: a.senMinted })
    await bump(context, event, product, a.investor, { allocatedCoin: a.coinUsed, allocatedSen: a.senMinted })
  })
  on(`${c}:ProfitDistributed`, async ({ event, context }) => {
    await recordActivity(context, event, product, 'ProfitDistributed', { sen: event.args.profitSen, period: Number(event.args.period) })
  })
  on(`${c}:ProfitClaimed`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, product, 'ProfitClaimed', { investor: a.investor, token: a.token, coin: a.coinPaid, sen: a.senClaimed })
    await bump(context, event, product, a.investor, { profitClaimedCoin: a.coinPaid })
  })
  on(`${c}:MaturitySettled`, async ({ event, context }) => {
    await recordActivity(context, event, product, 'MaturitySettled', { sen: event.args.principalSen })
  })
  on(`${c}:Redeemed`, async ({ event, context }) => {
    const a = event.args
    const paid = (a.coinPaid as bigint) + (a.profitCoinPaid as bigint)
    await recordActivity(context, event, product, 'Redeemed', { investor: a.investor, token: a.token, coin: paid, sen: a.units })
    await bump(context, event, product, a.investor, { redeemedCoin: paid })
  })
  on(`${c}:RatePosted`, async ({ event, context }) => {
    const a = event.args
    await context.db
      .insert(fxRate)
      .values({ id: `${event.transaction.hash}:${event.log.logIndex}`, contract: event.log.address, token: a.token, idrPerToken: a.idrPerToken, updatedAt: a.updatedAt, blockNumber: event.block.number, timestamp: ts(event) })
      .onConflictDoNothing()
  })
}
