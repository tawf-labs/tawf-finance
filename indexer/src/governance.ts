// Beacon upgrades, Safe executions, owner and threshold changes, timelock calls, and token pause and freeze events.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ponder } from 'ponder:registry'
import { governanceEvent, tokenControl, tokenTransferCount } from 'ponder:schema'
import config from '../ponder.config'
import { ts } from './lib/db'

const on = (name: string, fn: (a: { event: any; context: any }) => Promise<void>) => (ponder as any).on(name, fn)
const has = (n: string) => n in config.contracts

async function gov(context: any, event: any, source: 'beacon' | 'safe' | 'timelock', kind: string, f: { subject?: string | null; value?: bigint | null; ref?: string | null } = {}) {
  await context.db
    .insert(governanceEvent)
    .values({
      id: `${event.transaction.hash}:${event.log.logIndex}`,
      source,
      kind,
      contract: event.log.address,
      subject: f.subject ?? null,
      value: f.value ?? null,
      ref: f.ref ?? null,
      blockNumber: event.block.number,
      txHash: event.transaction.hash,
      timestamp: ts(event),
    })
    .onConflictDoNothing()
}

if (has('Beacon')) {
  on('Beacon:Upgraded', async ({ event, context }) => gov(context, event, 'beacon', 'Upgraded', { subject: event.args.implementation }))
  on('Beacon:OwnershipTransferred', async ({ event, context }) => gov(context, event, 'beacon', 'OwnershipTransferred', { subject: event.args.newOwner }))
}

if (has('Safe')) {
  on('Safe:ExecutionSuccess', async ({ event, context }) => gov(context, event, 'safe', 'ExecutionSuccess', { ref: event.args.txHash, value: event.args.payment }))
  on('Safe:ExecutionFailure', async ({ event, context }) => gov(context, event, 'safe', 'ExecutionFailure', { ref: event.args.txHash, value: event.args.payment }))
  on('Safe:AddedOwner', async ({ event, context }) => gov(context, event, 'safe', 'AddedOwner', { subject: event.args.owner }))
  on('Safe:RemovedOwner', async ({ event, context }) => gov(context, event, 'safe', 'RemovedOwner', { subject: event.args.owner }))
  on('Safe:ChangedThreshold', async ({ event, context }) => gov(context, event, 'safe', 'ChangedThreshold', { value: event.args.threshold }))
}

if (has('Timelock')) {
  on('Timelock:CallScheduled', async ({ event, context }) => gov(context, event, 'timelock', 'CallScheduled', { subject: event.args.target, ref: event.args.id, value: event.args.delay }))
  on('Timelock:CallExecuted', async ({ event, context }) => gov(context, event, 'timelock', 'CallExecuted', { subject: event.args.target, ref: event.args.id, value: event.args.value }))
  on('Timelock:Cancelled', async ({ event, context }) => gov(context, event, 'timelock', 'Cancelled', { ref: event.args.id }))
}

if (has('Token')) {
  const control = async (context: any, event: any, kind: string, f: { account?: string; amount?: bigint; frozen?: boolean }) =>
    context.db
      .insert(tokenControl)
      .values({ id: `${event.transaction.hash}:${event.log.logIndex}`, token: event.log.address, kind, account: f.account ?? null, amount: f.amount ?? null, frozen: f.frozen ?? null, blockNumber: event.block.number, txHash: event.transaction.hash, timestamp: ts(event) })
      .onConflictDoNothing()
  on('Token:Transfer', async ({ event, context }) => {
    await context.db
      .insert(tokenTransferCount)
      .values({ token: event.log.address, transfers: 1n, lastBlock: event.block.number })
      .onConflictDoUpdate((row: any) => ({ transfers: row.transfers + 1n, lastBlock: event.block.number }))
  })
  on('Token:Paused', async ({ event, context }) => control(context, event, 'Paused', { account: event.args._userAddress }))
  on('Token:Unpaused', async ({ event, context }) => control(context, event, 'Unpaused', { account: event.args._userAddress }))
  on('Token:AddressFrozen', async ({ event, context }) => control(context, event, 'AddressFrozen', { account: event.args._userAddress, frozen: event.args._isFrozen }))
  on('Token:TokensFrozen', async ({ event, context }) => control(context, event, 'TokensFrozen', { account: event.args._userAddress, amount: event.args._amount }))
  on('Token:TokensUnfrozen', async ({ event, context }) => control(context, event, 'TokensUnfrozen', { account: event.args._userAddress, amount: event.args._amount }))
}
