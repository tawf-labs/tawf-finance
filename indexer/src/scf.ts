// SCF: the multi-coin SukukDistributor, the V1 single-coin one, the investor limit module and the identity registry.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ponder } from 'ponder:registry'
import { identity, scfCoinFlow, scfLimitProfile, scfOffering } from 'ponder:schema'
import config from '../ponder.config'
import { recordActivity, ts, type Ctx, type Ev } from './lib/db'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const
const on = (name: string, fn: (a: { event: any; context: any }) => Promise<void>) => (ponder as any).on(name, fn)
const has = (n: string) => n in config.contracts

type FlowKey = 'subscribed' | 'refunded' | 'profitDistributed' | 'profitClaimed' | 'maturitySettled' | 'redeemedPrincipal' | 'redeemedProfit' | 'toppedUp' | 'payoutParts'

async function flow(ctx: Ctx, distributor: `0x${string}`, coin: `0x${string}`, d: Partial<Record<FlowKey, bigint>>) {
  const keys: FlowKey[] = ['subscribed', 'refunded', 'profitDistributed', 'profitClaimed', 'maturitySettled', 'redeemedPrincipal', 'redeemedProfit', 'toppedUp', 'payoutParts']
  const zero = Object.fromEntries(keys.map((k) => [k, d[k] ?? 0n]))
  await ctx.db
    .insert(scfCoinFlow)
    .values({ id: `${distributor.toLowerCase()}:${coin.toLowerCase()}`, distributor, coin, ...zero })
    .onConflictDoUpdate((row: any) => Object.fromEntries(keys.map((k) => [k, (row[k] as bigint) + (d[k] ?? 0n)])))
}

async function offering(ctx: Ctx, e: Ev, version: 'v1' | 'v2', patch: { status?: string; deadline?: number; raised?: bigint; outstanding?: bigint; reserveEpoch?: number }) {
  await ctx.db
    .insert(scfOffering)
    .values({ id: e.log.address, version, status: patch.status ?? 'open', deadline: patch.deadline ?? null, raised: patch.raised ?? 0n, outstanding: patch.outstanding ?? null, reserveEpoch: patch.reserveEpoch ?? null, updatedAt: ts(e) })
    .onConflictDoUpdate((row: any) => ({
      status: patch.status ?? row.status,
      deadline: patch.deadline ?? row.deadline,
      raised: patch.raised ?? row.raised,
      outstanding: patch.outstanding ?? row.outstanding,
      reserveEpoch: patch.reserveEpoch ?? row.reserveEpoch,
      updatedAt: ts(e),
    }))
}

// Multi-coin distributor. Every money event names its coin, a payout is a summary plus one PayoutPart per coin used.
if (has('ScfDistributor')) {
  const c = 'ScfDistributor'
  on(`${c}:SubscriptionOpened`, async ({ event, context }) => offering(context, event, 'v2', { status: 'open', deadline: Number(event.args.deadline) }))
  on(`${c}:Subscribed`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'scf', 'Subscribed', { investor: a.investor, token: a.coin, coin: a.amount })
    await flow(context, event.log.address, a.coin, { subscribed: a.amount })
  })
  on(`${c}:Issued`, async ({ event, context }) => offering(context, event, 'v2', { status: 'issued', raised: event.args.amount }))
  on(`${c}:SubscriptionCancelled`, async ({ event, context }) => offering(context, event, 'v2', { status: 'cancelled', raised: event.args.raised }))
  on(`${c}:Refunded`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'scf', 'Refunded', { investor: a.investor, token: a.coin, coin: a.amount })
    await flow(context, event.log.address, a.coin, { refunded: a.amount })
  })
  on(`${c}:ProfitDistributed`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'scf', 'ProfitDistributed', { token: a.coin, coin: a.amount, period: Number(a.period) })
    await flow(context, event.log.address, a.coin, { profitDistributed: a.amount })
  })
  on(`${c}:ProfitClaimed`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'scf', 'ProfitClaimed', { investor: a.investor, token: a.coin, coin: a.amount })
    await flow(context, event.log.address, a.coin, { profitClaimed: a.amount })
  })
  on(`${c}:MaturitySettled`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'scf', 'MaturitySettled', { token: a.coin, coin: a.amount })
    await flow(context, event.log.address, a.coin, { maturitySettled: a.amount })
    await offering(context, event, 'v2', { status: 'matured' })
  })
  on(`${c}:DefaultSettled`, async ({ event, context }) => offering(context, event, 'v2', { status: 'defaulted' }))
  on(`${c}:Redeemed`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'scf', 'Redeemed', { investor: a.investor, token: a.coin, coin: (a.principalPaid as bigint) + (a.profitPaid as bigint) })
    await flow(context, event.log.address, a.coin, { redeemedPrincipal: a.principalPaid, redeemedProfit: a.profitPaid })
  })
  on(`${c}:PayoutPart`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'scf', 'PayoutPart', { investor: a.to, token: a.coin, coin: a.amount })
    await flow(context, event.log.address, a.coin, { payoutParts: a.amount })
  })
  on(`${c}:CoinToppedUp`, async ({ event, context }) => flow(context, event.log.address, event.args.coin, { toppedUp: event.args.amount }))
  on(`${c}:ReserveUpdated`, async ({ event, context }) => offering(context, event, 'v2', { outstanding: event.args.outstanding, reserveEpoch: Number(event.args.epoch) }))
}

// V1 distributor (single coin, no coin argument). The coin is stored under the zero address.
if (has('ScfDistributorV1')) {
  const c = 'ScfDistributorV1'
  on(`${c}:Subscribed`, async ({ event, context }) => {
    await recordActivity(context, event, 'scf', 'Subscribed', { investor: event.args.investor, coin: event.args.amount })
    await flow(context, event.log.address, ZERO_ADDR, { subscribed: event.args.amount })
  })
  on(`${c}:Refunded`, async ({ event, context }) => {
    await recordActivity(context, event, 'scf', 'Refunded', { investor: event.args.investor, coin: event.args.amount })
    await flow(context, event.log.address, ZERO_ADDR, { refunded: event.args.amount })
  })
  on(`${c}:ProfitDistributed`, async ({ event, context }) => {
    await recordActivity(context, event, 'scf', 'ProfitDistributed', { coin: event.args.amount, period: Number(event.args.period) })
    await flow(context, event.log.address, ZERO_ADDR, { profitDistributed: event.args.amount })
  })
  on(`${c}:ProfitClaimed`, async ({ event, context }) => {
    await recordActivity(context, event, 'scf', 'ProfitClaimed', { investor: event.args.investor, coin: event.args.amount })
    await flow(context, event.log.address, ZERO_ADDR, { profitClaimed: event.args.amount })
  })
  on(`${c}:MaturitySettled`, async ({ event, context }) => {
    await recordActivity(context, event, 'scf', 'MaturitySettled', { coin: event.args.amount })
    await flow(context, event.log.address, ZERO_ADDR, { maturitySettled: event.args.amount })
    await offering(context, event, 'v1', { status: 'matured' })
  })
  on(`${c}:Redeemed`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'scf', 'Redeemed', { investor: a.investor, coin: (a.principalPaid as bigint) + (a.profitPaid as bigint) })
    await flow(context, event.log.address, ZERO_ADDR, { redeemedPrincipal: a.principalPaid, redeemedProfit: a.profitPaid })
  })
}

// ScfInvestorLimitModule, both generations.
for (const c of ['ScfLimit', 'ScfLimitV1']) {
  if (!has(c)) continue
  on(`${c}:ProfileSet`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'scf', 'ProfileSet', { limit: a.annualLimit, onchainId: a.onchainId })
    await context.db
      .insert(scfLimitProfile)
      .values({ id: `${event.log.address.toLowerCase()}:${(a.onchainId as string).toLowerCase()}`, module: event.log.address, onchainId: a.onchainId, annualLimit: a.annualLimit, bracket: Number(a.bracket), exemption: Number(a.exemption), updatedAt: ts(event) })
      .onConflictDoUpdate({ annualLimit: a.annualLimit, bracket: Number(a.bracket), exemption: Number(a.exemption), updatedAt: ts(event) })
  })
}

if (has('IdentityRegistry')) {
  on('IdentityRegistry:IdentityRegistered', async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'identity', 'IdentityRegistered', { investor: a.investorAddress })
    await context.db
      .insert(identity)
      .values({ wallet: a.investorAddress, identity: a.identity, registeredAt: ts(event), removed: false })
      .onConflictDoUpdate({ identity: a.identity, registeredAt: ts(event), removed: false })
  })
  on('IdentityRegistry:IdentityRemoved', async ({ event, context }) => {
    await context.db.update(identity, { wallet: event.args.investorAddress }).set({ removed: true })
  })
}
