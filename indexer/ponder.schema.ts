import { index, onchainTable, primaryKey } from 'ponder'

// Same shape as ActivityEvent in tawf-finance/api/_tokenization/_lib/activity-core.ts, so the app can switch to it later.
export const activity = onchainTable(
  'activity',
  (t) => ({
    id: t.text().primaryKey(), // txHash:logIndex
    product: t.text().notNull(), // pool | series1 | series2 | scf | ledger | identity
    kind: t.text().notNull(), // the event name
    txHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    contract: t.hex().notNull(),
    investor: t.hex(),
    token: t.hex(), // the settlement coin for coin events
    coin: t.bigint(), // settlement coin base units (6 decimals)
    sen: t.bigint(), // IDR sen (2 decimals)
    limit: t.bigint(), // SCF annual limit (ProfileSet)
    onchainId: t.hex(),
    period: t.integer(),
  }),
  (t) => ({
    investorIdx: index().on(t.investor),
    productIdx: index().on(t.product),
    blockIdx: index().on(t.blockNumber),
  }),
)

// Running totals per wallet and product. Pending = subscribed - refunded - allocated coin (pool and series).
export const walletPosition = onchainTable(
  'wallet_position',
  (t) => ({
    id: t.text().primaryKey(), // product:wallet
    product: t.text().notNull(),
    wallet: t.hex().notNull(),
    subscribedCoin: t.bigint().notNull(),
    refundedCoin: t.bigint().notNull(),
    allocatedCoin: t.bigint().notNull(),
    allocatedSen: t.bigint().notNull(), // series units minted
    profitClaimedCoin: t.bigint().notNull(),
    redeemedCoin: t.bigint().notNull(), // principal plus profit paid at redemption
    lastEventAt: t.integer().notNull(),
  }),
  (t) => ({ walletIdx: index().on(t.wallet) }),
)

export const bank = onchainTable('bank', (t) => ({
  id: t.hex().primaryKey(), // bankId
  name: t.text().notNull(),
  accountRef: t.text().notNull(),
  addedAt: t.integer().notNull(),
}))

// BankBalance: each bank's total at an epoch.
export const bankSnapshot = onchainTable(
  'bank_snapshot',
  (t) => ({
    epoch: t.bigint().notNull(),
    bankId: t.hex().notNull(),
    snapshotAt: t.bigint().notNull(),
    balanceSen: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
  }),
  (t) => ({ pk: primaryKey({ columns: [t.epoch, t.bankId] }) }),
)

// BankProfit: each bank's profit for a period.
export const bankProfit = onchainTable(
  'bank_profit',
  (t) => ({
    period: t.integer().notNull(),
    bankId: t.hex().notNull(),
    profitSen: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
  }),
  (t) => ({ pk: primaryKey({ columns: [t.period, t.bankId] }) }),
)

// ReserveRecorded, ProfitRecorded and MaturityRecorded, keyed by epoch and kind.
export const ledgerEpoch = onchainTable(
  'ledger_epoch',
  (t) => ({
    id: t.text().primaryKey(), // kind:epoch
    kind: t.text().notNull(), // reserve | profit | maturity
    epoch: t.bigint().notNull(),
    period: t.integer(),
    snapshotAt: t.bigint(),
    totalSen: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
  }),
  (t) => ({ kindIdx: index().on(t.kind) }),
)

// One row per SCF distributor. Raised and paid out per coin are in scf_coin_flow.
export const scfOffering = onchainTable('scf_offering', (t) => ({
  id: t.hex().primaryKey(), // distributor address
  version: t.text().notNull(), // v1 (single coin) | v2 (multi coin)
  status: t.text().notNull(), // open | issued | cancelled | matured | defaulted
  deadline: t.integer(),
  raised: t.bigint().notNull(), // at issue or cancel, coin base units
  outstanding: t.bigint(), // last ReserveUpdated
  reserveEpoch: t.integer(),
  updatedAt: t.integer().notNull(),
}))

// Per distributor and coin. The V1 distributor has a single coin, stored under the zero address.
export const scfCoinFlow = onchainTable(
  'scf_coin_flow',
  (t) => ({
    id: t.text().primaryKey(), // distributor:coin
    distributor: t.hex().notNull(),
    coin: t.hex().notNull(),
    subscribed: t.bigint().notNull(),
    refunded: t.bigint().notNull(),
    profitDistributed: t.bigint().notNull(),
    profitClaimed: t.bigint().notNull(),
    maturitySettled: t.bigint().notNull(),
    redeemedPrincipal: t.bigint().notNull(),
    redeemedProfit: t.bigint().notNull(),
    toppedUp: t.bigint().notNull(),
    payoutParts: t.bigint().notNull(), // coin actually paid out, from PayoutPart
  }),
  (t) => ({ distributorIdx: index().on(t.distributor) }),
)

export const scfLimitProfile = onchainTable('scf_limit_profile', (t) => ({
  id: t.text().primaryKey(), // module:onchainId
  module: t.hex().notNull(),
  onchainId: t.hex().notNull(),
  annualLimit: t.bigint().notNull(),
  bracket: t.integer().notNull(),
  exemption: t.integer().notNull(),
  updatedAt: t.integer().notNull(),
}))

export const identity = onchainTable('identity', (t) => ({
  wallet: t.hex().primaryKey(),
  identity: t.hex().notNull(),
  registeredAt: t.integer().notNull(),
  removed: t.boolean().notNull(),
}))

// Beacon upgrades, Safe executions, owner and threshold changes.
export const governanceEvent = onchainTable(
  'governance_event',
  (t) => ({
    id: t.text().primaryKey(), // txHash:logIndex
    source: t.text().notNull(), // beacon | safe
    kind: t.text().notNull(),
    contract: t.hex().notNull(),
    subject: t.hex(), // new implementation, owner, 
    value: t.bigint(), // threshold or payment
    ref: t.hex(), // Safe tx hash
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    timestamp: t.integer().notNull(),
  }),
  (t) => ({ contractIdx: index().on(t.contract), sourceIdx: index().on(t.source) }),
)

// Pause and freeze events from the T-REX tokens, for the audit trail.
export const tokenControl = onchainTable(
  'token_control',
  (t) => ({
    id: t.text().primaryKey(),
    token: t.hex().notNull(),
    kind: t.text().notNull(), // Paused | Unpaused | AddressFrozen | TokensFrozen | TokensUnfrozen
    account: t.hex(),
    amount: t.bigint(),
    frozen: t.boolean(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    timestamp: t.integer().notNull(),
  }),
  (t) => ({ tokenIdx: index().on(t.token) }),
)

export const tokenTransferCount = onchainTable('token_transfer_count', (t) => ({
  token: t.hex().primaryKey(),
  transfers: t.bigint().notNull(),
  lastBlock: t.bigint().notNull(),
}))

export const fxRate = onchainTable('fx_rate', (t) => ({
  id: t.text().primaryKey(), // txHash:logIndex
  contract: t.hex().notNull(),
  token: t.hex().notNull(),
  idrPerToken: t.bigint().notNull(),
  updatedAt: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
  timestamp: t.integer().notNull(),
}))

// HISTORY ONLY. Claims added, changed and removed on a token's ONCHAINID: when the originator, platform, partner or
// document data changed. Nothing here says a claim is valid or trusted: the app never shows this table as verified,
// it checks every claim live through the token-identity API (signature, trusted issuer, trusted for the topic).
export const tokenClaim = onchainTable(
  'token_claim',
  (t) => ({
    id: t.text().primaryKey(), // txHash:logIndex
    token: t.hex().notNull(), // the token this identity belongs to
    identity: t.hex().notNull(),
    kind: t.text().notNull(), // ClaimAdded | ClaimChanged | ClaimRemoved
    topic: t.bigint().notNull(), // 10 ORIGINATOR, 11 PLATFORM, 12 TOKENIZATION_PARTNER, 13 OFFERING_DOCS
    claimId: t.hex().notNull(),
    issuer: t.hex().notNull(),
    scheme: t.bigint().notNull(),
    data: t.hex().notNull(), // abi-encoded fields, decoded by the app
    uri: t.text().notNull(), // capped at 512 characters
    truncated: t.boolean().notNull(), // data or uri were cut to the stored size caps
    identityActive: t.boolean().notNull(), // the identity was the token's current one when this event was indexed
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    timestamp: t.integer().notNull(),
  }),
  (t) => ({ tokenIdx: index().on(t.token), identityIdx: index().on(t.identity), topicIdx: index().on(t.topic) }),
)

// Which token an ONCHAINID belongs to, kept current from Token.UpdatedTokenInformation (emitted by setOnchainID).
// A setOnchainID swap marks the token's previous identity inactive, so claims map to the token they belong to now.
export const tokenIdentityLink = onchainTable(
  'token_identity_link',
  (t) => ({
    id: t.hex().primaryKey(), // the ONCHAINID address
    token: t.hex().notNull(),
    active: t.boolean().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (t) => ({ tokenIdx: index().on(t.token) }),
)
