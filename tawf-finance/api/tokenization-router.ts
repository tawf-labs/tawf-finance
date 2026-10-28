// One Vercel function for the whole tokenization API (the Hobby plan caps a
// deployment at 12 functions). Handlers live in api/_tokenization/, which
// Vercel does not deploy on its own because of the leading underscore.
// vercel.json rewrites /api/tokenization/* to this function: a file-based
// catch-all only matched a single path segment outside Next.js.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import h3 from './_tokenization/bprs/sync.js'
import h4 from './_tokenization/bprs/tawf-credit-profit.js'
import h5 from './_tokenization/bprs/tawf-deposit.js'
import h6 from './_tokenization/bprs/tawf-mature.js'
import h7 from './_tokenization/bprs/tawf-status.js'
import h8 from './_tokenization/faucet.js'
import h9 from './_tokenization/fx.js'
import h15 from './_tokenization/proof.js'
import h16 from './_tokenization/reserve.js'
import h17 from './_tokenization/series/allocate.js'
import h18 from './_tokenization/series/approve-treasury.js'
import h19 from './_tokenization/series/distribute-profit.js'
import h20 from './_tokenization/series/post-rate.js'
import h21 from './_tokenization/series/sandbox.js'
import h22 from './_tokenization/series/screen.js'
import h23 from './_tokenization/series/settle-maturity.js'
import h24 from './_tokenization/series/status.js'
import h27 from './_tokenization/tawf-share.js'
import h35 from './_tokenization/cron/post-rates.js'
import h36 from './_tokenization/qn/stream.js'
import h37 from './_tokenization/qn/alert.js'
import h28 from './_tokenization/series/add-stablecoin.js'
import h29 from './_tokenization/admin/handover-operator.js'
import h30 from './_tokenization/scf/profile.js'
import h31 from './_tokenization/scf/status.js'
import h32 from './_tokenization/scf/admin.js'
import h33 from './_tokenization/pool/admin.js'
import h34 from './_tokenization/activity.js'

type Handler = (req: VercelRequest, res: VercelResponse) => unknown

const routes: Record<string, Handler> = {
  'bprs/sync': h3,
  'bprs/tawf-credit-profit': h4,
  'bprs/tawf-deposit': h5,
  'bprs/tawf-mature': h6,
  'bprs/tawf-status': h7,
  'faucet': h8,
  'fx': h9,
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
  'tawf-share': h27,
  'series/add-stablecoin': h28,
  'admin/handover-operator': h29,
  'scf/profile': h30,
  'scf/status': h31,
  'scf/admin': h32,
  'pool/admin': h33,
  'activity': h34,
  'qn/stream': h36,
  'qn/alert': h37,
  'cron/post-rates': h35,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // vercel.json rewrites /api/tokenization/<route> here as ?route=<route>.
  // Locally (and if the rewrite is ever bypassed) fall back to the URL path.
  const fromQuery = req.query.route
  const queryRoute = Array.isArray(fromQuery) ? fromQuery.join('/') : (fromQuery ?? '')
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  const fromUrl = pathname.replace(/^\/api\/tokenization\/?/, '')
  const route = (queryRoute || fromUrl).replace(/^\/+|\/+$/g, '')
  const target = routes[route]
  if (!target) {
    res.status(404).json({ error: `Unknown tokenization endpoint: ${route || '(none)'}` })
    return
  }
  return target(req, res)
}
