/**
 * Shared ERC-3643 identity registration helper, used by both the faucet and
 * the Didit KYC webhook so a wallet becomes a verified holder the same way in
 * both paths.
 *
 * The flow mirrors tawf-gold-bsi's faucet: deploy an IdentityProxy with the
 * operator as the management key, add an operator-signed KYC claim (topic 1),
 * then registerIdentity in the shared T-REX IdentityRegistry. All steps are
 * idempotent, a wallet that is already verified is left untouched.
 */
import {
  getAddress,
  keccak256,
  encodeAbiParameters,
  toBytes,
  stringToHex,
  type Address,
  type Hex,
} from 'viem'
import { nonceManager } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'
import {
  publicClient,
  walletClient,
  walletClientFor,
  account,
  addresses,
} from './operator.js'
import { assertLiveChain, safesRequired } from './safe.js'
import { identityAbi, identityRegistryAbi, identityProxyAbi, claimIssuerAbi } from './abis.js'

const COUNTRY_ID = 360 // Indonesia

/** Compromised testnet burners: never verified, funded or screened. Shared by the faucet, KYC and screening paths. */
const BLOCKED_WALLETS = new Set(['0x6155aecb5eab7719804f67de1e4ef878f0226f87'])
export const BLOCKED_WALLET_MESSAGE = 'This wallet is blocked on the testnet faucet.'
export function isBlockedWallet(user: string): boolean {
  return BLOCKED_WALLETS.has(user.toLowerCase())
}
function assertNotBlocked(user: string): void {
  if (isBlockedWallet(user)) throw new Error(BLOCKED_WALLET_MESSAGE)
}
const ZERO = '0x0000000000000000000000000000000000000000'

export interface IdentityStep {
  label: string
  txHash?: Hex
  skipped?: boolean
  note?: string
}

/**
 * Who issues the self-service (faucet and screening) claims.
 *
 * Testnet only. On Arbitrum Sepolia a separate TEST ClaimIssuer signs them: an EOA key
 * (TEST_CLAIM_ISSUER_KEY) that is a claim-signing key of the `testClaimIssuer` contract, which is a
 * trusted issuer for the KYC and TAWF_SCREENED topics only. The real ClaimIssuer (`claimIssuer`) is
 * managed by the Compliance Safe and never signs through this API.
 *
 * Fails closed: off chain 421614 it always throws. On 421614 with no `testClaimIssuer` deployed yet
 * (the pre-Safe stack) it falls back to the operator key and the old `claimIssuer`.
 */
export function selfServiceIssuer(chainId: number = Number(addresses.chainId)): {
  address: Address
  sign: (message: Hex) => Promise<Hex>
} {
  if (chainId !== arbitrumSepolia.id) {
    throw new Error('Self-service claims are testnet only: this chain has no test ClaimIssuer.')
  }
  if (addresses.testClaimIssuer === ZERO) {
    if (safesRequired(chainId)) throw new Error('testClaimIssuer is not deployed and SAFES_REQUIRED is on')
    return { address: addresses.claimIssuer, sign: (m) => account().signMessage({ message: { raw: toBytes(m) } }) }
  }
  const k = process.env.TEST_CLAIM_ISSUER_KEY
  if (!k) throw new Error('TEST_CLAIM_ISSUER_KEY is not set')
  const signer = privateKeyToAccount((k.startsWith('0x') ? k : `0x${k}`) as Hex)
  return { address: addresses.testClaimIssuer, sign: (m) => signer.signMessage({ message: { raw: toBytes(m) } }) }
}

/**
 * Who registers identities for the self-service faucet.
 *
 * Testnet only, same pattern as the test ClaimIssuer. On Arbitrum Sepolia a separate EOA
 * (TEST_REGISTRY_AGENT_KEY, deployments key `testRegistryAgent`) holds the IdentityRegistry agent
 * role, is the management key of the identities it creates, and registers them. The operator holds no
 * registry role. Fails closed: off chain 421614 it always throws. On 421614 with no `testRegistryAgent`
 * deployed yet (the pre-Safe stack) it falls back to the operator, which still holds the role there.
 */
export function selfServiceAgent(chainId: number = Number(addresses.chainId)): {
  address: Address
  wc: ReturnType<typeof walletClient>
} {
  if (chainId !== arbitrumSepolia.id) {
    throw new Error('The self-service registry agent is testnet only: this chain has none.')
  }
  if (addresses.testRegistryAgent === ZERO) {
    if (safesRequired(chainId)) throw new Error('testRegistryAgent is not deployed and SAFES_REQUIRED is on')
    return { address: account().address, wc: walletClient() }
  }
  const k = process.env.TEST_REGISTRY_AGENT_KEY
  if (!k) throw new Error('TEST_REGISTRY_AGENT_KEY is not set')
  const agent = privateKeyToAccount((k.startsWith('0x') ? k : `0x${k}`) as Hex, { nonceManager })
  if (agent.address.toLowerCase() !== addresses.testRegistryAgent.toLowerCase()) {
    throw new Error('TEST_REGISTRY_AGENT_KEY does not match deployments testRegistryAgent')
  }
  return { address: agent.address, wc: walletClientFor(agent as ReturnType<typeof account>) }
}

/**
 * Build the eth-signed KYC claim exactly as ClaimIssuer.isClaimValid expects:
 * dataHash = keccak256(abi.encode(identity, topic, data)); signed as a message.
 */
export async function signKycClaim(identity: Address, topic: bigint, data: Hex): Promise<Hex> {
  // The signature must come from a claim key of the issuer that is named in addClaim (selfServiceIssuer).
  const dataHash = keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }],
      [identity, topic, data],
    ),
  )
  return selfServiceIssuer().sign(dataHash)
}

/**
 * Ensure `user` is a verified holder. Returns the steps taken (idempotent) and
 * the final verified status. Throws if the identity proxy bytecode is missing.
 */
export async function ensureVerified(user: Address): Promise<{ steps: IdentityStep[]; isVerified: boolean }> {
  assertNotBlocked(user)
  await assertLiveChain()
  const steps: IdentityStep[] = []
  const { wc, address: agentAddress } = selfServiceAgent()

  const alreadyVerified = await publicClient.readContract({
    address: addresses.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'isVerified',
    args: [user],
  })
  if (alreadyVerified) {
    steps.push({ label: 'Identity already verified', skipped: true })
    return { steps, isVerified: true }
  }

  let identity = (await publicClient.readContract({
    address: addresses.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'identity',
    args: [user],
  })) as Address

  if (identity === ZERO) {
    if (!addresses.identityProxyBytecode || addresses.identityProxyBytecode === '0x') {
      throw new Error('identityProxyBytecode missing from tokenization.deployments.json')
    }
    const deployHash = await wc.deployContract({
      abi: identityProxyAbi,
      bytecode: addresses.identityProxyBytecode,
      args: [addresses.implementationAuthority, agentAddress],
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash })
    if (!receipt.contractAddress) throw new Error('Identity proxy deployment did not return an address')
    identity = getAddress(receipt.contractAddress) as Address
    steps.push({ label: 'Deployed on-chain identity (ONCHAINID)', txHash: deployHash, note: identity })
  } else {
    steps.push({ label: 'Reusing existing identity', skipped: true, note: identity })
  }

  // Operator signs + adds the KYC claim (topic 1).
  const claimData = stringToHex('KYC-OK')
  const sig = await signKycClaim(identity, addresses.kycClaimTopic, claimData)
  const addClaimHash = await wc.writeContract({
    address: identity,
    abi: identityAbi,
    functionName: 'addClaim',
    args: [addresses.kycClaimTopic, 1n, selfServiceIssuer().address, sig, claimData, ''],
  })
  await publicClient.waitForTransactionReceipt({ hash: addClaimHash })
  steps.push({ label: 'Added KYC claim signed by the trusted ClaimIssuer', txHash: addClaimHash })

  const regHash = await wc.writeContract({
    address: addresses.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'registerIdentity',
    args: [user, identity, COUNTRY_ID],
  })
  await publicClient.waitForTransactionReceipt({ hash: regHash })
  steps.push({ label: 'Registered identity in the T-REX IdentityRegistry', txHash: regHash })

  const isVerified = await publicClient.readContract({
    address: addresses.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'isVerified',
    args: [user],
  })

  return { steps, isVerified: Boolean(isVerified) }
}

/**
 * Issue a Tawf screening claim of `topic` (2 = TAWF_SCREENED, 3 =
 * OJK_SANDBOX_PARTICIPANT) to `user`'s ONCHAINID, signed by the operator (the
 * Tawf ClaimIssuer management key). Same mechanics as the KYC claim: the
 * SandboxModule reads it off the identity and checks ClaimIssuer.isClaimValid.
 *
 * The wallet must already have an on-chain identity (run the faucet / KYC
 * first). The free-text verification note is NOT written on chain: it is
 * returned to the caller for off-chain logging only, so no personal data
 * reaches the ledger. Idempotent-ish: adding the same claim twice just
 * overwrites it (claim id is keccak256(issuer, topic)).
 */
export async function issueScreeningClaim(
  user: Address,
  topic: bigint,
  note?: string,
): Promise<{ steps: IdentityStep[]; identity: Address }> {
  assertNotBlocked(user)
  await assertLiveChain()
  const steps: IdentityStep[] = []
  const { wc } = selfServiceAgent()

  const identity = (await publicClient.readContract({
    address: addresses.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'identity',
    args: [user],
  })) as Address

  if (identity === ZERO) {
    throw new Error('Wallet has no on-chain identity yet. Run the faucet (KYC) for it first.')
  }

  const claimData = stringToHex('SCREENED')
  const sig = await signKycClaim(identity, topic, claimData)
  const addClaimHash = await wc.writeContract({
    address: identity,
    abi: identityAbi,
    functionName: 'addClaim',
    args: [topic, 1n, selfServiceIssuer().address, sig, claimData, ''],
  })
  await publicClient.waitForTransactionReceipt({ hash: addClaimHash })
  steps.push({
    label: topic === 3n ? 'Issued OJK_SANDBOX_PARTICIPANT claim' : 'Issued TAWF_SCREENED claim',
    txHash: addClaimHash,
    note: note ? `Off-chain note (not on chain): ${note}` : undefined,
  })

  return { steps, identity }
}

/** True when `user`'s ONCHAINID already holds a Tawf claim of `topic` that the ClaimIssuer still accepts. */
export async function hasValidScreeningClaim(user: Address, topic: bigint): Promise<boolean> {
  const identity = (await publicClient.readContract({
    address: addresses.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'identity',
    args: [user],
  })) as Address
  if (identity === ZERO) return false
  const claimId = keccak256(
    encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [selfServiceIssuer().address, topic]),
  )
  try {
    const [, , issuer, signature, data] = (await publicClient.readContract({
      address: identity,
      abi: identityAbi,
      functionName: 'getClaim',
      args: [claimId],
    })) as readonly [bigint, bigint, Address, Hex, Hex, string]
    if (issuer === ZERO) return false
    return (await publicClient.readContract({
      address: selfServiceIssuer().address,
      abi: claimIssuerAbi,
      functionName: 'isClaimValid',
      args: [identity, topic, signature, data],
    })) as boolean
  } catch {
    return false
  }
}
