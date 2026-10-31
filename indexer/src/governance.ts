// Beacon upgrades, Safe executions, owner and threshold changes, token pause and freeze events, and token identity claims.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ponder } from 'ponder:registry'
import { governanceEvent, tokenClaim, tokenControl, tokenTransferCount } from 'ponder:schema'
import config from '../ponder.config'
import { ts } from './lib/db'
import { bySuffix, addr } from './lib/deployments'

const on = (name: string, fn: (a: { event: any; context: any }) => Promise<void>) => (ponder as any).on(name, fn)
const has = (n: string) => n in config.contracts

async function gov(context: any, event: any, source: 'beacon' | 'safe', kind: string, f: { subject?: string | null; value?: bigint | null; ref?: string | null } = {}) {
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

// Token ONCHAINID claims: which token an identity belongs to comes from the deployments keys (<token key>Identity).
if (has('TokenIdentity')) {
  const tokenOf = new Map<string, string>()
  for (const [key, identity] of Object.entries(bySuffix('TokenIdentity'))) {
    const token = addr(key.slice(0, -'Identity'.length))
    if (token) tokenOf.set(identity.toLowerCase(), token)
  }
  const claim = async (context: any, event: any, kind: 'ClaimAdded' | 'ClaimChanged' | 'ClaimRemoved') =>
    context.db
      .insert(tokenClaim)
      .values({
        id: `${event.transaction.hash}:${event.log.logIndex}`,
        token: (tokenOf.get(String(event.log.address).toLowerCase()) ?? event.log.address) as `0x${string}`,
        identity: event.log.address,
        kind,
        topic: event.args.topic,
        claimId: event.args.claimId,
        issuer: event.args.issuer,
        scheme: event.args.scheme,
        data: event.args.data,
        uri: event.args.uri,
        blockNumber: event.block.number,
        txHash: event.transaction.hash,
        timestamp: ts(event),
      })
      .onConflictDoNothing()
  on('TokenIdentity:ClaimAdded', async ({ event, context }) => claim(context, event, 'ClaimAdded'))
  on('TokenIdentity:ClaimChanged', async ({ event, context }) => claim(context, event, 'ClaimChanged'))
  on('TokenIdentity:ClaimRemoved', async ({ event, context }) => claim(context, event, 'ClaimRemoved'))
}

if (has('Safe')) {
  on('Safe:ExecutionSuccess', async ({ event, context }) => gov(context, event, 'safe', 'ExecutionSuccess', { ref: event.args.txHash, value: event.args.payment }))
  on('Safe:ExecutionFailure', async ({ event, context }) => gov(context, event, 'safe', 'ExecutionFailure', { ref: event.args.txHash, value: event.args.payment }))
  on('Safe:AddedOwner', async ({ event, context }) => gov(context, event, 'safe', 'AddedOwner', { subject: event.args.owner }))
  on('Safe:RemovedOwner', async ({ event, context }) => gov(context, event, 'safe', 'RemovedOwner', { subject: event.args.owner }))
  on('Safe:ChangedThreshold', async ({ event, context }) => gov(context, event, 'safe', 'ChangedThreshold', { value: event.args.threshold }))
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
