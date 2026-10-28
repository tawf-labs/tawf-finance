import { arbitrumSepolia } from 'viem/chains'
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
import { ensureVerified, hasValidScreeningClaim, issueScreeningClaim, isBlockedWallet, BLOCKED_WALLET_MESSAGE, type IdentityStep } from './_lib/identity.js'

const MIN_USER_ETH = parseEther('0.002')
const TOP_UP = parseEther('0.002')
const MIN_OPERATOR_ETH = parseEther('0.01')

const ZERO = '0x0000000000000000000000000000000000000000'


/**
 * Faucet: fund gas, mint test mUSDC, mUSDT and mUSDG, verify the wallet's ERC-3643
 * identity and issue the testnet TAWF_SCREENED claim (so it can hold both Deposito Pools). No passcode: this is a demo convenience for any connected wallet.
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
    if (isBlockedWallet(user)) {
      res.status(400).json({ error: BLOCKED_WALLET_MESSAGE })
      return
    }
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

    // 4. Testnet self-service screening (topic 2) so the wallet may hold both Deposito Pools.
    //    The claim is identity wide. Skipped when a valid one is already there.
    //    Testnet only: skipped unless the deployment is on Arbitrum Sepolia.
    if (isVerified && addresses.chainId === arbitrumSepolia.id) {
      if (await hasValidScreeningClaim(user, addresses.tawfScreenedTopic)) {
        steps.push({ label: 'Already screened (TAWF_SCREENED claim present)', skipped: true })
      } else {
        const screen = await issueScreeningClaim(user, addresses.tawfScreenedTopic, 'testnet self-service screening')
        steps.push(...screen.steps)
      }
    }

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
  const operator = account().address
  const opBefore = (await publicClient.readContract({
    address: token,
    abi: mockTokenAbi,
    functionName: 'balanceOf',
    args: [operator],
  })) as bigint
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
  // A load-balanced RPC can answer from a node that has not seen the mint yet,
  // and the transfer then simulates against the old (possibly small) balance
  // and reverts. Wait until the mint is visible, and retry the transfer once.
  for (let i = 0; i < 10; i++) {
    const bal = (await publicClient.readContract({
      address: token,
      abi: mockTokenAbi,
      functionName: 'balanceOf',
      args: [operator],
    })) as bigint
    if (bal >= opBefore + minted || bal >= minted) break
    await new Promise((r) => setTimeout(r, 1000))
  }
  const transfer = () =>
    wc.writeContract({
      address: token,
      abi: mockTokenAbi,
      functionName: 'transfer',
      args: [user, minted],
    }) as Promise<Hex>
  let transferHash: Hex
  try {
    transferHash = await transfer()
  } catch {
    await new Promise((r) => setTimeout(r, 3000))
    transferHash = await transfer()
  }
  await publicClient.waitForTransactionReceipt({ hash: transferHash })
  steps.push({ label: `Minted test ${symbol}`, txHash: transferHash })
}
