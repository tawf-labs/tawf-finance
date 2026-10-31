import { createConfig, factory } from 'ponder'
import { parseAbiItem } from 'viem'
import { BeaconAbi, SafeAbi } from './abis/Governance'
import { DepositoPoolLedgerAbi } from './abis/DepositoPoolLedger'
import { IdentityRegistryAbi } from './abis/IdentityRegistry'
import { ScfInvestorLimitModuleAbi } from './abis/ScfInvestorLimitModule'
import { SukukDistributorAbi } from './abis/SukukDistributor'
import { SukukDistributorV1Abi } from './abis/SukukDistributorV1'
import { TawfDepositoSeriesAbi } from './abis/TawfDepositoSeries'
import { TokenAbi } from './abis/Token'
import { TokenIdentityAbi } from './abis/TokenIdentity'
import { addr, block, bySuffix } from './src/lib/deployments'
import { splitTransport } from './src/lib/transport'

// Arbitrum Sepolia only. Governance is beacons and Safes, there is no timelock. Addresses and start blocks come from tokenization.deployments.json, V1 keys included.
// A contract whose key is missing or zero is left out, so the config follows the file after a redeploy.
const seriesFrom = block('tawfSeriesBlock')
const poolFrom = block('depositoPoolBlock', seriesFrom)
const scfFrom = block('scfBlock', seriesFrom)
const scfV1From = block('scfBlockV1', seriesFrom)
// Beacon keys end in Beacon (any), Safe keys are govSafe, treasurySafe, mintingSafe, complianceSafe and guardianSafe,
// and governanceStartBlock is a top-level key in the deployments file.
const govFrom = block('governanceStartBlock', seriesFrom)

const A = 'arbitrumSepolia' as const
const one = <T extends object>(address: string | null, startBlock: number, extra: T) =>
  address ? { ...extra, chain: { [A]: { address: address as `0x${string}`, startBlock } } } : null
const many = <T extends object>(addresses: string[], startBlock: number, extra: T) =>
  addresses.length ? { ...extra, chain: { [A]: { address: addresses as `0x${string}`[], startBlock } } } : null

// A setOnchainID swap emits UpdatedTokenInformation on the token with the new ONCHAINID. Ponder's factory pattern turns
// that event into a new contract to index, so a swapped-in identity is followed with no config change or restart.
const updatedTokenInfo = parseAbiItem(
  'event UpdatedTokenInformation(string indexed _newName, string indexed _newSymbol, uint8 _newDecimals, string _newVersion, address indexed _newOnchainID)',
)

const tokens = ['tawfSeriesToken', 'tawfSeries2Token', 'depositoPoolToken', 'scfToken', 'scfTokenV1', 'sukukToken', 'sukuk2Token']
  .map(addr)
  .filter((a): a is `0x${string}` => a !== null)

// Token ONCHAINIDs: the deploy records one <token key>Identity per token (tawfSeriesTokenIdentity, scfTokenIdentity, ...).
const tokenIdentities = Object.values(bySuffix('TokenIdentity'))
const beacons = Object.values(bySuffix('Beacon'))
const safes = Object.values(bySuffix('Safe'))

const candidates = {
  DepositoLedger: one(addr('depositoPoolLedger'), poolFrom, { abi: DepositoPoolLedgerAbi }),
  Series1: one(addr('tawfSeries'), seriesFrom, { abi: TawfDepositoSeriesAbi }),
  Series2: one(addr('tawfSeries2'), seriesFrom, { abi: TawfDepositoSeriesAbi }),
  PoolSeries: one(addr('depositoPool'), poolFrom, { abi: TawfDepositoSeriesAbi }),
  ScfDistributor: one(addr('scfDistributor'), scfFrom, { abi: SukukDistributorAbi }),
  ScfDistributorV1: one(addr('scfDistributorV1'), scfV1From, { abi: SukukDistributorV1Abi }),
  ScfLimit: one(addr('scfLimitModule'), scfFrom, { abi: ScfInvestorLimitModuleAbi }),
  ScfLimitV1: one(addr('scfLimitModuleV1'), scfV1From, { abi: ScfInvestorLimitModuleAbi }),
  IdentityRegistry: one(addr('identityRegistry'), seriesFrom, { abi: IdentityRegistryAbi }),
  Token: many(tokens, seriesFrom, { abi: TokenAbi }),
  // The identities recorded at deploy (<token key>Identity), and every identity a token is later pointed at.
  TokenIdentity: many(tokenIdentities, govFrom, { abi: TokenIdentityAbi }),
  TokenIdentityLinked: tokens.length
    ? { abi: TokenIdentityAbi, chain: { [A]: { address: factory({ address: tokens, event: updatedTokenInfo, parameter: '_newOnchainID' }), startBlock: seriesFrom } } }
    : null,
  Beacon: many(beacons, govFrom, { abi: BeaconAbi }),
  Safe: many(safes, govFrom, { abi: SafeAbi }),
}

const contracts = Object.fromEntries(Object.entries(candidates).filter(([, v]) => v !== null)) as {
  [K in keyof typeof candidates]: NonNullable<(typeof candidates)[K]>
}

export default createConfig({
  chains: {
    arbitrumSepolia: {
      id: 421614,
      // QuickNode serves live blocks and narrow log queries, the public RPC serves the wide backfill ranges.
      rpc: splitTransport(process.env.QUICKNODE_ARB_SEPOLIA_URL, process.env.PUBLIC_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc'),
      pollingInterval: 1_000,
    },
  },
  contracts,
})
