import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, parseAbi, type Address, type Hex } from 'viem'
import { methodGuard, publicClient, readableError, requirePasscode } from '../_lib/operator.js'
import { assertLiveChain, submitAdminTx } from '../_lib/safe.js'
import { encodeClaimData } from '../_lib/token-identity.js'
import { selfServiceIssuer, signKycClaim } from '../_lib/identity.js'
import deployments from '../../../src/web3/tokenization.deployments.json' with { type: 'json' }

const identityAbi = parseAbi([
  'function onchainID() view returns (address)',
  'function addClaim(uint256 topic, uint256 scheme, address issuer, bytes signature, bytes data, string uri) returns (bytes32)',
  'function removeClaim(bytes32 claimId) returns (bool)',
])

const raw = deployments as Record<string, unknown>
const tokenIdentityKeys = Object.keys(raw).filter((k) => k.endsWith('TokenIdentity'))

/**
 * Propose adding or removing a claim on a token's ONCHAINID to the Compliance Safe. Topics 10 to 13 only. The proposal
 * is refused before it is stored unless the claim data decodes, the issuer is trusted for the topic and the signature
 * verifies for that identity (safePolicy), so owners are never asked to approve a claim that would fail.
 *
 *   POST /api/tokenization/token-identity/claim
 *     { action: "add", token, topic: 10, name, licence, kind, originatorId?, issuer, signature, uri? }
 *     { action: "add", token, topic: 11, name, licence, platformId?, issuer, signature }
 *     { action: "add", token, topic: 12, name, entity, issuer, signature }
 *     { action: "add", token, topic: 13, documentHash, documentUri, issuer, signature }
 *     { action: "remove", token, claimId }
 *
 * `issuer` and `signature` come from the claim-signing EOA of the real ClaimIssuer (a Safe cannot make the ECDSA
 * claim signature). On Arbitrum Sepolia they may be left out: the testnet ClaimIssuer signs with demo names.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!requirePasscode(req, res)) return
  try {
    await assertLiveChain()
    const body = (req.body ?? {}) as Record<string, unknown>
    if (typeof body.token !== 'string' || !isAddress(body.token)) {
      res.status(400).json({ error: 'token must be a valid address.' })
      return
    }
    const token = getAddress(body.token) as Address
    const identity = (await publicClient.readContract({ address: token, abi: identityAbi, functionName: 'onchainID' })) as Address
    const known = tokenIdentityKeys.some((k) => typeof raw[k] === 'string' && (raw[k] as string).toLowerCase() === identity.toLowerCase())
    if (!known) {
      res.status(404).json({ error: 'This token has no recorded ONCHAINID.' })
      return
    }

    if (body.action === 'remove') {
      if (typeof body.claimId !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(body.claimId)) {
        res.status(400).json({ error: 'claimId must be a 32 byte hex string.' })
        return
      }
      const sent = await submitAdminTx({ duty: 'compliance', address: identity, abi: identityAbi, functionName: 'removeClaim', args: [body.claimId as Hex], description: `Remove a token claim from ${token}` })
      res.status(sent.proposed ? 202 : 200).json(sent)
      return
    }
    if (body.action !== 'add') {
      res.status(400).json({ error: 'action must be "add" or "remove".' })
      return
    }

    const topic = Number(body.topic)
    const data = encodeClaimData(topic, body)
    if (!data) {
      res.status(400).json({ error: `The fields for a topic ${body.topic} claim are missing or malformed.` })
      return
    }
    let issuer: Address
    let signature: Hex
    if (typeof body.signature === 'string' && /^0x[0-9a-fA-F]+$/.test(body.signature) && typeof body.issuer === 'string' && isAddress(body.issuer)) {
      issuer = getAddress(body.issuer) as Address
      signature = body.signature as Hex
    } else {
      // Testnet only: the test ClaimIssuer signs with demo names. selfServiceIssuer refuses every other chain.
      const t = selfServiceIssuer()
      issuer = t.address
      signature = await signKycClaim(identity, BigInt(topic), data)
    }
    const uri = typeof body.uri === 'string' && body.uri.length <= 300 ? body.uri : ''
    const sent = await submitAdminTx({
      duty: 'compliance',
      address: identity,
      abi: identityAbi,
      functionName: 'addClaim',
      args: [BigInt(topic), 1n, issuer, signature, data, uri],
      description: `Add a topic ${topic} claim to ${token}`,
    })
    res.status(sent.proposed ? 202 : 200).json(sent)
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
