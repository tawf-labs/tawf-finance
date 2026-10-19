// One Vercel function for the whole tokenization API (the Hobby plan caps a
// deployment at 12 functions). Handlers live in api/_tokenization/, which
// Vercel does not deploy on its own because of the leading underscore.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import h0 from '../_tokenization/bprs/declare-distribution.js'
import h1 from '../_tokenization/bprs/declare-maturity.js'
import h2 from '../_tokenization/bprs/sukuk-status.js'
import h3 from '../_tokenization/bprs/sync.js'
import h4 from '../_tokenization/bprs/tawf-credit-profit.js'
import h5 from '../_tokenization/bprs/tawf-deposit.js'
import h6 from '../_tokenization/bprs/tawf-mature.js'
import h7 from '../_tokenization/bprs/tawf-status.js'
import h8 from '../_tokenization/faucet.js'
import h9 from '../_tokenization/fx.js'
import h10 from '../_tokenization/issuer/sukuk/close.js'
import h11 from '../_tokenization/issuer/sukuk/distribute.js'
import h12 from '../_tokenization/issuer/sukuk/open.js'
import h13 from '../_tokenization/issuer/sukuk/settle.js'
import h14 from '../_tokenization/issuer/update-reserve.js'
import h15 from '../_tokenization/proof.js'
import h16 from '../_tokenization/reserve.js'
import h17 from '../_tokenization/series/allocate.js'
import h18 from '../_tokenization/series/approve-treasury.js'
import h19 from '../_tokenization/series/distribute-profit.js'
import h20 from '../_tokenization/series/post-rate.js'
import h21 from '../_tokenization/series/sandbox.js'
import h22 from '../_tokenization/series/screen.js'
import h23 from '../_tokenization/series/settle-maturity.js'
import h24 from '../_tokenization/series/status.js'

type Handler = (req: VercelRequest, res: VercelResponse) => unknown

const routes: Record<string, Handler> = {
  'bprs/declare-distribution': h0,
  'bprs/declare-maturity': h1,
  'bprs/sukuk-status': h2,
  'bprs/sync': h3,
  'bprs/tawf-credit-profit': h4,
  'bprs/tawf-deposit': h5,
  'bprs/tawf-mature': h6,
  'bprs/tawf-status': h7,
  'faucet': h8,
  'fx': h9,
  'issuer/sukuk/close': h10,
  'issuer/sukuk/distribute': h11,
  'issuer/sukuk/open': h12,
  'issuer/sukuk/settle': h13,
  'issuer/update-reserve': h14,
  'proof': h15,
  'reserve': h16,
  'series/allocate': h17,
  'series/approve-treasury': h18,
  'series/distribute-profit': h19,
  'series/post-rate': h20,
  'series/sandbox': h21,
  'series/screen': h22,
  'series/settle-maturity': h23,
  'series/status': h24,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Read the route from the URL: outside Next.js the catch-all segment is not
  // reliably passed in req.query.
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  const fromUrl = pathname.replace(/^\/api\/tokenization\/?/, '')
  const raw = req.query.path
  const fromQuery = Array.isArray(raw) ? raw.join('/') : (raw ?? '')
  const route = (fromUrl || fromQuery).replace(/\/+$/, '')
  const target = routes[route]
  if (!target) {
    res.status(404).json({ error: `Unknown tokenization endpoint: ${route || '(none)'}` })
    return
  }
  return target(req, res)
}
