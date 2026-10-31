import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAccount, usePublicClient } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getPendingApprovals, loadPasscode, rejectSafeNonce, type PendingApprovalsResponse, type PendingSafeTx, type SafeDuty } from '@/lib/tokenization';
import { decodeProposal, summarize, type DecodedCall } from '@/web3/safeDecode';
import { checkProposal, deployedSet, seriesTokens, type DeployedSet, type Reader } from '@/web3/safePolicy';
import { TrexComplianceAbi } from '@/web3/tokenizationAbis';
import deployments from '@/web3/tokenization.deployments.json';
import { useContractWrite } from '@/web3/hooks';
import { safeAbi, ZERO_ADDRESS } from '@/web3/safe';
import type { Abi } from 'viem';

const DUTY_LABEL: Record<SafeDuty, string> = {
  governance: 'Governance',
  treasury: 'Treasury',
  minting: 'Minting',
  compliance: 'Compliance',
  guardian: 'Guardian',
};

const STATUS_LABEL = { pending: 'Waiting', ready: 'Ready to execute' } as const;

/** What the panel works out itself for a proposal, never taking the stored hash on trust. */
interface Check {
  decoded: DecodedCall;
  /** Safe.getTransactionHash of the decoded fields, or null when the call could not be decoded. */
  recomputed: `0x${string}` | null;
  /** Our contract and a function of this duty (safePolicy), else the reason it is refused. */
  policy: { ok: boolean; reason: string };
  /** Decodes with a known ABI, passes the duty policy, and the recomputed hash equals the stored one. */
  verified: boolean;
}

/**
 * Proposals queued on the duty Safes. There is no hosted Safe service on Arbitrum Sepolia, so owners approve
 * on chain with their own wallet (Safe.approveHash) and, once the threshold is met, anyone executes with
 * Safe.execTransaction. The list comes from /api/tokenization/safe/pending (our store + Safe.approvedHashes).
 */
export function PendingApprovals({ duties, passcode }: { duties: SafeDuty[]; passcode?: string }) {
  const { address } = useAccount();
  const { write, isPending } = useContractWrite();
  const [data, setData] = useState<PendingApprovalsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [busyHash, setBusyHash] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const [checks, setChecks] = useState<Record<string, Check>>({});

  useEffect(() => {
    let live = true;
    getPendingApprovals(passcode ?? loadPasscode())
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not read the Safes');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [passcode, tick]);

  // Decode every proposal and recompute its hash on chain from the decoded fields.
  useEffect(() => {
    if (!data || !publicClient) return;
    let live = true;
    void (async () => {
      const next: Record<string, Check> = {};
      // Our contracts: deployments.json plus the compliance contract of each series token, read on chain.
      let set: DeployedSet;
      try {
        const compliances = await Promise.all(
          seriesTokens(deployments as Record<string, unknown>).map(
            (token) => publicClient.readContract({ address: token, abi: TrexComplianceAbi, functionName: 'compliance' }) as Promise<`0x${string}`>,
          ),
        );
        set = deployedSet(deployments as Record<string, unknown>, compliances);
      } catch {
        set = deployedSet(deployments as Record<string, unknown>, []);
      }
      for (const p of data.pending) {
        const decoded = decodeProposal(p.to, p.data, p.safe);
        const policy = await checkProposal(p.duty, p.safe, p.to, decoded, set, {
          chain: publicClient as unknown as Reader,
          feeRecipient: data.policy.feeRecipient,
          identityRegistry: data.policy.identityRegistry,
          pairedAmount: (spender) => {
            let best: bigint | null = null;
            for (const q of data.pending) {
              if (q.to.toLowerCase() !== spender.toLowerCase()) continue;
              const dq = decodeProposal(q.to, q.data, q.safe);
              if (!dq.known || !dq.functionName) continue;
              const amount = dq.functionName === 'distribute' || dq.functionName === 'releaseHeldProfit' ? dq.args[2] : dq.functionName === 'settleMaturity' && dq.args.length === 4 ? dq.args[1] : null;
              if (typeof amount === 'bigint' && (best === null || amount > best)) best = amount;
            }
            return best;
          },
        });
        let recomputed: `0x${string}` | null = null;
        if (decoded.reencoded) {
          try {
            recomputed = (await publicClient.readContract({
              address: p.safe,
              abi: safeAbi,
              functionName: 'getTransactionHash',
              args: [p.to, 0n, decoded.reencoded, 0, 0n, 0n, 0n, ZERO_ADDRESS, ZERO_ADDRESS, BigInt(p.nonce)],
            })) as `0x${string}`;
          } catch {
            recomputed = null;
          }
        }
        next[p.safeTxHash] = { decoded, recomputed, policy, verified: policy.ok && decoded.known && recomputed !== null && recomputed.toLowerCase() === p.safeTxHash.toLowerCase() };
      }
      if (live) setChecks(next);
    })();
    return () => {
      live = false;
    };
  }, [data, publicClient]);

  const reject = async (p: PendingSafeTx) => {
    setBusyHash(p.safeTxHash);
    setError(null);
    try {
      await rejectSafeNonce(p.duty, p.nonce, passcode ?? loadPasscode());
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not propose the rejection');
    } finally {
      setBusyHash(null);
    }
  };

  const reload = () => {
    setLoading(true);
    setTick((n) => n + 1);
  };

  const act = async (p: PendingSafeTx, kind: 'approve' | 'execute') => {
    const c = checks[p.safeTxHash];
    // Only a verified proposal can be approved or executed, and it is the RECOMPUTED hash and the re-encoded
    // data that go on chain, not the stored values.
    if (!c || !c.verified || !c.recomputed || !c.decoded.reencoded) {
      setError('This proposal does not match its stored hash. Do not approve it.');
      return;
    }
    setBusyHash(p.safeTxHash);
    setError(null);
    try {
      if (kind === 'approve') {
        await write({ address: p.safe, abi: safeAbi as unknown as Abi, functionName: 'approveHash', args: [c.recomputed] });
      } else {
        await write({
          address: p.safe,
          abi: safeAbi as unknown as Abi,
          functionName: 'execTransaction',
          args: [p.to, 0n, c.decoded.reencoded, 0, 0n, 0n, 0n, ZERO_ADDRESS, ZERO_ADDRESS, p.signatures],
        });
      }
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${kind} failed`);
    } finally {
      setBusyHash(null);
    }
  };

  const configured = data ? duties.filter((d) => data.safes[d]?.address) : [];
  const rows = data ? data.pending.filter((p) => duties.includes(p.duty)) : [];
  const me = address?.toLowerCase();

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-tawf-gray-900">Pending approvals</h3>
          <p className="text-xs text-tawf-gray-500">
            {duties.map((d) => DUTY_LABEL[d]).join(', ')} Safe{duties.length > 1 ? 's' : ''}. Owners approve with their own wallet, then anyone executes.
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={loading} onClick={reload}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && configured.length === 0 && (
        <p className="text-sm text-tawf-gray-500">
          No Safe is configured for this area yet (set {duties.map((d) => data.safes[d]?.env).join(', ')}).
        </p>
      )}
      {data && configured.length > 0 && rows.length === 0 && <p className="text-sm text-tawf-gray-500">Nothing is waiting for approval.</p>}
      {rows.length > 0 && (
        <ul className="divide-y divide-tawf-green-5">
          {rows.map((p) => {
            const isOwner = !!me && p.owners.some((o) => o.toLowerCase() === me);
            const approved = !!me && p.approvedBy.some((o) => o.toLowerCase() === me);
            const busy = busyHash === p.safeTxHash || isPending;
            const c = checks[p.safeTxHash];
            const mismatch = !!c && !c.verified;
            return (
              <li key={p.safeTxHash} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">{DUTY_LABEL[p.duty]}</Badge>
                      <span className="text-sm font-medium text-tawf-gray-900 truncate">{c ? summarize(c.decoded) : String(p.description || p.method || 'Contract call')}</span>
                    </div>
                    <p className="text-xs text-tawf-gray-500 mt-1">
                      Nonce {p.nonce}, {p.approvedBy.length} of {p.required} approved, {STATUS_LABEL[p.status]}
                      {p.status === 'pending' && p.nonce > p.safeNonce ? ` (queued behind nonce ${p.safeNonce})` : ''}
                      {p.competing > 0 ? `, competing with ${p.competing} other proposal${p.competing > 1 ? 's' : ''} for nonce ${p.nonce}, the first to execute wins` : ''}
                    </p>
                    {c && (
                      <div className="mt-1 text-xs text-tawf-gray-700 font-mono break-all">
                        <p>to {p.to}, value 0</p>
                        {c.decoded.lines.map((l, i) => (
                          <p key={i}>arg {i + 1}: {l}</p>
                        ))}
                        {c.decoded.inner && c.decoded.inner.lines.map((l, i) => (
                          <p key={`i${i}`}>{c.decoded.inner?.functionName} arg {i + 1}: {l}</p>
                        ))}
                      </div>
                    )}
                    {mismatch && (
                      <p className="mt-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                        {!c.decoded.known
                          ? 'This call cannot be decoded with a known contract ABI, so it cannot be verified. Do not approve.'
                          : !c.policy.ok
                            ? `NOT ALLOWED for the ${DUTY_LABEL[p.duty]} Safe: ${c.policy.reason} Do not approve.`
                            : 'MISMATCH: the stored hash is not the hash of the call shown above. Do not approve.'}
                      </p>
                    )}
                    {!c && <p className="mt-1 text-xs text-tawf-gray-500">Checking the hash on chain...</p>}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {c?.verified && isOwner && !approved && (
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(p, 'approve')}>
                        Approve
                      </Button>
                    )}
                    {c?.verified && p.status === 'ready' && (
                      <Button size="sm" disabled={busy || !address} onClick={() => void act(p, 'execute')}>
                        Execute
                      </Button>
                    )}
                    {c && !c.decoded.rejection && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void reject(p)}>
                        Reject
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
