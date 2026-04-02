import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton as WAMultiButton } from '@solana/wallet-adapter-react-ui';
import { Copy, Check } from 'lucide-react';
import { type FC, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface WalletButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showAddress?: boolean;
}

/**
 * Custom-styled wallet button that uses the wallet adapter's built-in modal
 *
 * This component provides a styled wrapper around the wallet adapter's
 * WalletMultiButton component, which handles the wallet selection modal.
 * When not connected, it shows a "Connect Wallet" button that opens the modal.
 * When connected, it shows the wallet address with copy functionality.
 */
export const WalletMultiButton: FC<WalletButtonProps> = ({
  variant: _variant,
  size = 'md',
  className = '',
  showAddress = true,
}) => {
  const { connected, publicKey, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  // Handle wallet connection through the built-in modal
  if (connected && publicKey && showAddress) {
    const addressStr = publicKey.toString();
    const shortened = `${addressStr.slice(0, 4)}...${addressStr.slice(-4)}`;

    const handleCopy = () => {
      navigator.clipboard.writeText(addressStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size={size}
          onClick={handleCopy}
          className="font-mono text-sm"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              {shortened}
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size={size}
          onClick={() => disconnect()}
          className="text-tawf-muted hover:text-red-600"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className={`wallet-adapter-button-wrapper ${className}`}>
      <WAMultiButton className="wallet-adapter-button-trigger" />
    </div>
  );
};

/**
 * Simple connect button that opens the wallet selection modal
 * Uses the wallet adapter's built-in button with custom styling
 */
export const WalletConnectButton: FC<WalletButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  return <WalletMultiButton variant={variant} size={size} className={className} showAddress={false} />;
};

/**
 * Disconnect button for when wallet is connected
 */
export const WalletDisconnectButton: FC<WalletButtonProps> = ({
  variant = 'ghost',
  size = 'md',
  className = '',
}) => {
  const { disconnect } = useWallet();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => disconnect()}
      className={className}
    >
      Disconnect
    </Button>
  );
};

/**
 * Display wallet address with copy functionality
 */
export const WalletAddressDisplay: FC<WalletButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  className = '',
}) => {
  const { publicKey } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!publicKey) {
    return null;
  }

  const addressStr = publicKey.toString();
  const shortened = `${addressStr.slice(0, 4)}...${addressStr.slice(-4)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(addressStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={`font-mono text-sm ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 mr-2" />
          {shortened}
        </>
      )}
    </Button>
  );
};

export default WalletMultiButton;
