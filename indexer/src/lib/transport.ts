import { custom, http, type Transport } from 'viem'

// QuickNode's Discover plan caps eth_getLogs to 5 blocks, the public Arbitrum Sepolia RPC does not.
// So eth_getLogs over a wide range goes to the public RPC (backfill), and everything else, including the
// narrow log queries of the live head, goes to QuickNode. Each side falls back to the other on error.
const QUICKNODE_LOG_CAP = 5

type Req = { method: string; params?: unknown }

function logSpan(params: unknown): number | null {
  const f = Array.isArray(params) ? (params[0] as { fromBlock?: string; toBlock?: string; blockHash?: string } | undefined) : undefined
  if (!f) return null
  if (f.blockHash) return 1
  if (!f.fromBlock || !f.toBlock || !f.fromBlock.startsWith('0x') || !f.toBlock.startsWith('0x')) return null
  return Number(BigInt(f.toBlock) - BigInt(f.fromBlock)) + 1
}

export function splitTransport(quicknodeUrl: string | undefined, publicUrl: string): Transport {
  const pub = http(publicUrl, { retryCount: 2 })
  if (!quicknodeUrl) return pub
  const qn = http(quicknodeUrl, { retryCount: 2 })
  return ({ chain, retryCount, timeout }) => {
    const pubT = pub({ chain, retryCount, timeout })
    const qnT = qn({ chain, retryCount, timeout })
    return custom({
      async request(req: Req) {
        const span = req.method === 'eth_getLogs' ? logSpan(req.params) : 0
        const wide = req.method === 'eth_getLogs' && (span === null || span > QUICKNODE_LOG_CAP)
        const [first, second] = wide ? [pubT, qnT] : [qnT, pubT]
        try {
          return await first.request(req as never)
        } catch (err) {
          // A wide log query must never fall back to QuickNode, it would be refused by the cap.
          if (wide) throw err
          return await second.request(req as never)
        }
      },
    })({ chain, retryCount, timeout })
  }
}
