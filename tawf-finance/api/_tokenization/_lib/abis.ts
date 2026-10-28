/**
 * Server-side ABIs for the tokenization serverless functions. Hand-written to
 * match the deployed contracts (T-REX identity + token, TawfDepositoSeries,
 * SukukDistributor, ReserveLedger on the L3, mocks, anchor).
 */

export const identityRegistryAbi = [
  { name: 'isVerified', type: 'function', stateMutability: 'view', inputs: [{ name: '_userAddress', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'identity', type: 'function', stateMutability: 'view', inputs: [{ name: '_userAddress', type: 'address' }], outputs: [{ name: '', type: 'address' }] },
  { name: 'registerIdentity', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_userAddress', type: 'address' }, { name: '_identity', type: 'address' }, { name: '_country', type: 'uint16' }], outputs: [] },
] as const

export const identityAbi = [
  {
    name: 'addClaim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_topic', type: 'uint256' },
      { name: '_scheme', type: 'uint256' },
      { name: '_issuer', type: 'address' },
      { name: '_signature', type: 'bytes' },
      { name: '_data', type: 'bytes' },
      { name: '_uri', type: 'string' },
    ],
    outputs: [{ name: 'claimRequestId', type: 'bytes32' }],
  },
  {
    name: 'getClaim',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_claimId', type: 'bytes32' }],
    outputs: [
      { name: 'topic', type: 'uint256' },
      { name: 'scheme', type: 'uint256' },
      { name: 'issuer', type: 'address' },
      { name: 'signature', type: 'bytes' },
      { name: 'data', type: 'bytes' },
      { name: 'uri', type: 'string' },
    ],
  },
] as const

export const claimIssuerAbi = [
  {
    name: 'isClaimValid',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '_identity', type: 'address' },
      { name: 'claimTopic', type: 'uint256' },
      { name: 'sig', type: 'bytes' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// IdentityProxy constructor is (implementationAuthority, initialManagementKey).
export const identityProxyAbi = [
  {
    type: 'constructor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_implementationAuthority', type: 'address' },
      { name: 'initialManagementKey', type: 'address' },
    ],
  },
] as const

export const mockTokenAbi = [
  { type: 'function', name: 'FAUCET_AMOUNT', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'faucet', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'faucetMax', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const

export const trexTokenAbi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: '_userAddress', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const

export const tawfSeriesAbi = [
  { name: 'tawfNisbahBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint16' }] },
  { name: 'feeRecipient', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'setTawfShare', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'nisbahBps', type: 'uint16' }, { name: 'recipient', type: 'address' }], outputs: [] },
  { type: 'error', name: 'TawfShareLocked', inputs: [] },
  { name: 'tawfShareLocked', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { name: 'tawfShareAccruedSen', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'tawfSharePaidSen', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'claimTawfShare', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
  // views
  { name: 'pending', type: 'function', stateMutability: 'view', inputs: [{ name: 'investor', type: 'address' }, { name: 'token', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'claimableSen', type: 'function', stateMutability: 'view', inputs: [{ name: 'investor', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'quote', type: 'function', stateMutability: 'view', inputs: [{ name: 'token', type: 'address' }, { name: 'sen', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowedStablecoins', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address[]' }] },
  { name: 'isStablecoin', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'reserve', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'ratioBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'isFullyBacked', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { name: 'reserveSnapshotAt', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { name: 'lastPeriod', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint32' }] },
  { name: 'redemptionOpen', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { name: 'treasury', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'rateOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'token', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'rateUpdatedAt', type: 'function', stateMutability: 'view', inputs: [{ name: 'token', type: 'address' }], outputs: [{ name: '', type: 'uint64' }] },
  { name: 'maxRateAge', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
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
  // actions
  { name: 'addStablecoin', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
  { name: 'removeStablecoin', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
  { name: 'postRate', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'idrPerToken_', type: 'uint256' }], outputs: [] },
  { name: 'subscribe', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'coinAmount', type: 'uint256' }], outputs: [] },
  { name: 'cancelSubscription', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
  {
    name: 'allocate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'investors', type: 'address[]' },
      { name: 'epoch', type: 'uint256' },
      { name: 'snapshotAt', type: 'uint64' },
      { name: 'balance', type: 'uint256' },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [],
  },
  { name: 'distributeProfit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'period', type: 'uint32' }, { name: 'profitSen', type: 'uint256' }, { name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [] },
  { name: 'settleMaturity', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'at', type: 'uint64' }, { name: 'finalPeriod', type: 'uint32' }, { name: 'principalSen', type: 'uint256' }, { name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [] },
  { name: 'claim', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
  { name: 'redeem', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
  { type: 'error', name: 'ProofInvalid', inputs: [] },
  { type: 'error', name: 'ReserveInsufficient', inputs: [{ name: 'supplyAfter', type: 'uint256' }, { name: 'balance', type: 'uint256' }] },
  { type: 'error', name: 'ReserveNotNewer', inputs: [{ name: 'stored', type: 'uint64' }, { name: 'got', type: 'uint64' }] },
  { type: 'error', name: 'RateStale', inputs: [{ name: 'updatedAt', type: 'uint64' }, { name: 'maxAge', type: 'uint64' }] },
  { type: 'error', name: 'RateUnset', inputs: [] },
  { type: 'error', name: 'NotEligible', inputs: [{ name: 'investor', type: 'address' }] },
  { type: 'error', name: 'NoPending', inputs: [] },
  { type: 'error', name: 'NotStablecoin', inputs: [{ name: 'token', type: 'address' }] },
  { type: 'error', name: 'BadDecimals', inputs: [{ name: 'got', type: 'uint8' }] },
  { type: 'error', name: 'ProfitPeriodNotSequential', inputs: [{ name: 'expected', type: 'uint32' }, { name: 'got', type: 'uint32' }] },
  { type: 'error', name: 'NothingToClaim', inputs: [] },
  { type: 'error', name: 'InvalidAddress', inputs: [] },
  { type: 'error', name: 'InvalidTerms', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'error', name: 'RedemptionAlreadyOpen', inputs: [] },
  { type: 'error', name: 'ProfitAfterMaturity', inputs: [] },
  { type: 'error', name: 'ProfitPeriodsOutstanding', inputs: [{ name: 'distributed', type: 'uint32' }, { name: 'finalPeriod', type: 'uint32' }] },
  { type: 'error', name: 'RedemptionNotOpen', inputs: [] },
  { type: 'error', name: 'OnlyModule', inputs: [] },
  { type: 'error', name: 'StablecoinAlreadyAdded', inputs: [{ name: 'token', type: 'address' }] },
  { type: 'error', name: 'ConversionZero', inputs: [] },
] as const

export const sandboxModuleAbi = [
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
  // onlyComplianceCall setters, invoked via ModularCompliance.callModuleFunction
  { name: 'setMode', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'mode', type: 'uint8' }], outputs: [] },
  { name: 'setCaps', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'maxInvestors', type: 'uint256' }, { name: 'maxBalancePerInvestor', type: 'uint256' }, { name: 'seriesCap', type: 'uint256' }], outputs: [] },
  { name: 'setSeriesEnd', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'seriesEnd', type: 'uint64' }], outputs: [] },
] as const

/** ModularCompliance owner gateway used to call onlyComplianceCall module setters. */
export const modularComplianceAbi = [
  { name: 'callModuleFunction', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'callData', type: 'bytes' }, { name: '_module', type: 'address' }], outputs: [] },
] as const

/** T-REX token compliance() getter, to reach the series token's ModularCompliance. */
export const trexComplianceAbi = [
  { name: 'compliance', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
] as const

export const sukukDistributorAbi = [
  { name: 'tawfNisbahBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint16' }] },
  { name: 'feeRecipient', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'setTawfShare', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'nisbahBps', type: 'uint16' }, { name: 'recipient', type: 'address' }], outputs: [] },
  { type: 'error', name: 'TawfShareLocked', inputs: [] },
  // Custom errors, so viem decodes reverts into names that readableError maps.
  { type: 'error', name: 'InvalidAddress', inputs: [] },
  { type: 'error', name: 'InvalidTerms', inputs: [] },
  { type: 'error', name: 'NotEligible', inputs: [{ name: 'investor', type: 'address' }] },
  { type: 'error', name: 'BelowMinimum', inputs: [] },
  { type: 'error', name: 'ExceedsFaceValue', inputs: [] },
  { type: 'error', name: 'SubscriptionClosed', inputs: [] },
  { type: 'error', name: 'SubscriptionStillOpen', inputs: [] },
  { type: 'error', name: 'PeriodNotSequential', inputs: [{ name: 'expected', type: 'uint16' }, { name: 'got', type: 'uint16' }] },
  { type: 'error', name: 'OnlyModule', inputs: [] },
  { type: 'error', name: 'NothingToClaim', inputs: [] },
  { type: 'error', name: 'StaleReserve', inputs: [{ name: 'latest', type: 'uint64' }, { name: 'got', type: 'uint64' }] },
  { type: 'error', name: 'InvalidMaxAge', inputs: [] },
  { type: 'error', name: 'InvalidClaimWindow', inputs: [] },
  { name: 'totalTawfShare', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
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
  { name: 'reserveOutstanding', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'reserveSnapshotAt', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { name: 'isFullyBacked', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { name: 'openSubscription', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [] },
  { name: 'closeSubscription', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'distribute', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'period', type: 'uint16' }, { name: 'amount', type: 'uint256' }, { name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [] },
  { name: 'settleMaturity', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [] },
  { name: 'updateReserve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'snapshotAt', type: 'uint64' }, { name: 'outstanding', type: 'uint256' }, { name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [] },
  { type: 'error', name: 'ProofInvalid', inputs: [] },
  { type: 'error', name: 'WrongStatus', inputs: [{ name: 'current', type: 'uint8' }] },
  { type: 'error', name: 'ReserveInsufficient', inputs: [{ name: 'supplyAfter', type: 'uint256' }, { name: 'outstanding', type: 'uint256' }] },
  { name: 'releaseHeldProfit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'index', type: 'uint16' }, { name: 'amount', type: 'uint256' }, { name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [] },
  { name: 'claimProfit', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'setSweepDestination', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'destination', type: 'address' }, { name: 'epoch', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [] },
  { name: 'sweepUnclaimed', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'setClaimWindow', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'window', type: 'uint256' }], outputs: [] },
  { name: 'entitledUnits', type: 'function', stateMutability: 'view', inputs: [{ name: 'holder', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'claimableHeldProfit', type: 'function', stateMutability: 'view', inputs: [{ name: 'holder', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalUnitsAtMaturity', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'heldReleases', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint16' }] },
  { name: 'totalHeldReleased', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalHeldClaimed', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalHeldSwept', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'heldBalance', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'lastReleaseAt', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'claimWindow', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'sweepDestination', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'error', name: 'TransfersFrozen', inputs: [] },
  { type: 'error', name: 'ReleaseNotSequential', inputs: [{ name: 'expected', type: 'uint16' }, { name: 'got', type: 'uint16' }] },
  { type: 'error', name: 'ZeroRelease', inputs: [] },
  { type: 'error', name: 'SweepDestinationNotSet', inputs: [] },
  { type: 'error', name: 'SweepDestinationAlreadySet', inputs: [] },
  { type: 'error', name: 'InvalidSweepDestination', inputs: [{ name: 'destination', type: 'address' }] },
  { type: 'error', name: 'ClaimWindowOpen', inputs: [{ name: 'opensAt', type: 'uint256' }] },
  { type: 'error', name: 'NoReserveSnapshot', inputs: [] },
  { type: 'error', name: 'ReserveTooOld', inputs: [{ name: 'snapshotAt', type: 'uint64' }, { name: 'maxAge', type: 'uint64' }] },
] as const

/** ReserveLedger on the Tawf Network L3 (views used to list placements / reserves). */
export const reserveLedgerAbi = [
  {
    name: 'placementOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'placementId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'institutionId', type: 'bytes32' },
          { name: 'productId', type: 'bytes32' },
          { name: 'nominal', type: 'uint256' },
          { name: 'maturity', type: 'uint64' },
          { name: 'nisbahBps', type: 'uint16' },
          { name: 'sourceCommitment', type: 'bytes32' },
          { name: 'recordedAt', type: 'uint40' },
          { name: 'recordedBy', type: 'address' },
        ],
      },
    ],
  },
  {
    name: 'productOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'productId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'institutionId', type: 'bytes32' },
          { name: 'tenorMonths', type: 'uint8' },
          { name: 'nisbahBps', type: 'uint16' },
          { name: 'registeredAt', type: 'uint40' },
        ],
      },
    ],
  },
  {
    name: 'latestDepositoReserve',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'productId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'snapshotAt', type: 'uint64' },
          { name: 'amount', type: 'uint256' },
          { name: 'sourceCommitment', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    name: 'latestSukukReserve',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'sukukId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'snapshotAt', type: 'uint64' },
          { name: 'amount', type: 'uint256' },
          { name: 'sourceCommitment', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    type: 'event',
    name: 'PlacementRecorded',
    inputs: [
      { name: 'placementId', type: 'bytes32', indexed: true },
      { name: 'institutionId', type: 'bytes32', indexed: true },
      { name: 'productId', type: 'bytes32', indexed: true },
      { name: 'nominal', type: 'uint256', indexed: false },
      { name: 'maturity', type: 'uint64', indexed: false },
      { name: 'nisbahBps', type: 'uint16', indexed: false },
      { name: 'sourceCommitment', type: 'bytes32', indexed: false },
    ],
  },
] as const

/** SukukLedger on the Tawf Network L3: markIssued records on the L3 the
 *  subscription outcome observed on Arbitrum One. Signed by the L3 operator. */
export const sukukLedgerAbi = [
  { name: 'releaseHeldProfit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'sukukId', type: 'bytes32' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'closeHeldProfit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'sukukId', type: 'bytes32' }], outputs: [] },
  { name: 'approveSweepDestination', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'sukukId', type: 'bytes32' }, { name: 'destination', type: 'address' }], outputs: [] },
  { name: 'shariahFlagOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'sukukId', type: 'bytes32' }], outputs: [{ name: '', type: 'tuple', components: [{ name: 'state', type: 'uint8' }, { name: 'heldAmount', type: 'uint256' }, { name: 'undeclaredPeriods', type: 'uint16' }, { name: 'releases', type: 'uint16' }, { name: 'released', type: 'uint256' }, { name: 'sweepDestination', type: 'address' }] }] },
  { type: 'error', name: 'NotShariahSigner', inputs: [{ name: 'caller', type: 'address' }] },
  { type: 'error', name: 'NotHeld', inputs: [{ name: 'sukukId', type: 'bytes32' }] },
  { type: 'error', name: 'ZeroRelease', inputs: [] },
  { type: 'error', name: 'SweepDestinationSet', inputs: [{ name: 'sukukId', type: 'bytes32' }] },
  { type: 'error', name: 'InvalidSweepDestination', inputs: [{ name: 'destination', type: 'address' }] },
  { name: 'markIssued', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'sukukId', type: 'bytes32' }, { name: 'l2Token', type: 'address' }, { name: 'issuedAmount', type: 'uint256' }], outputs: [] },
  { type: 'error', name: 'WrongStatus', inputs: [{ name: 'sukukId', type: 'bytes32' }, { name: 'current', type: 'uint8' }] },
  { type: 'error', name: 'InvalidAddress', inputs: [] },
  { type: 'error', name: 'InvalidTerms', inputs: [] },
] as const

export const ledgerAnchorAbi = [
  { name: 'ledgerChainId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
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
] as const

/** Operator-gated LedgerAnchor used by the SCF offering (single-leaf roots). */
export const operatorAnchorAbi = [
  { name: 'push', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'root', type: 'bytes32' }], outputs: [{ name: 'epoch', type: 'uint256' }] },
  { name: 'epochs', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const

/** ScfInvestorLimitModule: POJK 57/2020 investor limit and offering cap. */
export const scfLimitModuleAbi = [
  { name: 'resetUsage', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'onchainId', type: 'address' }, { name: 'period', type: 'uint256' }], outputs: [] },
  { name: 'currentPeriod', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'usedOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'onchainId', type: 'address' }, { name: 'period', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  {
    name: 'profileOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'onchainId', type: 'address' }],
    outputs: [
      { name: 'annualLimit', type: 'uint128' },
      { name: 'bracket', type: 'uint8' },
      { name: 'exemption', type: 'uint8' },
      { name: 'updatedAt', type: 'uint64' },
    ],
  },
  {
    name: 'setProfile',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'onchainId', type: 'address' },
      { name: 'annualLimit', type: 'uint128' },
      { name: 'bracket', type: 'uint8' },
      { name: 'exemption', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'remainingOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [
      { name: 'limit', type: 'uint256' },
      { name: 'used', type: 'uint256' },
      { name: 'remaining', type: 'uint256' },
      { name: 'exemption', type: 'uint8' },
    ],
  },
  {
    name: 'offeringOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'compliance', type: 'address' }],
    outputs: [
      { name: 'treasury', type: 'address' },
      { name: 'offeringCap', type: 'uint256' },
      { name: 'configured', type: 'bool' },
    ],
  },
] as const

/** DepositoPoolLedger: the regional Deposito Pool's per-bank reserve ledger (an ILedgerAnchor). */
export const depositoPoolLedgerAbi = [
  {
    name: 'banks',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'ids', type: 'bytes32[]' },
      { name: 'names', type: 'string[]' },
      { name: 'accountRefs', type: 'string[]' },
      { name: 'balances', type: 'uint256[]' },
    ],
  },
  { name: 'totalBalance', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'snapshotAt', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { name: 'reserveEpoch', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'epochs', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  {
    name: 'postReserve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'at', type: 'uint64' }, { name: 'bankIds', type: 'bytes32[]' }, { name: 'balances', type: 'uint256[]' }],
    outputs: [{ name: 'epoch', type: 'uint256' }],
  },
  {
    name: 'postProfit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'period', type: 'uint32' }, { name: 'bankIds', type: 'bytes32[]' }, { name: 'profits', type: 'uint256[]' }],
    outputs: [{ name: 'epoch', type: 'uint256' }, { name: 'total', type: 'uint256' }],
  },
  {
    name: 'postMaturity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'at', type: 'uint64' }, { name: 'finalPeriod', type: 'uint32' }, { name: 'principal', type: 'uint256' }],
    outputs: [{ name: 'epoch', type: 'uint256' }],
  },
  { type: 'error', name: 'NotOperator', inputs: [] },
  { type: 'error', name: 'BadBank', inputs: [{ name: 'bankId', type: 'bytes32' }] },
  { type: 'error', name: 'LengthMismatch', inputs: [] },
  { type: 'error', name: 'StaleSnapshot', inputs: [{ name: 'latest', type: 'uint64' }, { name: 'got', type: 'uint64' }] },
  { type: 'error', name: 'FutureSnapshot', inputs: [{ name: 'got', type: 'uint64' }] },
] as const
