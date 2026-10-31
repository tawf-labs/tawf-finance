import { useEffect, useState } from 'react';
import { BadgeCheck, CircleDashed, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { getTokenIdentity, hasVerifiedIdentity, safeDocumentLink, type ClaimMeta, type TokenIdentityView } from '@/lib/tokenIdentity';
import { explorerAddressUrl } from '@/web3/constants';

function Tick({ c }: { c: ClaimMeta }) {
  return c.verified ? (
    <span className="inline-flex items-center gap-1 text-xs text-green-700" title="The issuer signature is valid and the issuer is trusted for this claim on chain">
      <BadgeCheck className="w-4 h-4" /> Verified on chain
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-tawf-muted" title={c.reason ?? undefined}>
      <CircleDashed className="w-4 h-4" /> Not verified
    </span>
  );
}

function Row({ label, claim, children }: { label: string; claim: ClaimMeta | null; children: React.ReactNode }) {
  if (!claim) return null;
  // An unverified claim is shown greyed, with the reason, and is never presented as fact.
  return (
    <div className={claim.verified ? '' : 'opacity-60'}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-tawf-muted">{label}</p>
        <Tick c={claim} />
      </div>
      <div className="text-sm text-tawf-green">{children}</div>
      {!claim.verified && claim.reason && <p className="text-xs text-amber-700 mt-0.5">{claim.reason}</p>}
    </div>
  );
}

/**
 * Who is behind a token, read from the token's ONCHAINID claims (topics 10 to 13). The server checks every claim
 * against the TrustedIssuersRegistry and the issuer signature. When the token has no identity, the identity has no
 * claims, or none verify, the card says so instead of showing an empty or misleading card.
 */
export function OriginatorCard({ token, title = 'Originator and partners' }: { token: `0x${string}` | undefined; title?: string }) {
  const [view, setView] = useState<TokenIdentityView | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    let live = true;
    getTokenIdentity(token)
      .then((v) => {
        if (live) setView(v);
      })
      .catch(() => {
        if (live) setFailed(true);
      })
      .finally(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [token]);

  if (!token) return null;
  if (!loaded) return null;
  const verified = hasVerifiedIdentity(view);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-tawf-green">{title}</h3>
        {view?.identity && (
          <a href={explorerAddressUrl(view.identity)} target="_blank" rel="noopener noreferrer" className="text-xs text-tawf-muted hover:underline inline-flex items-center gap-1">
            Token identity <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {failed || !view ? (
        <p className="text-sm text-tawf-muted">The token identity could not be read right now.</p>
      ) : !verified ? (
        <p className="text-sm text-tawf-muted">No verified originator identity.</p>
      ) : (
        <div className="space-y-3">
          <Row label="Asset originator" claim={view.originator}>
            {view.originator && (
              <>
                {view.originator.name}, {view.originator.kind}. Licence {view.originator.licence}.
              </>
            )}
          </Row>
          <Row label="Distribution platform" claim={view.platform}>
            {view.platform && (
              <>
                {view.platform.name}. Registration {view.platform.licence}.
              </>
            )}
          </Row>
          <Row label="Tokenization and verification partner" claim={view.partner}>
            {view.partner && (
              <>
                {view.partner.name} ({view.partner.entity})
              </>
            )}
          </Row>
          <Row label="Offering document" claim={view.docs}>
            {view.docs && (
              <>
                <p className="font-mono text-xs break-all">{view.docs.documentHash}</p>
                {safeDocumentLink(view.docs.documentUri, view.docs.verified) ? (
                  <a href={safeDocumentLink(view.docs.documentUri, view.docs.verified) as string} target="_blank" rel="noopener noreferrer" className="text-xs text-tawf-green hover:underline inline-flex items-center gap-1">
                    Open the document <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-xs text-tawf-muted break-all">Document location: {view.docs.documentUri}</p>
                )}
                {view.identity && (
                  <a href={explorerAddressUrl(view.identity)} target="_blank" rel="noopener noreferrer" className="text-xs text-tawf-muted hover:underline inline-flex items-center gap-1 ml-3">
                    Verify the claim on chain <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </>
            )}
          </Row>
          <p className="text-xs text-tawf-muted">Tawf is the tokenization and verification partner. The originator keeps the assets and the customer relationship.</p>
        </div>
      )}
    </Card>
  );
}
