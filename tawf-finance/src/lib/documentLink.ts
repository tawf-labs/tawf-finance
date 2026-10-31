/** The one public gateway ipfs:// links are rewritten to. */
export const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

/**
 * A link for a document URI, or null. Only a VERIFIED claim gets a link, and only https: URLs or ipfs:// (rewritten to
 * the fixed gateway) qualify. Anything else (javascript:, data:, http:, a relative path, garbage) is shown as plain
 * text, never as an href, because the URI is data from a claim and an unverified one can say anything.
 */
export function safeDocumentLink(uri: string, verified: boolean): string | null {
  if (!verified) return null;
  const trimmed = uri.trim();
  if (/^ipfs:\/\//i.test(trimmed)) {
    const path = trimmed.slice('ipfs://'.length).replace(/^ipfs\//i, '');
    // A CID, optionally followed by a path: letters and digits first, no scheme, no dot-dot, no credentials.
    return /^[A-Za-z0-9]{10,}(\/[A-Za-z0-9._~%-]+)*$/.test(path) && !path.includes('..') ? IPFS_GATEWAY + path : null;
  }
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:' && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}
