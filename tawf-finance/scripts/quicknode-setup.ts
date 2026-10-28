/**
 * Create or update the QuickNode Stream (activity index) and, optionally, the alert Webhook.
 * Idempotent: each is found by name first and updated in place. Without --apply it only prints the plan.
 *
 *   npx tsx scripts/quicknode-setup.ts                       plan only
 *   npx tsx scripts/quicknode-setup.ts --apply               create or update the stream (paused)
 *   npx tsx scripts/quicknode-setup.ts --apply --activate    and run it
 *   npx tsx scripts/quicknode-setup.ts --apply --webhooks    also create or update the alert webhook
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
const apply = flag('--apply')

const key = process.env.QUICKNODE_API_KEY
if (!key) throw new Error('QUICKNODE_API_KEY is not set.')

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
  var end = Number(m.batch_end_range || 0);
  var start = Number(m.batch_start_range || end);
  var beat = end > 0 && Math.floor(start / 500) !== Math.floor(end / 500);
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
  } else {
    const r = await qn<{ id?: string }>('POST', '/streams/rest/v1/streams', payload)
    console.log(`  created ${r.json.id ?? ''}: HTTP ${r.status}`)
    if (r.status >= 300) console.log(`  ${JSON.stringify(r.json).replace(token ?? '\u0000', '[token]')}`)
  }
}

async function setupWebhook() {
  const token = process.env.QN_ALERT_TOKEN
  if (apply && (!token || token.length < 32)) throw new Error('QN_ALERT_TOKEN must be set (32+ characters).')
  const series = srcs.filter((s) => s.product === 'pool' || s.product === 'series1')
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
    const r = await qn('PATCH', `/webhooks/rest/v1/webhooks/${existing.id}`, { name: WEBHOOK_NAME, destination_attributes: payload.destination_attributes })
    console.log(`  updated ${existing.id}: HTTP ${r.status}`)
  } else {
    // A new webhook starts active.
    const r = await qn<{ id?: string }>('POST', '/webhooks/rest/v1/webhooks/template/evmContractEvents', payload)
    console.log(`  created ${r.json.id ?? ''}: HTTP ${r.status}`)
    if (r.status >= 300) console.log(`  ${JSON.stringify(r.json).replace(token ?? '\u0000', '[token]')}`)
  }
}

await setupStream()
if (flag('--webhooks')) await setupWebhook()
if (!apply) console.log('Plan only. Re-run with --apply to make the changes.')
