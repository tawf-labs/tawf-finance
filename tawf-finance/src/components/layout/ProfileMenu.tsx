import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { Copy, ExternalLink, LogOut, Settings, Wallet } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { explorerAddressUrl } from '@/web3/constants';
import { shortAddress } from '@/web3/format';

/** Avatar menu: settings, the connected wallet (copy, explorer, disconnect) and sign out. */
export function ProfileMenu({ name, roleLabel, settingsPath, onSignOut }: {
  name: string;
  roleLabel: string;
  settingsPath: string;
  onSignOut: () => void;
}) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const copy = async () => {
    if (!address) return;
    try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Account menu" className="flex items-center gap-3 rounded-full pr-2 hover:bg-tawf-green-5">
        <Avatar name={name} size="sm" />
        <span className="hidden md:block text-left text-sm">
          <span className="block font-medium text-tawf-ink">{name}</span>
          <span className="block text-xs text-tawf-muted">{roleLabel}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-lift ring-1 ring-line py-2 z-50">
          <Link to={settingsPath} onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-tawf-ink hover:bg-tawf-green-5">
            <Settings className="w-4 h-4" /> Settings
          </Link>
          {address ? (
            <>
              <div className="px-4 py-2 text-xs text-tawf-muted flex items-center gap-2"><Wallet className="w-4 h-4" /> {shortAddress(address)}</div>
              <button onClick={() => void copy()} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-tawf-ink hover:bg-tawf-green-5">
                <Copy className="w-4 h-4" /> {copied ? 'Copied' : 'Copy address'}
              </button>
              <a href={explorerAddressUrl(address)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 text-sm text-tawf-ink hover:bg-tawf-green-5">
                <ExternalLink className="w-4 h-4" /> View on Arbiscan
              </a>
              <button onClick={() => { disconnect(); setOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-tawf-ink hover:bg-tawf-green-5">
                <Wallet className="w-4 h-4" /> Disconnect wallet
              </button>
            </>
          ) : (
            <Link to={settingsPath} onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-tawf-ink hover:bg-tawf-green-5">
              <Wallet className="w-4 h-4" /> Connect a wallet
            </Link>
          )}
          <div className="border-t border-line mt-1 pt-1">
            <button onClick={onSignOut} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
