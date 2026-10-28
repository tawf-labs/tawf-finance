/**
 * Create or update the QuickNode Stream (activity index) and, optionally, the alert Webhook.
 * Idempotent: each is found by name first and updated in place. Without --apply it only prints the plan.
 *
 *   npx tsx scripts/quicknode-setup.ts                       plan only
 *   npx tsx scripts/quicknode-setup.ts --apply               create or update the stream, kept paused (no webhook)
 *   npx tsx scripts/quicknode-setup.ts --apply --activate    run the stream and create or update the alert webhook
 *                                                            (a new webhook is active at once, so only --activate makes it)
 *   --base <url>   deployment to deliver to (default https://app.tawf.finance)
 *
 * Env: QUICKNODE_API_KEY, QN_STREAM_TOKEN, QN_ALERT_TOKEN (the static x-tawf-token the handlers check).
 * Nothing secret is printed.
 */
import { toEventSelector } from 'viem'
import { sources, GLOBAL } from '../api/_tokenization/_lib/activity-core.js'

const API = 'https://api.quicknode.com'
const STREAM_NAME = 'tawf-activity'
const WEBHOOK_NAME = 'tawf-alerts'

const args = process.argv.slice(2)
const flag = (f: string) => args.includes(f)
const base = (args[args.indexOf('--base') + 1] && args.includes('--base') ? args[args.indexOf('--base') + 1] : 'https://app.tawf.finance').replace(/\/$/, '')
// Tokens are sent to --base, so only our own hosts are accepted.
const host = (() => {
  try {
    const u = new URL(base)
    return u.protocol === 'https:' ? u.hostname : ''
  } catch {
    return ''
  }
})()
if (!(host === 'app.tawf.finance' || /^tawf-finance(-[a-z0-9-]+)?-muhammad-zidan-fatonies-projects\.vercel\.app$/.test(host))) {
  throw new Error('--base must be https://app.tawf.finance or a Vercel deployment of this project.')
}
const apply = flag('--apply')

const key = process.env.QUICKNODE_API_KEY
if (!key) throw new Error('QUICKNODE_API_KEY is not set.')
/** Printed text never carries a secret. */
const redact = (t: string) => [key, process.env.QN_STREAM_TOKEN, process.env.QN_ALERT_TOKEN].reduce((a, v) => (v ? a.replaceAll(v, '[hidden]') : a), t)

async function qn<T>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'x-api-key': key!, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let json: unknown = text
  try {
    json = JSON.parse(text)
  } catch {
    // keep the text
  }
  return { status: r.status, json: json as T }
}

const srcs = sources()
const addresses = [...new Set(srcs.map((s) => s.address.toLowerCase()))]
const topic0s = [...new Set(srcs.flatMap((s) => s.events.map((e) => toEventSelector(e))))]
const startBlock = Math.min(...srcs.map((s) => Number(s.from)).filter((n) => n > 0))

/** Runs inside QuickNode: keep our contracts' events, plus a heartbeat every ~500 blocks so the index knows how far the stream got. */
const filterFunction = `function main(stream) {
  var ADDR = ${JSON.stringify(addresses)};
  var T0 = ${JSON.stringify(topic0s)};
  var m = stream.metadata || {};
  var logs = [];
  var walk = function (x) {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && x.address && x.topics) logs.push(x);
  };
  walk(stream.data);
  var hit = logs.filter(function (l) {
    return ADDR.indexOf(String(l.address).toLowerCase()) >= 0 && l.topics && T0.indexOf(l.topics[0]) >= 0;
  });
  // The batch range comes from the stream metadata. Without it, fall back to the block numbers of the
  // logs themselves (a batch is 5 blocks), so the heartbeat never depends on the metadata being there.
  var num = function (v) { return typeof v === 'string' ? parseInt(v, v.indexOf('0x') === 0 ? 16 : 10) : Number(v); };
  var top = 0;
  logs.forEach(function (l) { var b = num(l.blockNumber); if (b > top) top = b; });
  var end = Number(m.batch_end_range || 0) || top;
  var start = Number(m.batch_start_range || 0) || (end > 0 ? end - 4 : 0);
  // True when the batch holds a block that is a multiple of 500. Batches are aligned to 5 and 500 is a
  // multiple of 5, so comparing floor(start / 500) with floor(end / 500) alone would never be true.
  var beat = end > 0 && Math.floor(end / 500) !== Math.floor((start - 1) / 500);
  if (hit.length === 0 && !beat) return null;
  var out = hit.map(function (l) {
    return { address: l.address, topics: l.topics, data: l.data, blockNumber: l.blockNumber, transactionHash: l.transactionHash, logIndex: l.logIndex, removed: l.removed };
  });
  if (end > 0) out.push({ heartbeat: end });
  return out;
}`

async function setupStream() {
  const token = process.env.QN_STREAM_TOKEN
  if (apply && (!token || token.length < 32)) throw new Error('QN_STREAM_TOKEN must be set (32+ characters).')
  const payload = {
    name: STREAM_NAME,
    network: 'arbitrum-sepolia',
    dataset: 'logs',
    region: 'usa_east',
    start_range: startBlock,
    end_range: -1,
    dataset_batch_size: 5,
    elastic_batch_enabled: false,
    include_stream_metadata: 'body',
    status: flag('--activate') ? 'active' : 'paused',
    filter_function: Buffer.from(filterFunction).toString('base64'),
    destination: 'webhook',
    destination_attributes: {
      url: `${base}/api/tokenization/qn/stream`,
      compression: 'none',
      max_retry: 5,
      retry_interval_sec: 2,
      post_timeout_sec: 20,
      security_token: token ?? '',
      headers: { 'x-tawf-token': token ?? '' },
    },
  }
  console.log(`stream ${STREAM_NAME}: ${addresses.length} contracts, ${topic0s.length} topics, from block ${startBlock}, status ${payload.status}, delivers to ${payload.destination_attributes.url}`)
  if (!apply) return
  const list = await qn<{ data: { id: string; name: string }[] }>('GET', '/streams/rest/v1/streams')
  const existing = list.json.data?.find((s) => s.name === STREAM_NAME)
  if (existing) {
    // Block range, region and dataset are fixed at creation, so only the mutable parts are updated.
    const { name, status, filter_function, destination_attributes } = payload
    const r = await qn('PATCH', `/streams/rest/v1/streams/${existing.id}`, { name, status, filter_function, destination_attributes })
    console.log(`  updated ${existing.id}: HTTP ${r.status}`)
    if (r.status >= 300) console.log(`  ${redact(JSON.stringify(r.json))}`)
  } else {
    const r = await qn<{ id?: string }>('POST', '/streams/rest/v1/streams', payload)
    console.log(`  created ${r.json.id ?? ''}: HTTP ${r.status}`)
    if (r.status >= 300) console.log(`  ${redact(JSON.stringify(r.json))}`)
  }
}

/** The index covers the chain from the stream's start block. The activity route checks this before it trusts the index. */
async function recordStartBlock() {
  // The start range the API reports for the stream, not a recomputed value (an existing stream keeps its own).
  const list = await qn<{ data: { name: string; start_range?: number }[] }>('GET', '/streams/rest/v1/streams')
  const actual = list.json.data?.find((s) => s.name === STREAM_NAME)?.start_range
  if (typeof actual !== 'number' || actual <= 0) throw new Error('Could not read the stream start range from the API, the index start block was not recorded.')
  const r = await qn('POST', '/kv/rest/v1/sets', { key: 'tawf:act:startBlock', value: JSON.stringify(String(actual)) })
  console.log(`  index start block ${actual} recorded: HTTP ${r.status}`)
}

async function setupWebhook() {
  const token = process.env.QN_ALERT_TOKEN
  if (apply && (!token || token.length < 32)) throw new Error('QN_ALERT_TOKEN must be set (32+ characters).')
  const series = srcs.filter((s) => (s.product === 'pool' || s.product === 'series1' || s.product === 'scf') && s.events.some((e) => GLOBAL.has(e.name)))
  const contracts = [...new Set(series.map((s) => s.address))]
  const eventHashes = [...new Set(series.flatMap((s) => s.events.filter((e) => GLOBAL.has(e.name)).map((e) => toEventSelector(e))))]
  const payload = {
    name: WEBHOOK_NAME,
    network: 'arbitrum-sepolia',
    templateArgs: { contracts, eventHashes },
    destination_attributes: { url: `${base}/api/tokenization/qn/alert`, compression: 'none', security_token: token ?? '', headers: { 'x-tawf-token': token ?? '' } },
  }
  console.log(`webhook ${WEBHOOK_NAME}: ${contracts.length} contracts, ${eventHashes.length} topics, delivers to ${payload.destination_attributes.url}`)
  if (!apply) return
  const list = await qn<{ data: { id: string; name: string }[] }>('GET', '/webhooks/rest/v1/webhooks')
  const existing = list.json.data?.find((w) => w.name === WEBHOOK_NAME)
  if (existing) {
    const r = await qn('PATCH', `/webhooks/rest/v1/webhooks/${existing.id}`, { name: WEBHOOK_NAME, templateArgs: payload.templateArgs, destination_attributes: payload.destination_attributes })
    console.log(`  updated ${existing.id}: HTTP ${r.status}`)
    if (r.status >= 300) console.log(`  ${redact(JSON.stringify(r.json))}`)
  } else {
    // A new webhook starts active.
    const r = await qn<{ id?: string }>('POST', '/webhooks/rest/v1/webhooks/template/evmContractEvents', payload)
    console.log(`  created ${r.json.id ?? ''}: HTTP ${r.status}`)
    if (r.status >= 300) console.log(`  ${redact(JSON.stringify(r.json))}`)
  }
}

await setupStream()
if (flag('--activate') && apply) await recordStartBlock()
if (flag('--activate')) await setupWebhook()
if (!apply) console.log('Plan only. Re-run with --apply to make the changes.')
