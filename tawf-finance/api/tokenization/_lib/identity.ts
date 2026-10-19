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
import {
  publicClient,
  walletClient,
  account,
  addresses,
} from './operator.js'
import { identityAbi, identityRegistryAbi, identityProxyAbi } from './abis.js'

const COUNTRY_ID = 360 // Indonesia
const ZERO = '0x0000000000000000000000000000000000000000'

export interface IdentityStep {
  label: string
  txHash?: Hex
  skipped?: boolean
  note?: string
}

/**
 * Build the eth-signed KYC claim exactly as ClaimIssuer.isClaimValid expects:
 * dataHash = keccak256(abi.encode(identity, topic, data)); signed as a message.
 */
async function signKycClaim(identity: Address, topic: bigint, data: Hex): Promise<Hex> {
  const dataHash = keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }],
      [identity, topic, data],
    ),
  )
  return account().signMessage({ message: { raw: toBytes(dataHash) } })
}

/**
 * Ensure `user` is a verified holder. Returns the steps taken (idempotent) and
 * the final verified status. Throws if the identity proxy bytecode is missing.
 */
export async function ensureVerified(user: Address): Promise<{ steps: IdentityStep[]; isVerified: boolean }> {
  const steps: IdentityStep[] = []
  const wc = walletClient()

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
      args: [addresses.implementationAuthority, account().address],
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
    args: [addresses.kycClaimTopic, 1n, addresses.claimIssuer, sig, claimData, ''],
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
  const steps: IdentityStep[] = []
  const wc = walletClient()

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
    args: [topic, 1n, addresses.claimIssuer, sig, claimData, ''],
  })
  await publicClient.waitForTransactionReceipt({ hash: addClaimHash })
  steps.push({
    label: topic === 3n ? 'Issued OJK_SANDBOX_PARTICIPANT claim' : 'Issued TAWF_SCREENED claim',
    txHash: addClaimHash,
    note: note ? `Off-chain note (not on chain): ${note}` : undefined,
  })

  return { steps, identity }
}
