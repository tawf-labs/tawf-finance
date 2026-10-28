import { http, createConfig, type CreateConnectorFn } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask, walletConnect } from 'wagmi/connectors';
import { RPC_URL } from './constants';

/** Reown (WalletConnect) Cloud project id. Public, set per environment. */
export const WALLETCONNECT_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ?? '';

const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.tawf.finance';
const metadata = {
  name: 'Tawf Finance',
  description: 'Tawf Deposito Pools and sharia crowdfunding on Arbitrum',
  url: appUrl,
  icons: [`${appUrl}/tawftransparent.png`],
};

/**
 * Skip a connector's eager setup. wagmi runs every connector's setup() when the
 * config is created, and the MetaMask and WalletConnect setups download their
 * SDKs (about 900 kB) on every page load. Without it they load on connect().
 */
function lazy(fn: CreateConnectorFn): CreateConnectorFn {
  return (params) => ({ ...fn(params), setup: undefined });
}

/**
 * Wagmi client.
 * - injected: browser extensions (MetaMask, Rabby) and wallet in-app browsers.
 * - metaMask: the MetaMask app on a phone (deep link), the extension on desktop.
 * - walletConnect: Trust, Rainbow, OKX and other mobile wallets, a QR code on
 *   desktop. Only when VITE_WALLETCONNECT_PROJECT_ID is set.
 * - coinbaseWallet: Coinbase Wallet and the Base app.
 */
const connectors: CreateConnectorFn[] = [
  injected(),
  lazy(metaMask({ dappMetadata: { name: metadata.name, url: appUrl } })),
  lazy(coinbaseWallet({ appName: metadata.name, appLogoUrl: metadata.icons[0] })),
];
if (WALLETCONNECT_PROJECT_ID) {
  connectors.splice(2, 0, lazy(walletConnect({ projectId: WALLETCONNECT_PROJECT_ID, metadata, showQrModal: true })));
}

export const config = createConfig({
  chains: [arbitrumSepolia],
  connectors,
  transports: {
    [arbitrumSepolia.id]: http(RPC_URL),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
