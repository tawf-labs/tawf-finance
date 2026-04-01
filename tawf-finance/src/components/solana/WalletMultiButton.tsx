import { useWalletConnection } from '@solana/react-hooks';
import { Wallet, Check, Copy } from 'lucide-react';
import { type FC, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface WalletButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Simple wallet button that triggers the wallet connection modal
 * Uses framework-kit's useWalletConnection hook
 */
export const WalletMultiButton: FC<WalletButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  const { connected, connect, wallet } = useWalletConnection();

  if (connected && wallet?.account?.address) {
    return <WalletConnectButton variant={variant} size={size} className={className} />;
  }

  return (
    <Button variant={variant} size={size} onClick={() => connect('wallet-standard:phantom')} className={className}>
      <Wallet className="w-4 h-4 mr-2" />
      Connect Wallet
    </Button>
  );
};

/**
 * Connected wallet button showing shortened address
 * with copy and disconnect functionality
 */
export const WalletConnectButton: FC<WalletButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  const { wallet, disconnect } = useWalletConnection();
  const [copied, setCopied] = useState(false);

  const address = wallet?.account?.address;

  if (!address) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => disconnect()}
        className={className}
      >
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>
    );
  }

  const addressStr = address.toString();
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
};

export default WalletMultiButton;
