import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, verifyMessage, type Address, type Hex } from 'viem'
import {
  publicClient,
  walletClient,
  addresses,
  isScfConfigured,
  methodGuard,
  readableError,
} from '../_lib/operator.js'
import { identityRegistryAbi, scfLimitModuleAbi } from '../_lib/abis.js'
import { ensureVerified } from '../_lib/identity.js'

const ZERO = '0x0000000000000000000000000000000000000000'
/** POJK 57/2020: up to Rp500m income may invest 5% a year, above it 10%. */
const INCOME_THRESHOLD_IDR = 500_000_000n
const MAX_INCOME_IDR = 1_000_000_000_000_000n

const EXEMPTIONS = { none: 0, legal_entity: 1, capital_market_2y: 2 } as const
type ExemptionKey = keyof typeof EXEMPTIONS

/**
 * The text the investor signs. Must match `scfDeclarationMessage` in
 * src/lib/scf.ts exactly.
 */
export function declarationMessage(wallet: Address, incomeIdr: bigint, exemption: ExemptionKey): string {
  return [
    'Tawf SCF suitability declaration (testnet)',
    `Wallet: ${wallet}`,
    `Annual income (IDR): ${incomeIdr.toString()}`,
    `Exemption: ${exemption}`,
  ].join('\n')
}

/**
 * Record an investor's securities crowdfunding (SCF) suitability profile on
 * the ScfInvestorLimitModule. The investor self-declares their annual income
 * (and optionally an exemption) and signs the declaration with their wallet.
 * The server, as the platform agent, verifies the identity (as the faucet
 * does), computes the POJK 57/2020 yearly limit, converts it from IDR to USDC
 * at the deployment's USDC rate, and writes it on chain. Only the limit and a
 * bracket code go on chain, never the income figure.
 *
 * No passcode: the wallet signature authorizes the change.
 *
 *   POST /api/tokenization/scf/profile { wallet, incomeIdr, exemption, signature }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isScfConfigured()) {
    res.status(503).json({ error: 'The crowdfunding offering is not deployed yet.' })
    return
  }

  try {
    const { wallet, incomeIdr, exemption = 'none', signature } = req.body ?? {}
    if (typeof wallet !== 'string' || !isAddress(wallet)) {
      res.status(400).json({ error: 'A valid wallet address is required.' })
      return
    }
    if (typeof exemption !== 'string' || !(exemption in EXEMPTIONS)) {
      res.status(400).json({ error: 'exemption must be none, legal_entity or capital_market_2y.' })
      return
    }
    let income: bigint
    try {
      income = BigInt(String(incomeIdr ?? '0').replace(/[^0-9]/g, '') || '0')
    } catch {
      income = 0n
    }
    if (exemption === 'none' && (income <= 0n || income > MAX_INCOME_IDR)) {
      res.status(400).json({ error: 'Enter your annual income in rupiah.' })
      return
    }
    const user = getAddress(wallet) as Address
    const ex = exemption as ExemptionKey
    const ok =
      typeof signature === 'string' &&
      (await verifyMessage({ address: user, message: declarationMessage(user, income, ex), signature: signature as Hex }).catch(() => false))
    if (!ok) {
      res.status(401).json({ error: 'The declaration signature does not match this wallet.' })
      return
    }

    const { steps } = await ensureVerified(user)
    const identity = (await publicClient.readContract({
      address: addresses.identityRegistry,
      abi: identityRegistryAbi,
      functionName: 'identity',
      args: [user],
    })) as Address
    if (identity === ZERO) {
      res.status(409).json({ error: 'The identity is not registered yet. Try again in a moment.', steps })
      return
    }

    // Two-decimal IDR per USDC, e.g. 16,250.00 -> 1_625_000.
    const rate = addresses.fxInitialRateUsdc > 0n ? addresses.fxInitialRateUsdc : 1_625_000n
    const pct = income <= INCOME_THRESHOLD_IDR ? 5n : 10n
    const limitIdr = ex === 'none' ? (income * pct) / 100n : 0n
    const limit = (limitIdr * 100n * 1_000_000n) / rate
    const bracket = ex !== 'none' ? 3 : pct === 5n ? 1 : 2

    const hash = await walletClient().writeContract({
      address: addresses.scfLimitModule,
      abi: scfLimitModuleAbi,
      functionName: 'setProfile',
      args: [identity, limit, bracket, EXEMPTIONS[ex]],
    })
    await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })
    steps.push({ label: 'SCF investor limit recorded', txHash: hash })

    res.status(200).json({
      wallet: user,
      bracket,
      percent: ex === 'none' ? Number(pct) : null,
      limitIdr: limitIdr.toString(),
      limit: limit.toString(),
      exemption: ex,
      steps,
    })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Could not record the profile') })
  }
}
