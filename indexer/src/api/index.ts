/* eslint-disable @typescript-eslint/no-explicit-any */
import { timingSafeEqual } from 'node:crypto'
import { db } from 'ponder:api'
import * as schema from 'ponder:schema'
import { Hono } from 'hono'
import { client, desc, eq, graphql, inArray, or, and, isNull, replaceBigInts } from 'ponder'
import { getAddress, isAddress } from 'viem'
import { addr } from '../lib/deployments'

const app = new Hono()
const tables = schema as any
const str = (v: bigint) => v.toString()
const json = (c: any, body: unknown) => c.json(replaceBigInts(body, str))
const checksum = (a: string | null) => (a && isAddress(a) ? getAddress(a) : a)
const limitOf = (v: string | undefined, def: number, max: number) => Math.min(Math.max(Number.parseInt(v ?? '', 10) || def, 1), max)

// /health, /ready, /metrics and /status are served by Ponder itself. Everything below needs the bearer token.
// The Vercel API holds the token, the browser never calls this service directly.
function authorized(header: string | undefined): boolean {
  const token = process.env.PONDER_API_TOKEN
  if (!token) return false
  const given = /^Bearer (.+)$/i.exec(header ?? '')?.[1] ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  if (path === '/health' || path === '/ready') return next()
  if (!process.env.PONDER_API_TOKEN) return c.json({ error: 'PONDER_API_TOKEN is not set on the indexer.' }, 503)
  if (!authorized(c.req.header('authorization'))) return c.json({ error: 'Unauthorized' }, 401)
  return next()
})

// Generic query surfaces: GraphQL, and SQL over HTTP for @ponder/client.
app.use('/graphql', graphql({ db, schema }))
app.use('/sql/*', client({ db, schema }))

const GLOBAL_KINDS = ['ProfitDistributed', 'MaturitySettled']

/**
 * Same JSON as GET /api/tokenization/activity: { toBlock, partial, source, wallet, events }.
 * With a wallet: that wallet's own events plus the pool-wide profit and maturity events. Without: the admin feed.
 */
app.get('/activity', async (c) => {
  const q = c.req.query('wallet')
  if (q !== undefined && !isAddress(q)) return c.json({ error: 'wallet must be a single valid address.' }, 400)
  const from = c.req.query('from')
  if (from !== undefined && !/^\d+$/.test(from)) return c.json({ error: 'from must be a non-negative integer block number.' }, 400)
  const a = tables.activity
  const wallet = q ? (q.toLowerCase() as `0x${string}`) : null
  // The app's products are pool, series1, scf, ledger and identity. Series 2 is a separate contract the app does not show, so it is left out unless ?include=series2.
  const withSeries2 = c.req.query('include') === 'series2'
  const shown = withSeries2 ? ['pool', 'series1', 'series2', 'scf', 'ledger', 'identity'] : ['pool', 'series1', 'scf', 'ledger', 'identity']
  const where = wallet
    ? or(and(eq(a.investor, wallet), inArray(a.product, ['pool', 'series1', 'series2', 'scf'].filter((p) => shown.includes(p)))), and(isNull(a.investor), inArray(a.kind, GLOBAL_KINDS), inArray(a.product, shown)))
    : inArray(a.product, shown)
  const rows = await db
    .select()
    .from(a)
    .where(where)
    .orderBy(desc(a.blockNumber), desc(a.id))
    .limit(300)
  const events = rows
    .filter((r: any) => from === undefined || r.blockNumber >= BigInt(from))
    .map((r: any) => ({
      id: r.id,
      product: r.product,
      kind: r.kind,
      txHash: r.txHash,
      blockNumber: r.blockNumber.toString(),
      timestamp: r.timestamp,
      investor: checksum(r.investor),
      token: checksum(r.token),
      coin: r.coin === null ? null : r.coin.toString(),
      sen: r.sen === null ? null : r.sen.toString(),
      limit: r.limit === null ? null : r.limit.toString(),
      ...(r.kind === 'ProfileSet' && r.onchainId ? { onchainId: checksum(r.onchainId) } : {}),
      period: r.period,
    }))
  const toBlock = rows.length ? rows[0].blockNumber.toString() : '0'
  return c.json({ toBlock, partial: false, source: 'ponder', wallet: wallet ? getAddress(wallet) : null, events })
})

/** Beacon upgrades, Safe executions, owner and threshold changes. Newest first. */
app.get('/governance', async (c) => {
  const g = tables.governanceEvent
  const source = c.req.query('source')
  const rows = await db
    .select()
    .from(g)
    .where(source ? eq(g.source, source) : undefined)
    .orderBy(desc(g.blockNumber), desc(g.id))
    .limit(limitOf(c.req.query('limit'), 100, 500))
  const all = await db.select().from(g).orderBy(desc(g.blockNumber))
  // Current state per contract, from the full history.
  const beacons: Record<string, { implementation: string | null; owner: string | null; upgrades: number }> = {}
  const safes: Record<string, { threshold: string | null; executions: number; failures: number }> = {}
  for (const r of [...all].reverse() as any[]) {
    if (r.source === 'beacon') {
      const b = (beacons[r.contract] ??= { implementation: null, owner: null, upgrades: 0 })
      if (r.kind === 'Upgraded') {
        b.implementation = r.subject
        b.upgrades += 1
      }
      if (r.kind === 'OwnershipTransferred') b.owner = r.subject
    }
    if (r.source === 'safe') {
      const s = (safes[r.contract] ??= { threshold: null, executions: 0, failures: 0 })
      if (r.kind === 'ChangedThreshold') s.threshold = r.value === null ? null : r.value.toString()
      if (r.kind === 'ExecutionSuccess') s.executions += 1
      if (r.kind === 'ExecutionFailure') s.failures += 1
    }
  }
  return json(c, { beacons, safes, events: rows })
})

/**
 * Claim events on the token ONCHAINIDs (topics 10 to 13), newest first. HISTORY ONLY: this says when claims changed, never
 * that a claim is valid or trusted. Verify through /api/tokenization/token-identity, which checks the issuer signature and
 * the TrustedIssuersRegistry live. ?token= and ?topic= narrow it. A bad topic or limit is a 400.
 */
app.get('/token-claims', async (c) => {
  const t = tables.tokenClaim
  const token = c.req.query('token')
  const topic = c.req.query('topic')
  const limit = c.req.query('limit')
  if (token !== undefined && !isAddress(token)) return c.json({ error: 'token must be a valid address.' }, 400)
  if (topic !== undefined && !/^\d{1,3}$/.test(topic)) return c.json({ error: 'topic must be a small integer.' }, 400)
  if (limit !== undefined && !/^\d{1,3}$/.test(limit)) return c.json({ error: 'limit must be a small integer.' }, 400)
  const filters = [token ? eq(t.token, token.toLowerCase() as `0x${string}`) : undefined, topic ? eq(t.topic, BigInt(topic)) : undefined].filter((f) => f !== undefined)
  const rows = await db
    .select()
    .from(t)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(t.blockNumber), desc(t.id))
    .limit(limitOf(limit, 100, 500))
  // Whether each identity is the token's current one RIGHT NOW (a later setOnchainID swap retires it).
  const tokens = [...new Set(rows.map((r: any) => r.token as `0x${string}`))]
  const links = tokens.length ? await db.select().from(tables.tokenIdentityLink).where(inArray(tables.tokenIdentityLink.token, tokens)) : []
  const currentOf = new Map<string, boolean>(links.map((l: any) => [String(l.id).toLowerCase(), Boolean(l.active)]))
  const events = rows.map((r: any) => ({ ...r, identityCurrent: currentOf.get(String(r.identity).toLowerCase()) ?? r.identityActive }))
  return json(c, { note: 'History only. Verify a claim with the token-identity API before relying on it. identityActive is the link when the event was indexed, identityCurrent is the link now.', events })
})

// Coins are labelled by address from the deployments file, never by an on-chain symbol (a mock can report another one).
const COIN_KEYS: Record<string, string> = { mockUsdc: 'USDC', mockUsdt: 'USDT', mockUsdg: 'USDG', usdg: 'USDG' }
const coinLabel = (coin: string) => Object.entries(COIN_KEYS).find(([k]) => addr(k)?.toLowerCase() === coin.toLowerCase())?.[1] ?? null

/** Raised, refunded and paid out per distributor and coin, from the SCF events (PayoutPart gives the coins actually paid). */
app.get('/scf/flows', async (c) => {
  const offerings = await db.select().from(tables.scfOffering)
  const flows = await db.select().from(tables.scfCoinFlow)
  const limits = await db.select().from(tables.scfLimitProfile)
  return json(c, {
    offerings: offerings.map((o: any) => ({ ...o, coins: flows.filter((f: any) => f.distributor === o.id).map((f: any) => ({ ...f, symbol: coinLabel(f.coin) })) })),
    limitProfiles: limits.length,
  })
})

/** Banks with their latest balance, plus the balance and profit time series. ?bank=<bankId> narrows the series. */
app.get('/banks', async (c) => {
  const bankId = c.req.query('bank')?.toLowerCase()
  const banks = await db.select().from(tables.bank)
  const snaps = await db.select().from(tables.bankSnapshot).orderBy(desc(tables.bankSnapshot.epoch))
  const profits = await db.select().from(tables.bankProfit).orderBy(desc(tables.bankProfit.period))
  const epochs = await db.select().from(tables.ledgerEpoch).orderBy(desc(tables.ledgerEpoch.epoch))
  const pick = (rows: any[]) => (bankId ? rows.filter((r) => r.bankId.toLowerCase() === bankId) : rows)
  return json(c, {
    banks: banks.map((b: any) => ({ ...b, latest: snaps.find((s: any) => s.bankId === b.id) ?? null })),
    snapshots: pick(snaps),
    profits: pick(profits),
    epochs,
  })
})

export default app
