import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address, type Hex } from 'viem'
import {
  publicClient,
  walletClient,
  account,
  addresses,
  isConfigured,
  methodGuard,
  requirePasscode,
  readableError,
  seriesTarget,
} from '../_lib/operator.js'
import { mockTokenAbi, tawfSeriesAbi } from '../_lib/abis.js'
import type { IdentityStep } from '../_lib/identity.js'

/**
 * Add a mock settlement stablecoin to the series allowlist (ADMIN_ROLE, held by
 * the operator), then make sure the treasury can pay out in it. Only the
 * deployment's own mock coins are accepted. Idempotent: a coin already on the
 * allowlist, or a treasury already holding it, is left untouched. After this,
 * post the coin's rate and approve the series from the admin page.
 *
 *   POST /api/tokenization/series/add-stablecoin { token }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return
  const target = seriesTarget(req)

  try {
    const rawToken = req.body?.token
    if (typeof rawToken !== 'string' || !isAddress(rawToken)) {
      res.status(400).json({ error: 'token must be a valid stablecoin address.' })
      return
    }
    const token = getAddress(rawToken) as Address
    const known = [addresses.mockUsdc, addresses.mockUsdt, addresses.mockUsdg].map((a) => a.toLowerCase())
    if (!known.includes(token.toLowerCase())) {
      res.status(400).json({ error: 'Only the deployment mock stablecoins (mUSDC, mUSDT, mUSDG) can be added here.' })
      return
    }
    const series = target.series
    const wc = walletClient()
    const steps: IdentityStep[] = []

    const allowed = (await publicClient.readContract({
      address: series,
      abi: tawfSeriesAbi,
      functionName: 'isStablecoin',
      args: [token],
    })) as boolean
    if (allowed) {
      steps.push({ label: 'Already a settlement coin', skipped: true })
    } else {
      const txHash = (await wc.writeContract({
        address: series,
        abi: tawfSeriesAbi,
        functionName: 'addStablecoin',
        args: [token],
      })) as Hex
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      steps.push({ label: 'Added to the series allowlist', txHash })
    }

    // Payouts transfer from the treasury, so it needs a balance in the coin.
    const treasury = (await publicClient.readContract({
      address: series,
      abi: tawfSeriesAbi,
      functionName: 'treasury',
    })) as Address
    const balance = (await publicClient.readContract({
      address: token,
      abi: mockTokenAbi,
      functionName: 'balanceOf',
      args: [treasury],
    })) as bigint
    if (balance > 0n) {
      steps.push({ label: 'Treasury already holds this coin', skipped: true })
    } else if (treasury.toLowerCase() !== account().address.toLowerCase()) {
      steps.push({ label: 'Treasury is not the operator: fund it separately', skipped: true })
    } else {
      const txHash = (await wc.writeContract({ address: token, abi: mockTokenAbi, functionName: 'faucetMax' })) as Hex
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      steps.push({ label: 'Minted test funds to the treasury', txHash })
    }

    res.status(200).json({ token, steps })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Add stablecoin failed') })
  }
}
