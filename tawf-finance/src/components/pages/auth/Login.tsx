import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useWalletModal } from '@/contexts/WalletModalContext';
import { Button } from '@/components/ui/Button';

export function Login() {
  const { isAuthenticated } = useAuth();
  const { openModal } = useWalletModal();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/investor/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-tawf-sand flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm"
      >
        <img src="/tawftransparent.png" alt="Tawf Finance" className="h-20 w-auto mx-auto mb-6 invert" />
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Welcome to tawf.finance</h1>
        <p className="text-tawf-muted mb-8">Connect your Solana wallet to get started.</p>
        <Button variant="primary" size="lg" onClick={openModal} className="w-full">
          Connect Wallet
        </Button>
      </motion.div>
    </div>
  );
}
