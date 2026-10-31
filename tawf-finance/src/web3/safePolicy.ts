/**
 * Which calls each duty Safe may be asked to run. A proposal that decodes with a known ABI is still refused
 * unless its target is one of OUR contracts (deployments.json) and the function belongs to the duty of the
 * Safe it was proposed on. The API checks this when proposing and the admin panel checks it again before it
 * offers Approve, so a proposal slipped into the store for another target or another duty shows red.
 */
import { decodeAbiParameters, encodeAbiParameters, getAddress, isAddress, maxUint256, parseAbi, type Address, type Hex } from 'viem';
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
  /** Series and sukuk T-REX tokens. Their pause and unpause are agent-only, held by the Minting Safe. */
  tokens: Address[];
  /** Pool ledgers, which are Pausable (Guardian pauses, Governance unpauses). */
  ledgers: Address[];
  /** The ONCHAINID of each token (deployments keys ending TokenIdentity). */
  tokenIdentities: Address[];
}

const SERIES_KEYS = ['tawfSeries', 'tawfSeries2', 'depositoPool'];
export const SERIES_TOKEN_KEYS = ['tawfSeriesToken', 'tawfSeries2Token', 'depositoPoolToken'];
const LEDGER_KEYS = ['depositoPoolLedger'];
const TOKEN_KEYS = [...SERIES_TOKEN_KEYS, 'sukukToken', 'sukuk2Token', 'scfToken'];
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
    tokens: pick(raw, TOKEN_KEYS),
    ledgers: pick(raw, LEDGER_KEYS),
    tokenIdentities: Object.keys(raw).filter((k) => k.endsWith('TokenIdentity')).flatMap((k) => pick(raw, [k])),
  };
}

/**
 * Our Pausable contracts: series, distributors and the pool ledger. The T-REX tokens are NOT here: their
 * pause is agent-only, and a T-REX agent can also mint, burn and force transfers, so the Guardian is never a
 * token agent. Pausing a token is a Minting Safe action.
 */
function pausables(set: DeployedSet): Address[] {
  return [...set.series, ...set.distributors, ...set.ledgers];
}

const has = (list: Address[], a: unknown) => typeof a === 'string' && list.some((x) => x.toLowerCase() === a.toLowerCase());

// setTawfShare (the fee setting) is Governance, claimTawfShare (paying it out) is Treasury.
const TREASURY_FNS = new Set(['distribute', 'releaseHeldProfit', 'settleMaturity', 'closeSubscription', 'claimTawfShare', 'distributeProfit']);

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
      if (fn === 'pause' || fn === 'unpause') return has(set.tokens, to) ? { ok: true, reason: '' } : no(`${fn} by the Minting Safe is for our tokens only (it is their agent).`);
      return fn === 'allocate' && has(set.series, to) ? { ok: true, reason: '' } : no(`${fn} is not a Minting action on one of our series.`);
    case 'compliance':
      if (fn === 'addClaim' || fn === 'removeClaim') {
        return has(set.tokenIdentities, to) ? { ok: true, reason: '' } : no(`${fn} must target the ONCHAINID of one of our tokens.`);
      }
      return (fn === 'resetUsage' || fn === 'setProfile') && has(set.scfLimit, to) ? { ok: true, reason: '' } : no(`${fn} is not a Compliance action on our SCF limit module or token identities.`);
    case 'governance':
      if (fn === 'unpause') return has(pausables(set), to) ? { ok: true, reason: '' } : no('unpause must target one of our series, distributors or the pool ledger.');
      if (fn === 'setTawfShare') return has([...set.series, ...set.distributors], to) ? { ok: true, reason: '' } : no('setTawfShare must target one of our series or distributors.');
      if (fn === 'addStablecoin') return has(set.series, to) ? { ok: true, reason: '' } : no('addStablecoin must target one of our series.');
      if (fn === 'callModuleFunction') {
        if (!has(set.compliances, to)) return no('callModuleFunction must target the compliance contract of one of our tokens.');
        if (!has(set.sandboxes, c.args[1])) return no('callModuleFunction may only call one of our sandbox modules.');
        return c.inner?.known ? { ok: true, reason: '' } : no('The inner sandbox call is not a known setMode, setCaps or setSeriesEnd.');
      }
      return no(`${fn} is not a Governance action.`);
    default:
      // Guardian: pause only. Unpausing is Governance.
      return fn === 'pause' && has(pausables(set), to) ? { ok: true, reason: '' } : no('The Guardian Safe may only pause our series, distributors or the pool ledger (or reject a nonce). Unpausing is Governance.');
  }
}

// ---------------------------------------------------------------------------------------------------------
// Argument checks. The target and function are not enough: a Treasury call to our own distributor could still
// name the wrong coin, an allocate could mint to an unverified wallet, an approve could hand out everything.
// These need chain reads, so they take a reader and run in the API (before storing) and in the panel.
// ---------------------------------------------------------------------------------------------------------

const ARG_ABI = parseAbi([
  'function coins() view returns (address[])',
  'function allowedStablecoins() view returns (address[])',
  'function isVerified(address user) view returns (bool)',
  'function pendingOf(address investor, address token) view returns (uint256)',
  'function issuersRegistry() view returns (address)',
  'function isTrustedIssuer(address issuer) view returns (bool)',
  'function hasClaimTopic(address issuer, uint256 claimTopic) view returns (bool)',
  'function isClaimValid(address identity, uint256 claimTopic, bytes sig, bytes data) view returns (bool)',
  'function getClaim(bytes32 claimId) view returns (uint256 topic, uint256 scheme, address issuer, bytes signature, bytes data, string uri)',
]);

/** Claim topics of the token ONCHAINIDs: 10 ORIGINATOR, 11 PLATFORM, 12 TOKENIZATION_PARTNER, 13 OFFERING_DOCS. */
const TOKEN_CLAIM_TOPICS = [10n, 11n, 12n, 13n];
/** Claim limits: the uri in characters, the data in bytes. */
export const MAX_CLAIM_URI = 512;
export const MAX_CLAIM_DATA = 2048;
const CLAIM_SHAPES: Record<string, { type: string }[]> = {
  '10': [{ type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'address' }],
  '11': [{ type: 'string' }, { type: 'string' }, { type: 'address' }],
  '12': [{ type: 'string' }, { type: 'string' }],
  '13': [{ type: 'bytes32' }, { type: 'string' }],
};

/**
 * Largest allowance an approve proposal may grant when no paired amount is known: 100,000 units of a 6-decimal
 * settlement coin. When a live distribute, settle or release for the same spender is waiting, its amount is the cap.
 */
export const MAX_APPROVE = 100_000n * 10n ** 6n;

/** allocate: investors per proposal, and how many chain reads run at once. */
export const MAX_ALLOCATE_INVESTORS = 50;
const READ_BATCH = 10;

/** Sandbox bounds (sen, 2 decimals): Rp10 billion per investor, Rp1 trillion per series, 1000 investors, series end 1 hour to 10 years ahead. */
export const SANDBOX_BOUNDS = { maxInvestors: 1000n, maxBalancePerInvestor: 10n ** 12n, seriesCap: 10n ** 14n, maxModeIndex: 2n, maxYears: 10, minSeriesEndMargin: 3600 };

export interface Reader {
  readContract(args: { address: Address; abi: unknown; functionName: string; args?: readonly unknown[] }): Promise<unknown>;
}

export interface PolicyEnv {
  chain: Reader;
  /** The configured fee wallet (deployments or FEE_RECIPIENT). */
  feeRecipient: Address | null;
  /** The IdentityRegistry that decides who may be minted to. */
  identityRegistry: Address | null;
  /** The amount of a live distribute, settle or release that names `spender`, when one is waiting. */
  pairedAmount?: (spender: Address) => bigint | null;
}

const same = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

async function acceptedCoins(set: DeployedSet, to: Address, env: PolicyEnv): Promise<Address[]> {
  const fn = has(set.distributors, to) ? 'coins' : 'allowedStablecoins';
  return (await env.chain.readContract({ address: to, abi: ARG_ABI, functionName: fn })) as Address[];
}

/** The arguments of a call that already passed `checkPolicy`. */
export async function checkArguments(to: Address, c: DecodedCall, set: DeployedSet, env: PolicyEnv): Promise<PolicyResult> {
  const ok: PolicyResult = { ok: true, reason: '' };
  const no = (reason: string): PolicyResult => ({ ok: false, reason });
  if (c.rejection || !c.functionName) return ok;
  const fn = c.functionName;
  const a = c.args;

  if (fn === 'setTawfShare') {
    const bps = Number(a[0]);
    const recipient = a[1];
    if (bps === 0) return same(recipient, '0x0000000000000000000000000000000000000000') ? ok : no('A zero share must have the zero address as recipient.');
    if (!env.feeRecipient) return no('No fee recipient is configured (FEE_RECIPIENT or deployments feeRecipient).');
    return same(recipient, env.feeRecipient) ? ok : no('The fee recipient must be the configured fee wallet.');
  }
  if (fn === 'callModuleFunction' && c.inner?.functionName) {
    const ia = c.inner.args;
    const b = SANDBOX_BOUNDS;
    if (c.inner.functionName === 'setMode' && (ia[0] as bigint) > b.maxModeIndex) return no('setMode: the mode must be 0, 1 or 2.');
    if (c.inner.functionName === 'setCaps') {
      if ((ia[0] as bigint) > b.maxInvestors) return no(`setCaps: at most ${b.maxInvestors} investors.`);
      if ((ia[1] as bigint) > b.maxBalancePerInvestor) return no(`setCaps: at most ${b.maxBalancePerInvestor} sen per investor.`);
      if ((ia[2] as bigint) > b.seriesCap) return no(`setCaps: at most ${b.seriesCap} sen for the series.`);
    }
    if (c.inner.functionName === 'setSeriesEnd') {
      const end = Number(ia[0] as bigint);
      const now = Math.floor(Date.now() / 1000);
      // A zero or past end freezes every holder transfer, so the end must be in the future by a margin.
      if (end <= now + b.minSeriesEndMargin) return no('setSeriesEnd: the end must be at least an hour in the future.');
      const limit = now + b.maxYears * 365 * 24 * 3600;
      if (end > limit) return no(`setSeriesEnd: the end may be at most ${b.maxYears} years away.`);
    }
    return ok;
  }
  if (fn === 'removeClaim') {
    const [topic] = (await env.chain.readContract({ address: to, abi: ARG_ABI, functionName: 'getClaim', args: [a[0]] })) as readonly [bigint];
    return TOKEN_CLAIM_TOPICS.includes(topic) ? ok : no('removeClaim may only remove a token claim of topics 10 to 13 that exists.');
  }
  if (fn === 'addClaim') {
    const [topic, scheme, issuer, signature, data, uri] = a as readonly [bigint, bigint, Address, Hex, Hex, string];
    if (!TOKEN_CLAIM_TOPICS.includes(topic)) return no('addClaim is limited to the token claim topics 10 to 13.');
    if (scheme !== 1n) return no('addClaim must use scheme 1 (ECDSA).');
    if (typeof uri !== 'string' || uri.length > MAX_CLAIM_URI) return no(`The claim uri may be at most ${MAX_CLAIM_URI} characters.`);
    if ((data.length - 2) / 2 > MAX_CLAIM_DATA) return no(`The claim data may be at most ${MAX_CLAIM_DATA} bytes.`);
    try {
      const fields = decodeAbiParameters(CLAIM_SHAPES[topic.toString()] as never, data);
      // The data must be exactly what the shape encodes: no trailing bytes, no alternative encodings.
      if (encodeAbiParameters(CLAIM_SHAPES[topic.toString()] as never, fields as never).toLowerCase() !== data.toLowerCase()) {
        return no('The claim data is not canonically encoded (it has extra bytes).');
      }
    } catch {
      return no(`The claim data does not decode as a topic ${topic} claim.`);
    }
    if (!env.identityRegistry) return no('The IdentityRegistry is not configured.');
    // The issuer must be a trusted issuer for this topic and its signature must verify for THIS identity, before a
    // single owner is asked to approve.
    const tir = (await env.chain.readContract({ address: env.identityRegistry, abi: ARG_ABI, functionName: 'issuersRegistry' })) as Address;
    const known = (await env.chain.readContract({ address: tir, abi: ARG_ABI, functionName: 'isTrustedIssuer', args: [issuer] })) as boolean;
    if (!known) return no('The claim issuer is not a trusted issuer.');
    const forTopic = (await env.chain.readContract({ address: tir, abi: ARG_ABI, functionName: 'hasClaimTopic', args: [issuer, topic] })) as boolean;
    if (!forTopic) return no(`The claim issuer is not trusted for topic ${topic}.`);
    const valid = (await env.chain.readContract({ address: issuer, abi: ARG_ABI, functionName: 'isClaimValid', args: [to, topic, signature, data] })) as boolean;
    return valid ? ok : no('The claim signature does not verify against the issuer for this identity.');
  }
  if (fn === 'addStablecoin') {
    return has(set.stablecoins, a[0]) ? ok : no('addStablecoin may only add one of our known settlement coins.');
  }
  if (fn === 'distribute' || fn === 'releaseHeldProfit' || fn === 'claimTawfShare' || (fn === 'settleMaturity' && a.length === 4)) {
    const coin = fn === 'distribute' || fn === 'releaseHeldProfit' ? a[1] : fn === 'claimTawfShare' ? a[0] : a[0];
    const accepted = await acceptedCoins(set, to, env);
    return has(accepted, coin) ? ok : no(`${fn} may only use a coin the target accepts (read on chain).`);
  }
  if (fn === 'approve') {
    const amount = a[1] as bigint;
    if (amount === maxUint256) return no('approve may not grant the maximum allowance.');
    const paired = env.pairedAmount?.(a[0] as Address) ?? null;
    const cap = paired !== null && paired < MAX_APPROVE ? paired : MAX_APPROVE;
    if (amount > cap) return no(`approve may not exceed ${cap} base units${paired !== null ? ' (the amount of the paired proposal)' : ''}.`);
    return ok;
  }
  if (fn === 'allocate') {
    const investors = a[0] as Address[];
    if (!Array.isArray(investors) || investors.length === 0) return no('allocate needs at least one investor.');
    if (investors.length > MAX_ALLOCATE_INVESTORS) return no(`allocate is limited to ${MAX_ALLOCATE_INVESTORS} investors per proposal.`);
    if (new Set(investors.map((x) => x.toLowerCase())).size !== investors.length) return no('allocate lists an investor twice.');
    if (!env.identityRegistry) return no('The IdentityRegistry is not configured.');
    const registry = env.identityRegistry;
    const coins = await acceptedCoins(set, to, env);
    // Read in parallel batches: the first failing investor in list order is reported.
    for (let i = 0; i < investors.length; i += READ_BATCH) {
      const batch = investors.slice(i, i + READ_BATCH);
      const verdicts = await Promise.all(
        batch.map(async (who) => {
          const verified = (await env.chain.readContract({ address: registry, abi: ARG_ABI, functionName: 'isVerified', args: [who] })) as boolean;
          if (!verified) return `${who} is not verified in the IdentityRegistry.`;
          const pendings = await Promise.all(
            coins.map((coin) => env.chain.readContract({ address: to, abi: ARG_ABI, functionName: 'pendingOf', args: [who, coin] }) as Promise<bigint>),
          );
          return pendings.reduce((x, y) => x + y, 0n) === 0n ? `${who} has no pending escrow to allocate.` : null;
        }),
      );
      const bad = verdicts.find((v) => v !== null);
      if (bad) return no(bad);
    }
    return ok;
  }
  return ok;
}

/** checkPolicy then checkArguments. */
export async function checkProposal(duty: Duty, safe: Address, to: Address, c: DecodedCall, set: DeployedSet, env: PolicyEnv): Promise<PolicyResult> {
  const first = checkPolicy(duty, safe, to, c, set);
  return first.ok ? checkArguments(to, c, set, env) : first;
}
