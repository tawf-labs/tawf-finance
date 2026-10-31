import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getAddress, isAddress, type Address } from 'viem'

// One source of truth: the app's deployments file. In Docker the build copies it next to the app and sets DEPLOYMENTS_FILE.
const file = process.env.DEPLOYMENTS_FILE ?? resolve(process.cwd(), '../tawf-finance/src/web3/tokenization.deployments.json')
export const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>

const ZERO = '0x0000000000000000000000000000000000000000'

/** A checksummed address for a deployments key, or null when the key is missing or zero. */
export function addr(key: string): Address | null {
  const v = raw[key]
  return typeof v === 'string' && isAddress(v) && v !== ZERO ? getAddress(v) : null
}

/** A block number for a deployments key, or the fallback. */
export function block(key: string, fallback = 0): number {
  const v = raw[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Every address under a key that matches the suffix (for example Beacon or Safe), keyed by its deployments key. */
export function bySuffix(suffix: string): Record<string, Address> {
  const out: Record<string, Address> = {}
  for (const k of Object.keys(raw)) {
    if (!k.toLowerCase().endsWith(suffix.toLowerCase())) continue
    const a = addr(k)
    if (a) out[k] = a
  }
  return out
}

/** The labels the activity feed uses for each source. Looked up by contract address at index time. */
export function productOf(address: string): 'pool' | 'series1' | 'series2' | 'scf' | 'ledger' | 'identity' | 'token' {
  const a = address.toLowerCase()
  const is = (k: string) => addr(k)?.toLowerCase() === a
  if (is('tawfSeries')) return 'series1'
  if (is('tawfSeries2')) return 'series2'
  if (is('depositoPool')) return 'pool'
  if (is('depositoPoolLedger')) return 'ledger'
  if (is('identityRegistry')) return 'identity'
  return 'scf'
}
