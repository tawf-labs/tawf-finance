/**
 * Which calls each duty Safe may be asked to run. A proposal that decodes with a known ABI is still refused
 * unless its target is one of OUR contracts (deployments.json) and the function belongs to the duty of the
 * Safe it was proposed on. The API checks this when proposing and the admin panel checks it again before it
 * offers Approve, so a proposal slipped into the store for another target or another duty shows red.
 */
import { getAddress, isAddress, type Address } from 'viem';
import type { DecodedCall } from './safeDecode';
import type { Duty } from './safeDuty';

export interface DeployedSet {
  series: Address[];
  distributors: Address[];
  scfLimit: Address[];
  sandboxes: Address[];
  /** ModularCompliance contracts of our series tokens (read on chain from each token). */
  compliances: Address[];
  stablecoins: Address[];
}

const SERIES_KEYS = ['tawfSeries', 'tawfSeries2', 'depositoPool'];
export const SERIES_TOKEN_KEYS = ['tawfSeriesToken', 'tawfSeries2Token', 'depositoPoolToken'];
const DISTRIBUTOR_KEYS = ['sukukDistributor', 'sukuk2Distributor', 'scfDistributor'];
const SCF_LIMIT_KEYS = ['scfLimitModule'];
const SANDBOX_KEYS = ['sandboxModule', 'tawfSeries2Sandbox', 'depositoPoolSandbox'];
const STABLE_KEYS = ['mockUsdc', 'mockUsdt', 'mockUsdg'];
const ZERO = '0x0000000000000000000000000000000000000000';

const pick = (raw: Record<string, unknown>, keys: string[]): Address[] =>
  keys
    .map((k) => raw[k])
    .filter((v): v is string => typeof v === 'string' && isAddress(v) && v !== ZERO)
    .map((v) => getAddress(v) as Address);

/** The token addresses whose `compliance()` the caller must read, to complete `compliances`. */
export const seriesTokens = (raw: Record<string, unknown>): Address[] => pick(raw, SERIES_TOKEN_KEYS);

/** `complianceOf` holds the compliance addresses read on chain from `seriesTokens(raw)` (plus scfCompliance if wanted). */
export function deployedSet(raw: Record<string, unknown>, complianceOf: Address[]): DeployedSet {
  return {
    series: pick(raw, SERIES_KEYS),
    distributors: pick(raw, DISTRIBUTOR_KEYS),
    scfLimit: pick(raw, SCF_LIMIT_KEYS),
    sandboxes: pick(raw, SANDBOX_KEYS),
    compliances: [...new Set([...complianceOf, ...pick(raw, ['scfCompliance'])].map((a) => a.toLowerCase()))].map((a) => getAddress(a) as Address),
    stablecoins: pick(raw, STABLE_KEYS),
  };
}

const has = (list: Address[], a: unknown) => typeof a === 'string' && list.some((x) => x.toLowerCase() === a.toLowerCase());

const TREASURY_FNS = new Set(['distribute', 'releaseHeldProfit', 'settleMaturity', 'closeSubscription', 'setTawfShare', 'claimTawfShare', 'distributeProfit']);

export interface PolicyResult {
  ok: boolean;
  reason: string;
}

/** `safe` is the Safe the proposal sits on, `duty` its duty. */
export function checkPolicy(duty: Duty, safe: Address, to: Address, c: DecodedCall, set: DeployedSet): PolicyResult {
  const no = (reason: string): PolicyResult => ({ ok: false, reason });
  if (c.rejection) return to.toLowerCase() === safe.toLowerCase() ? { ok: true, reason: '' } : no('A rejection must be a call from the Safe to itself.');
  if (!c.known || !c.functionName) return no('The call cannot be decoded with a known ABI.');
  const fn = c.functionName;
  switch (duty) {
    case 'treasury':
      if (TREASURY_FNS.has(fn)) {
        return has([...set.series, ...set.distributors], to) ? { ok: true, reason: '' } : no(`${fn} must target one of our series or distributors.`);
      }
      if (fn === 'approve') {
        if (!has(set.stablecoins, to)) return no('approve must target one of our settlement coins.');
        return has([...set.series, ...set.distributors], c.args[0]) ? { ok: true, reason: '' } : no('approve may only name one of our series or distributors as the spender.');
      }
      return no(`${fn} is not a Treasury action.`);
    case 'minting':
      return fn === 'allocate' && has(set.series, to) ? { ok: true, reason: '' } : no(`${fn} is not a Minting action on one of our series.`);
    case 'compliance':
      return (fn === 'resetUsage' || fn === 'setProfile') && has(set.scfLimit, to) ? { ok: true, reason: '' } : no(`${fn} is not a Compliance action on our SCF limit module.`);
    case 'governance':
      if (fn === 'addStablecoin') return has(set.series, to) ? { ok: true, reason: '' } : no('addStablecoin must target one of our series.');
      if (fn === 'callModuleFunction') {
        if (!has(set.compliances, to)) return no('callModuleFunction must target the compliance contract of one of our tokens.');
        if (!has(set.sandboxes, c.args[1])) return no('callModuleFunction may only call one of our sandbox modules.');
        return c.inner?.known ? { ok: true, reason: '' } : no('The inner sandbox call is not a known setMode, setCaps or setSeriesEnd.');
      }
      return no(`${fn} is not a Governance action.`);
    default:
      return no('The Guardian Safe only pauses, which this API does not propose.');
  }
}
