/**
 * Decode and re-encode a proposed Safe transaction so the approver sees what will run, and so the hash they
 * approve is recomputed from those decoded fields instead of trusted from the store.
 *
 * Only the calls the admin API proposes are known. Anything else decodes to `known: false` and gets no
 * Approve button.
 */
import { decodeFunctionData, encodeFunctionData, parseAbi, type Abi, type Address, type Hex } from 'viem';

const PROPOSED_ABI = parseAbi([
  'function approve(address spender, uint256 amount)',
  'function closeSubscription()',
  'function pause()',
  'function unpause()',
  'function distribute(uint16 period, address coin, uint256 amount, uint256 epoch, bytes32[] proof)',
  'function releaseHeldProfit(uint16 index, address coin, uint256 amount, uint256 epoch, bytes32[] proof)',
  'function settleMaturity(address coin, uint256 amount, uint256 epoch, bytes32[] proof)',
  'function settleMaturity(uint64 at, uint32 finalPeriod, uint256 principalSen, uint256 epoch, bytes32[] proof)',
  'function setTawfShare(uint16 nisbahBps, address recipient)',
  'function claimTawfShare(address token)',
  'function addStablecoin(address token)',
  'function allocate(address[] investors, uint256 epoch, uint64 snapshotAt, uint256 balance, bytes32[] proof)',
  'function distributeProfit(uint32 period, uint256 profitSen, uint256 epoch, bytes32[] proof)',
  'function resetUsage(address onchainId, uint256 period)',
  'function setProfile(address onchainId, uint128 annualLimit, uint8 bracket, uint8 exemption)',
  'function callModuleFunction(bytes callData, address _module)',
]);

const SANDBOX_ABI = parseAbi([
  'function setMode(uint8 mode)',
  'function setCaps(uint256 maxInvestors, uint256 maxBalancePerInvestor, uint256 seriesCap)',
  'function setSeriesEnd(uint64 seriesEnd)',
]);

export interface DecodedCall {
  /** True when the data decoded with a known ABI and re-encodes to exactly the same bytes. */
  known: boolean;
  /** A plain Safe rejection: zero-value call from the Safe to itself with empty data. */
  rejection: boolean;
  functionName: string | null;
  args: readonly unknown[];
  /** Human readable lines, one per argument. */
  lines: string[];
  /** The data re-encoded from the decoded function and arguments. */
  reencoded: Hex | null;
  /** The decoded inner call of callModuleFunction, when present. */
  inner: DecodedCall | null;
}

const show = (v: unknown): string => {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return `[${v.map(show).join(', ')}]`;
  return String(v);
};

function decodeWith(abi: Abi, data: Hex): { functionName: string; args: readonly unknown[]; reencoded: Hex } | null {
  try {
    const d = decodeFunctionData({ abi, data });
    const reencoded = encodeFunctionData({ abi, functionName: d.functionName, args: d.args as never } as never);
    return { functionName: d.functionName, args: (d.args ?? []) as readonly unknown[], reencoded };
  } catch {
    return null;
  }
}

export function decodeProposal(to: Address, data: Hex, safe: Address): DecodedCall {
  if (to.toLowerCase() === safe.toLowerCase() && data === '0x') {
    return { known: true, rejection: true, functionName: null, args: [], lines: ['Reject this nonce: burns it with an empty call'], reencoded: '0x', inner: null };
  }
  const d = decodeWith(PROPOSED_ABI as unknown as Abi, data);
  if (!d) {
    return { known: false, rejection: false, functionName: null, args: [], lines: [`Unknown call ${data.slice(0, 10)}`], reencoded: null, inner: null };
  }
  let inner: DecodedCall | null = null;
  let innerOk = true;
  if (d.functionName === 'callModuleFunction') {
    const callData = d.args[0] as Hex;
    const i = decodeWith(SANDBOX_ABI as unknown as Abi, callData);
    inner = i
      ? { known: i.reencoded === callData, rejection: false, functionName: i.functionName, args: i.args, lines: i.args.map(show), reencoded: i.reencoded, inner: null }
      : { known: false, rejection: false, functionName: null, args: [], lines: [`Unknown inner call ${callData.slice(0, 10)}`], reencoded: null, inner: null };
    innerOk = inner.known;
  }
  return {
    known: d.reencoded === data && innerOk,
    rejection: false,
    functionName: d.functionName,
    args: d.args,
    lines: d.args.map(show),
    reencoded: d.reencoded,
    inner,
  };
}

/** One line for the panel, e.g. `allocate(…)` or `Reject nonce`. */
export function summarize(c: DecodedCall): string {
  if (c.rejection) return 'Reject: burn this nonce';
  if (!c.functionName) return c.lines[0] ?? 'Unknown call';
  const inner = c.inner?.functionName ? ` → ${c.inner.functionName}` : '';
  return `${c.functionName}${inner}`;
}
