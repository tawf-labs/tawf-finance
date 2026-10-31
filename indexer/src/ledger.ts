// DepositoPoolLedger: per-bank balances and profit, epoch totals.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ponder } from 'ponder:registry'
import { bank, bankProfit, bankSnapshot, ledgerEpoch } from 'ponder:schema'
import config from '../ponder.config'
import { recordActivity, ts } from './lib/db'

const on = (name: string, fn: (a: { event: any; context: any }) => Promise<void>) => (ponder as any).on(name, fn)

if ('DepositoLedger' in config.contracts) {
  const c = 'DepositoLedger'
  on(`${c}:BankAdded`, async ({ event, context }) => {
    const a = event.args
    await context.db.insert(bank).values({ id: a.bankId, name: a.name, accountRef: a.accountRef, addedAt: ts(event) }).onConflictDoUpdate({ name: a.name, accountRef: a.accountRef })
  })
  on(`${c}:BankBalance`, async ({ event, context }) => {
    const a = event.args
    await context.db
      .insert(bankSnapshot)
      .values({ epoch: a.epoch, bankId: a.bankId, snapshotAt: a.snapshotAt, balanceSen: a.balance, blockNumber: event.block.number, timestamp: ts(event) })
      .onConflictDoUpdate({ snapshotAt: a.snapshotAt, balanceSen: a.balance, blockNumber: event.block.number, timestamp: ts(event) })
  })
  on(`${c}:BankProfit`, async ({ event, context }) => {
    const a = event.args
    await context.db
      .insert(bankProfit)
      .values({ period: Number(a.period), bankId: a.bankId, profitSen: a.profit, blockNumber: event.block.number, timestamp: ts(event) })
      .onConflictDoUpdate({ profitSen: a.profit, blockNumber: event.block.number, timestamp: ts(event) })
  })
  on(`${c}:ReserveRecorded`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'ledger', 'ReserveRecorded', { sen: a.total })
    await context.db
      .insert(ledgerEpoch)
      .values({ id: `reserve:${a.epoch}`, kind: 'reserve', epoch: a.epoch, period: null, snapshotAt: a.snapshotAt, totalSen: a.total, blockNumber: event.block.number, timestamp: ts(event) })
      .onConflictDoUpdate({ snapshotAt: a.snapshotAt, totalSen: a.total, blockNumber: event.block.number, timestamp: ts(event) })
  })
  on(`${c}:ProfitRecorded`, async ({ event, context }) => {
    const a = event.args
    await recordActivity(context, event, 'ledger', 'ProfitRecorded', { sen: a.total, period: Number(a.period) })
    await context.db
      .insert(ledgerEpoch)
      .values({ id: `profit:${a.epoch}`, kind: 'profit', epoch: a.epoch, period: Number(a.period), snapshotAt: null, totalSen: a.total, blockNumber: event.block.number, timestamp: ts(event) })
      .onConflictDoUpdate({ period: Number(a.period), totalSen: a.total, blockNumber: event.block.number, timestamp: ts(event) })
  })
  on(`${c}:MaturityRecorded`, async ({ event, context }) => {
    const a = event.args
    await context.db
      .insert(ledgerEpoch)
      .values({ id: `maturity:${a.epoch}`, kind: 'maturity', epoch: a.epoch, period: Number(a.finalPeriod), snapshotAt: a.at, totalSen: a.principal, blockNumber: event.block.number, timestamp: ts(event) })
      .onConflictDoUpdate({ period: Number(a.finalPeriod), snapshotAt: a.at, totalSen: a.principal, blockNumber: event.block.number, timestamp: ts(event) })
  })
}
