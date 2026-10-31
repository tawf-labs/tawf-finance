// Beacon upgrades, Safe executions, owner and threshold changes, token pause and freeze events, and token identity claims.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ponder } from 'ponder:registry'
import { governanceEvent, tokenClaim, tokenControl, tokenIdentityLink, tokenTransferCount } from 'ponder:schema'
import { eq } from 'ponder'
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

// Token ONCHAINID claims (history only). The token an identity belongs to comes from the live link table, which
// Token.UpdatedTokenInformation keeps current (a setOnchainID swap re-maps it), with the deployments keys
// (<token key>Identity) as the starting point and fallback.
const ZERO = '0x0000000000000000000000000000000000000000'
const MAX_CLAIM_DATA_HEX = 2 + 2048 * 2 // 2 KB of data
const MAX_CLAIM_URI = 512

if (has('TokenIdentity') || has('TokenIdentityLinked')) {
  const tokenOf = new Map<string, string>()
  for (const [key, identity] of Object.entries(bySuffix('TokenIdentity'))) {
    const token = addr(key.slice(0, -'Identity'.length))
    if (token) tokenOf.set(identity.toLowerCase(), token)
  }
  const claim = async (context: any, event: any, kind: 'ClaimAdded' | 'ClaimChanged' | 'ClaimRemoved') => {
    const identity = String(event.log.address).toLowerCase() as `0x${string}`
    const link = await context.db.find(tokenIdentityLink, { id: identity })
    const token = (link?.token ?? tokenOf.get(identity) ?? event.log.address) as `0x${string}`
    // A claim on an identity the token no longer points at is history of the old link, not the token's current identity.
    const identityActive = link ? Boolean(link.active) : tokenOf.has(identity)
    const data = String(event.args.data)
    const uri = String(event.args.uri)
    const truncated = data.length > MAX_CLAIM_DATA_HEX || uri.length > MAX_CLAIM_URI
    await context.db
      .insert(tokenClaim)
      .values({
        id: `${event.transaction.hash}:${event.log.logIndex}`,
        token,
        identity: event.log.address,
        kind,
        topic: event.args.topic,
        claimId: event.args.claimId,
        issuer: event.args.issuer,
        scheme: event.args.scheme,
        data: (truncated && data.length > MAX_CLAIM_DATA_HEX ? data.slice(0, MAX_CLAIM_DATA_HEX) : data) as `0x${string}`,
        uri: uri.slice(0, MAX_CLAIM_URI),
        truncated,
        identityActive,
        blockNumber: event.block.number,
        txHash: event.transaction.hash,
        timestamp: ts(event),
      })
      .onConflictDoNothing()
  }
  for (const source of ['TokenIdentity', 'TokenIdentityLinked']) {
    if (!has(source)) continue
    on(`${source}:ClaimAdded`, async ({ event, context }) => claim(context, event, 'ClaimAdded'))
    on(`${source}:ClaimChanged`, async ({ event, context }) => claim(context, event, 'ClaimChanged'))
    on(`${source}:ClaimRemoved`, async ({ event, context }) => claim(context, event, 'ClaimRemoved'))
  }
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
  // setOnchainID emits UpdatedTokenInformation with the new ONCHAINID: record the link and retire the old one.
  on('Token:UpdatedTokenInformation', async ({ event, context }) => {
    const token = event.log.address
    const identity = String(event.args._newOnchainID).toLowerCase() as `0x${string}`
    const previous = await context.db.sql.select().from(tokenIdentityLink).where(eq(tokenIdentityLink.token, token))
    for (const row of previous as any[]) {
      if (row.active && row.id !== identity) await context.db.update(tokenIdentityLink, { id: row.id }).set({ active: false })
    }
    if (identity === ZERO) return
    await context.db
      .insert(tokenIdentityLink)
      .values({ id: identity, token, active: true, blockNumber: event.block.number, txHash: event.transaction.hash })
      .onConflictDoUpdate({ token, active: true, blockNumber: event.block.number, txHash: event.transaction.hash })
  })
  on('Token:Paused', async ({ event, context }) => control(context, event, 'Paused', { account: event.args._userAddress }))
  on('Token:Unpaused', async ({ event, context }) => control(context, event, 'Unpaused', { account: event.args._userAddress }))
  on('Token:AddressFrozen', async ({ event, context }) => control(context, event, 'AddressFrozen', { account: event.args._userAddress, frozen: event.args._isFrozen }))
  on('Token:TokensFrozen', async ({ event, context }) => control(context, event, 'TokensFrozen', { account: event.args._userAddress, amount: event.args._amount }))
  on('Token:TokensUnfrozen', async ({ event, context }) => control(context, event, 'TokensUnfrozen', { account: event.args._userAddress, amount: event.args._amount }))
}
