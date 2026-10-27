import { useEffect, useState } from 'react';
import { getJson } from '@/lib/tokenization';

type TawfShare = { nisbahBps: number; investorsPercent: number; tawfPercent: number };

/**
 * Upfront disclosure of Tawf's mudharabah profit share (nisbah), read from the
 * contract. Shown before an investor commits, so the ratio is known (no gharar).
 */
export function NisbahNotice({ product, extra }: { product: 'series' | 'pool'; extra?: string }) {
  const [share, setShare] = useState<TawfShare | null>(null);
  useEffect(() => {
    getJson<TawfShare>(`tawf-share?product=${product}`).then(setShare).catch(() => setShare(null));
  }, [product]);
  if (!share) return null;
  return (
    <div className="rounded-2xl border border-tawf-green-10 bg-white p-4 text-sm text-tawf-muted">
      <span className="font-medium text-tawf-green">Profit sharing (nisbah): </span>
      {share.nisbahBps === 0 ? (
        <>holders receive 100% of the profit; Tawf takes no share on this pool.</>
      ) : (
        <>
          holders {share.investorsPercent}% / Tawf {share.tawfPercent}% of each period&apos;s profit, fixed before
          the sale opened. Tawf earns nothing when there is no profit and never takes principal.
        </>
      )}
      {extra && <> {extra}</>}
    </div>
  );
}
