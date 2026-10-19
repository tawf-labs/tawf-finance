/**
 * Hand-written ABIs for the tokenization suite, matching the deployed
 * contracts so the frontend never drifts from them. These are intentionally
 * minimal: only the functions, views and errors the app actually uses.
 *
 * Sources:
 *   - TawfDepositoSeries.sol          (deposito series: multi-stablecoin)
 *   - SandboxModule.sol               (mode + caps + eligibility)
 *   - SukukDistributor.sol            (sukuk distributor)
 *   - T-REX Token                     (ERC-3643 token)
 *   - IdentityRegistry                (isVerified / identity)
 *   - MockUSDC / MockUSDT             (faucet + ERC20)
 *   - LedgerAnchor                    (epochCount / epochOf / verify)
 */
import type { Abi } from 'viem';

export const TawfSeriesAbi = [
  { name: 'subscribe', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'coinAmount', type: 'uint256' }], outputs: [] },
  { name: 'cancelSubscription', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
  { name: 'claim', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
  { name: 'redeem', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
  { name: 'pending', type: 'function', stateMutability: 'view', inputs: [{ name: 'investor', type: 'address' }, { name: 'token', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'claimableSen', type: 'function', stateMutability: 'view', inputs: [{ name: 'investor', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'quote', type: 'function', stateMutability: 'view', inputs: [{ name: 'token', type: 'address' }, { name: 'sen', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowedStablecoins', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address[]' }] },
  { name: 'isStablecoin', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'rateOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'token', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'reserve', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'ratioBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'isFullyBacked', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { name: 'reserveSnapshotAt', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { name: 'lastPeriod', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint32' }] },
  { name: 'redemptionOpen', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { name: 'treasury', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  {
    name: 'rate',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      { name: 'idrPerToken', type: 'uint256' },
      { name: 'updatedAt', type: 'uint64' },
      { name: 'maxAge', type: 'uint64' },
      { name: 'fresh', type: 'bool' },
    ],
  },
  {
    name: 'seriesTerms',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'seriesId', type: 'bytes32' },
          { name: 'tenorMonths', type: 'uint8' },
          { name: 'nisbahBps', type: 'uint16' },
        ],
      },
    ],
  },
  { type: 'error', name: 'NotEligible', inputs: [{ name: 'investor', type: 'address' }] },
  { type: 'error', name: 'NoPending', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'error', name: 'RedemptionNotOpen', inputs: [] },
  { type: 'error', name: 'NothingToClaim', inputs: [] },
  { type: 'error', name: 'NotStablecoin', inputs: [{ name: 'token', type: 'address' }] },
  { type: 'error', name: 'RateStale', inputs: [{ name: 'updatedAt', type: 'uint64' }, { name: 'maxAge', type: 'uint64' }] },
  { type: 'error', name: 'RateUnset', inputs: [] },
  { type: 'error', name: 'ReserveInsufficient', inputs: [{ name: 'supplyAfter', type: 'uint256' }, { name: 'balance', type: 'uint256' }] },
] as const satisfies Abi;

export const SandboxModuleAbi = [
  { name: 'isEligible', type: 'function', stateMutability: 'view', inputs: [{ name: 'compliance', type: 'address' }, { name: 'who', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'investorCount', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  {
    name: 'configOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'mode', type: 'uint8' },
      { name: 'treasury', type: 'address' },
      { name: 'claimIssuer', type: 'address' },
      { name: 'maxInvestors', type: 'uint256' },
      { name: 'maxBalancePerInvestor', type: 'uint256' },
      { name: 'seriesCap', type: 'uint256' },
      { name: 'seriesEnd', type: 'uint64' },
      { name: 'configured', type: 'bool' },
    ],
  },
] as const satisfies Abi;

/** T-REX token compliance() getter, to reach the series token's ModularCompliance. */
export const TrexComplianceAbi = [
  { name: 'compliance', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
] as const satisfies Abi;

export const SukukDistributorAbi = [
  { name: 'status', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  {
    name: 'terms',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sukukId', type: 'bytes32' },
      { name: 'faceValue', type: 'uint256' },
      { name: 'maturity', type: 'uint40' },
      { name: 'minRaise', type: 'uint256' },
      { name: 'minSubscription', type: 'uint256' },
      { name: 'subscriptionPeriod', type: 'uint40' },
      { name: 'issuerTreasury', type: 'address' },
    ],
  },
  { name: 'subscriptionDeadline', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint40' }] },
  { name: 'reserveOf', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'reserveOutstanding', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'reserveSnapshotAt', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { name: 'isFullyBacked', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { name: 'subscribe', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'claim', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'claimable', type: 'function', stateMutability: 'view', inputs: [{ name: 'investor', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'redeem', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'refund', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'lastPeriod', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint16' }] },
  {
    name: 'openSubscription',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }],
    outputs: [],
  },
  { name: 'closeSubscription', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'distribute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'period', type: 'uint16' }, { name: 'amount', type: 'uint256' }, { name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }],
    outputs: [],
  },
  {
    name: 'settleMaturity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }, { name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }],
    outputs: [],
  },
  {
    name: 'updateReserve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'snapshotAt', type: 'uint64' }, { name: 'outstanding', type: 'uint256' }, { name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }],
    outputs: [],
  },
  { type: 'error', name: 'WrongStatus', inputs: [{ name: 'current', type: 'uint8' }] },
  { type: 'error', name: 'ProofInvalid', inputs: [] },
  { type: 'error', name: 'NotEligible', inputs: [{ name: 'investor', type: 'address' }] },
  { type: 'error', name: 'BelowMinimum', inputs: [] },
  { type: 'error', name: 'ExceedsFaceValue', inputs: [] },
  { type: 'error', name: 'SubscriptionClosed', inputs: [] },
  { type: 'error', name: 'NothingToClaim', inputs: [] },
  { type: 'error', name: 'ReserveInsufficient', inputs: [{ name: 'supplyAfter', type: 'uint256' }, { name: 'outstanding', type: 'uint256' }] },
] as const satisfies Abi;

/** Minimal ERC-3643 / T-REX token view used by the app. */
export const TrexTokenAbi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: '_userAddress', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { name: 'isFrozen', type: 'function', stateMutability: 'view', inputs: [{ name: '_userAddress', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_to', type: 'address' }, { name: '_amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_spender', type: 'address' }, { name: '_amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: '_owner', type: 'address' }, { name: '_spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const satisfies Abi;

/** Shared ERC-3643 IdentityRegistry. */
export const IdentityRegistryAbi = [
  { name: 'isVerified', type: 'function', stateMutability: 'view', inputs: [{ name: '_userAddress', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'identity', type: 'function', stateMutability: 'view', inputs: [{ name: '_userAddress', type: 'address' }], outputs: [{ name: '', type: 'address' }] },
] as const satisfies Abi;

/** MockUSDC / MockUSDT faucet + ERC20 approve/balance. */
export const MockTokenAbi = [
  { name: 'faucet', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'faucetMax', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const satisfies Abi;

/** LedgerAnchor epoch views + verify, used by the proof-of-reserve page. */
export const LedgerAnchorAbi = [
  { name: 'ledgerChainId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'nextIndex', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { name: 'epochCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  {
    name: 'epochOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'epoch', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'root', type: 'bytes32' },
          { name: 'fromIndex', type: 'uint64' },
          { name: 'toIndex', type: 'uint64' },
          { name: 'anchoredAt', type: 'uint40' },
        ],
      },
    ],
  },
  {
    name: 'verify',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'epoch', type: 'uint256' }, { name: 'leaf', type: 'bytes32' }, { name: 'proof', type: 'bytes32[]' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const satisfies Abi;

/** Sukuk lifecycle status enum, mirroring SukukDistributor.Status. */
export const SUKUK_STATUS_LABEL: Record<number, string> = {
  0: 'Pending',
  1: 'Subscription',
  2: 'Active',
  3: 'Matured',
  4: 'Defaulted',
  5: 'Cancelled',
};
