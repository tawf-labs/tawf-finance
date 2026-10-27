import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, parseEther, type Address, type Hex } from 'viem'
import {
  publicClient,
  walletClient,
  account,
  addresses,
  isConfigured,
  methodGuard,
  readableError,
} from './_lib/operator.js'
import { mockTokenAbi } from './_lib/abis.js'
import { ensureVerified, type IdentityStep } from './_lib/identity.js'

const MIN_USER_ETH = parseEther('0.002')
const TOP_UP = parseEther('0.002')
const MIN_OPERATOR_ETH = parseEther('0.01')

const ZERO = '0x0000000000000000000000000000000000000000'

/**
 * Faucet: fund gas, mint test mUSDC, mUSDT and mUSDG, and verify the wallet's ERC-3643
 * identity. No passcode: this is a demo convenience for any connected wallet.
 * Idempotent, a wallet that already has funds and a verified identity is left
 * untouched.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }

  try {
    const { address } = req.body ?? {}
    if (!address || typeof address !== 'string' || !isAddress(address)) {
      res.status(400).json({ error: 'A valid wallet address is required.' })
      return
    }
    const user = getAddress(address) as Address
    const steps: IdentityStep[] = []
    const wc = walletClient()

    // 1. Fund the user with gas if low.
    const userEth = await publicClient.getBalance({ address: user })
    if (userEth < MIN_USER_ETH) {
      const opEth = await publicClient.getBalance({ address: account().address })
      if (opEth < MIN_OPERATOR_ETH) {
        res.status(503).json({ error: 'Faucet operator is out of ETH. Please refill the operator wallet.' })
        return
      }
      const txHash = await wc.sendTransaction({ to: user, value: TOP_UP })
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      steps.push({ label: 'Sent 0.002 test ETH', txHash })
    } else {
      steps.push({ label: 'ETH balance sufficient — no top-up needed', skipped: true })
    }

    // 2. Mint test settlement tokens (MockUSDC, MockUSDT and the pool's mock USDG). The faucet mints
    //    to the operator, which then transfers to the user.
    await mintAndTransfer(addresses.mockUsdc, user, steps, 'mUSDC', wc)
    await mintAndTransfer(addresses.mockUsdt, user, steps, 'mUSDT', wc)
    await mintAndTransfer(addresses.mockUsdg, user, steps, 'mUSDG', wc)

    // 3. Ensure the wallet is a verified ERC-3643 holder (idempotent).
    const { steps: idSteps, isVerified } = await ensureVerified(user)
    steps.push(...idSteps)

    res.status(200).json({ address: user, steps, isVerified })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Faucet failed') })
  }
}

async function mintAndTransfer(
  token: Address,
  user: Address,
  steps: IdentityStep[],
  symbol: string,
  wc: ReturnType<typeof walletClient>,
): Promise<void> {
  if (token === ZERO) {
    steps.push({ label: `${symbol} not configured`, skipped: true })
    return
  }
  const before = (await publicClient.readContract({
    address: token,
    abi: mockTokenAbi,
    functionName: 'balanceOf',
    args: [user],
  })) as bigint
  if (before > 0n) {
    steps.push({ label: `${symbol} already funded`, skipped: true })
    return
  }
  // faucetMax mints the standard demo allowance to the operator.
  const faucetHash = (await wc.writeContract({
    address: token,
    abi: mockTokenAbi,
    functionName: 'faucetMax',
  })) as Hex
  await publicClient.waitForTransactionReceipt({ hash: faucetHash })
  // Send exactly what faucetMax just minted. The operator is also the Tawf
  // treasury, so its balance holds real demo funds that must stay put.
  const minted = (await publicClient.readContract({
    address: token,
    abi: mockTokenAbi,
    functionName: 'FAUCET_AMOUNT',
  })) as bigint
  const transferHash = (await wc.writeContract({
    address: token,
    abi: mockTokenAbi,
    functionName: 'transfer',
    args: [user, minted],
  })) as Hex
  await publicClient.waitForTransactionReceipt({ hash: transferHash })
  steps.push({ label: `Minted test ${symbol}`, txHash: transferHash })
}
