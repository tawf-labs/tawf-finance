import { useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain, type Connector } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { Wallet, LogOut, Loader2, AlertTriangle, ChevronRight, Smartphone, QrCode, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { shortAddress } from '@/web3/format';
import { CHAIN_ID } from '@/web3/constants';

const isMobile = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const hasInjected = () => typeof window !== 'undefined' && Boolean((window as { ethereum?: unknown }).ethereum);

/** Opens the current page inside the MetaMask app's browser (for a phone without an injected wallet). */
function metaMaskDappLink(): string {
  const { host, pathname, search } = window.location;
  return `https://metamask.app.link/dapp/${host}${pathname}${search}`;
}

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/rejected|denied|cancel/i.test(msg)) return 'Connection cancelled in the wallet.';
  if (/provider not found|no provider|not installed/i.test(msg)) return 'That wallet was not found on this device.';
  if (/already pending/i.test(msg)) return 'A connection request is already open in your wallet.';
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}

interface Option {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  connector: Connector;
}

/** Connect / switch-chain / disconnect button for the EVM investor flow, desktop and mobile. */
export function ConnectButton({ variant = 'primary', size = 'md' }: { variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md' | 'lg' }) {
  // The wallet's real chain. useChainId() only ever returns a configured chain, so it hid a wrong network.
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onWrongChain = isConnected && chainId !== CHAIN_ID;
  const mobile = isMobile();

  const options = useMemo<Option[]>(() => {
    const list: Option[] = [];
    // Wallets announced through EIP-6963 (extensions, in-app browsers), else the plain injected one.
    const announced = connectors.filter((c) => c.type === 'injected' && c.id !== 'injected');
    const injectedFallback = connectors.find((c) => c.id === 'injected');
    for (const c of announced) {
      list.push({ key: c.uid, label: c.name, hint: mobile ? 'Wallet browser' : 'Browser extension', icon: c.icon ? <img src={c.icon} alt="" className="w-6 h-6 rounded" /> : <Globe className="w-6 h-6" />, connector: c });
    }
    if (announced.length === 0 && injectedFallback && hasInjected()) {
      list.push({ key: injectedFallback.uid, label: 'Browser wallet', hint: mobile ? 'Wallet browser' : 'Browser extension', icon: <Globe className="w-6 h-6" />, connector: injectedFallback });
    }
    const hasMetaMaskExtension = announced.some((c) => /metamask/i.test(c.name));
    const mm = connectors.find((c) => c.id === 'metaMaskSDK');
    if (mm && !hasMetaMaskExtension) {
      list.push({ key: mm.uid, label: 'MetaMask', hint: mobile ? 'Opens the MetaMask app' : 'Extension or mobile app (QR)', icon: <Smartphone className="w-6 h-6" />, connector: mm });
    }
    const wc = connectors.find((c) => c.id === 'walletConnect');
    if (wc) {
      list.push({ key: wc.uid, label: 'WalletConnect', hint: mobile ? 'Trust, Rainbow, OKX and 300+ wallets' : 'Scan a QR code with your phone wallet', icon: <QrCode className="w-6 h-6" />, connector: wc });
    }
    const cb = connectors.find((c) => c.id === 'coinbaseWalletSDK');
    if (cb) {
      list.push({ key: cb.uid, label: 'Coinbase Wallet', hint: 'Coinbase Wallet or the Base app', icon: <Wallet className="w-6 h-6" />, connector: cb });
    }
    return list;
  }, [connectors, mobile]);

  const pick = async (o: Option) => {
    setError(null);
    setBusy(o.key);
    try {
      await connectAsync({ connector: o.connector, chainId: arbitrumSepolia.id });
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const onSwitch = () => {
    setError(null);
    switchChain(
      { chainId: arbitrumSepolia.id },
      { onError: () => setError('Your wallet could not switch. Add Arbitrum Sepolia (chain 421614) in the wallet and try again.') },
    );
  };

  if (isConnected) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          {onWrongChain && (
            <Button variant="secondary" size={size} onClick={onSwitch} disabled={switching}>
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              <span className="sm:hidden">Switch network</span>
              <span className="hidden sm:inline">Switch to Arbitrum Sepolia</span>
            </Button>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-tawf-green-10 text-tawf-green text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {shortAddress(address)}
          </span>
          <button
            onClick={() => disconnect()}
            title="Disconnect"
            aria-label="Disconnect wallet"
            className="p-3 rounded-full hover:bg-tawf-green-10 text-tawf-muted hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        {error && <span className="text-xs text-red-600 max-w-xs text-right">{error}</span>}
      </div>
    );
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => { setError(null); setOpen(true); }} disabled={isPending}>
        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
        Connect Wallet
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Connect a wallet" size="sm">
        <div className="space-y-2">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => void pick(o)}
              disabled={busy !== null}
              className="w-full min-h-14 flex items-center gap-3 px-4 py-3 rounded-xl border border-tawf-green-10 hover:border-tawf-green hover:bg-tawf-green-5 text-left transition-colors disabled:opacity-60"
            >
              <span className="text-tawf-green shrink-0">{o.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-tawf-green">{o.label}</span>
                <span className="block text-xs text-tawf-muted">{o.hint}</span>
              </span>
              {busy === o.key ? <Loader2 className="w-4 h-4 animate-spin text-tawf-muted" /> : <ChevronRight className="w-4 h-4 text-tawf-muted" />}
            </button>
          ))}

          {mobile && !hasInjected() && (
            <a
              href={metaMaskDappLink()}
              className="w-full min-h-14 flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-tawf-green-10 hover:border-tawf-green text-left"
            >
              <Smartphone className="w-6 h-6 text-tawf-gold shrink-0" />
              <span className="flex-1">
                <span className="block font-medium text-tawf-green">Open in the MetaMask app</span>
                <span className="block text-xs text-tawf-muted">Loads this page inside MetaMask&apos;s browser, then tap Connect</span>
              </span>
              <ChevronRight className="w-4 h-4 text-tawf-muted" />
            </a>
          )}

          {options.length === 0 && (
            <p className="text-sm text-tawf-muted">No wallet options are available in this browser.</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-tawf-muted pt-1">Testnet: the app runs on Arbitrum Sepolia. Your wallet is asked to switch after connecting.</p>
        </div>
      </Modal>
    </>
  );
}
