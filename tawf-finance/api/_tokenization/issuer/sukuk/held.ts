import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address, type Hex } from 'viem'
import {
  publicClient,
  walletClient,
  account,
  addresses,
  isConfigured,
  requirePasscode,
  fetchLeafProof,
  readableError,
  sukukTarget,
  ledgerClient,
  sukukLedgerAddress,
} from '../../_lib/operator.js'
import { sukukDistributorAbi, sukukLedgerAbi, mockTokenAbi } from '../../_lib/abis.js'

const FLAG_STATE = ['None', 'Held', 'Closed'] as const

/**
 * Profit held at a Shariah-flagged sukuk maturity, parent-chain side.
 *
 *   GET  /api/tokenization/issuer/sukuk/held?sukuk=1|2        status (public)
 *   POST /api/tokenization/issuer/sukuk/held  (passcode)      { sukuk?, action, ... }
 *     action "release"         { amount }       fund the next board release (proven on the ledger)
 *     action "set-destination" { destination }  record the board-approved sweep destination
 *     action "sweep"                            sweep unclaimed profit after the claim window
 *     action "claim-window"    { seconds }      set how long holders can claim after a release
 *
 * Holders claim their own share from the app (claimProfit is investor-callable).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  const target = sukukTarget(req)
  try {
    if (req.method === 'GET') {
      res.status(200).json(await heldStatus(target.distributor, target.sukukId, target.which))
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    if (!requirePasscode(req, res)) return

    const action = String(req.body?.action ?? '')
    const wc = walletClient()
    const read = (functionName: string, args: unknown[] = []) =>
      publicClient.readContract({ address: target.distributor, abi: sukukDistributorAbi, functionName: functionName as never, args: args as never })

    if (action === 'release') {
      const base = BigInt(Math.round(Number(req.body?.amount ?? 0) * 1e6))
      if (base <= 0n) {
        res.status(400).json({ error: 'amount (USDC) must be positive.' })
        return
      }
      const index = Number((await read('heldReleases')) as number) + 1
      const proof = await fetchLeafProof('tawf.sukuk.profit-resolution', target.sukukId, base, BigInt(index))
      if (!proof) {
        res.status(409).json({ error: `No anchored board release #${index} of this amount yet. Release it in the BPRS tab, or wait a minute for it to be anchored.` })
        return
      }
      // The operator funds the release as the issuer (demo).
      const faucetHash = (await wc.writeContract({ address: addresses.mockUsdc, abi: mockTokenAbi, functionName: 'faucet', args: [base] })) as Hex
      await publicClient.waitForTransactionReceipt({ hash: faucetHash })
      const { request } = await publicClient.simulateContract({
        account: account(),
        address: addresses.mockUsdc,
        abi: [{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }],
        functionName: 'approve',
        args: [target.distributor, base],
      })
      await publicClient.waitForTransactionReceipt({ hash: (await wc.writeContract(request)) as Hex })
      const txHash = (await wc.writeContract({
        address: target.distributor,
        abi: sukukDistributorAbi,
        functionName: 'releaseHeldProfit',
        args: [index, base, BigInt(proof.epoch), proof.proof],
      })) as Hex
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      res.status(200).json({ txHash, index, amount: base.toString(), epoch: proof.epoch })
      return
    }

    if (action === 'set-destination') {
      const dest = String(req.body?.destination ?? '')
      if (!isAddress(dest)) {
        res.status(400).json({ error: 'A valid destination address is required.' })
        return
      }
      const destination = getAddress(dest) as Address
      const proof = await fetchLeafProof('tawf.sukuk.sweep-destination', target.sukukId, BigInt(destination), 0n)
      if (!proof) {
        res.status(409).json({ error: 'The Shariah board has not approved this destination on the ledger yet (or it is not anchored yet).' })
        return
      }
      const txHash = (await wc.writeContract({
        address: target.distributor,
        abi: sukukDistributorAbi,
        functionName: 'setSweepDestination',
        args: [destination, BigInt(proof.epoch), proof.proof],
      })) as Hex
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      res.status(200).json({ txHash, destination })
      return
    }

    if (action === 'sweep') {
      const txHash = (await wc.writeContract({ address: target.distributor, abi: sukukDistributorAbi, functionName: 'sweepUnclaimed' })) as Hex
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      res.status(200).json({ txHash })
      return
    }

    if (action === 'claim-window') {
      const seconds = BigInt(Math.round(Number(req.body?.seconds ?? 0)))
      if (seconds <= 0n) {
        res.status(400).json({ error: 'seconds must be positive.' })
        return
      }
      const txHash = (await wc.writeContract({ address: target.distributor, abi: sukukDistributorAbi, functionName: 'setClaimWindow', args: [seconds] })) as Hex
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      res.status(200).json({ txHash, seconds: seconds.toString() })
      return
    }

    res.status(400).json({ error: 'action must be release, set-destination, sweep or claim-window.' })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}

async function heldStatus(distributor: Address, sukukId: Hex, which: 1 | 2) {
  const views = [
    'status', 'totalUnitsAtMaturity', 'heldReleases', 'totalHeldReleased', 'totalHeldClaimed',
    'totalHeldSwept', 'heldBalance', 'lastReleaseAt', 'claimWindow', 'sweepDestination',
  ] as const
  const results = await publicClient.multicall({
    contracts: views.map((functionName) => ({ address: distributor, abi: sukukDistributorAbi, functionName })),
    allowFailure: true,
  })
  const v = Object.fromEntries(views.map((name, i) => [name, results[i].result])) as Record<string, unknown>

  let flag: Record<string, string | number> | null = null
  const ledger = sukukLedgerAddress()
  if (ledger) {
    try {
      const f = (await ledgerClient().readContract({ address: ledger, abi: sukukLedgerAbi, functionName: 'shariahFlagOf', args: [sukukId] })) as {
        state: number; heldAmount: bigint; undeclaredPeriods: number; releases: number; released: bigint; sweepDestination: Address
      }
      flag = {
        state: FLAG_STATE[f.state] ?? String(f.state),
        heldAmount: f.heldAmount.toString(),
        undeclaredPeriods: f.undeclaredPeriods,
        releases: f.releases,
        released: f.released.toString(),
        sweepDestination: f.sweepDestination,
      }
    } catch {
      flag = null // the ledger is unreachable: the parent-chain figures still stand
    }
  }

  const str = (x: unknown) => (typeof x === 'bigint' ? x.toString() : x ?? null)
  const lastReleaseAt = Number((v.lastReleaseAt as bigint | undefined) ?? 0n)
  const claimWindow = Number((v.claimWindow as bigint | undefined) ?? 0n)
  return {
    sukuk: which,
    sukukId,
    distributor,
    status: Number(v.status ?? 0),
    totalUnitsAtMaturity: str(v.totalUnitsAtMaturity),
    releases: Number(v.heldReleases ?? 0),
    released: str(v.totalHeldReleased),
    claimed: str(v.totalHeldClaimed),
    swept: str(v.totalHeldSwept),
    heldBalance: str(v.heldBalance),
    lastReleaseAt,
    claimWindow,
    sweepOpensAt: lastReleaseAt ? lastReleaseAt + claimWindow : null,
    sweepDestination: v.sweepDestination ?? null,
    ledgerFlag: flag,
  }
}
