import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAuth } from '@/contexts/AuthContext'
import { X, Loader2, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface WalletModalProps {
  visible: boolean
  onClose: () => void
}

export function WalletModal({ visible, onClose }: WalletModalProps) {
  const { wallets, select, connect, connected, connecting, publicKey } = useWallet()
  const { isAuthenticating, isAuthenticated, error: authError, login, clearError } = useAuth()
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [status, setStatus] = useState<'select' | 'connecting' | 'authenticating' | 'success'>('select')
  const [waitingForConnection, setWaitingForConnection] = useState(false)
  const connectingRef = useRef(false)

  // Lock body scroll + reset state on open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
      clearError()
      // If wallet already connected but not authenticated, go straight to auth
      if (connected && !isAuthenticated) {
        setStatus('authenticating')
        setSelectedWallet(null)
        setWaitingForConnection(false)
        connectingRef.current = false
        login()
      } else {
        setStatus('select')
        setSelectedWallet(null)
        setWaitingForConnection(false)
        connectingRef.current = false
      }
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle mobile wallet return via visibility change
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null
    const handleVisibilityChange = () => {
      if (!document.hidden && waitingForConnection && status === 'connecting') {
        let pollCount = 0
        pollInterval = setInterval(() => {
          pollCount++
          if (connected) {
            clearInterval(pollInterval!)
            setWaitingForConnection(false)
            connectingRef.current = false
          } else if (pollCount >= 20) {
            clearInterval(pollInterval!)
            setStatus('select')
            setWaitingForConnection(false)
            connectingRef.current = false
          }
        }, 500)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [waitingForConnection, status, connected])

  // Drive status from wallet/auth state
  useEffect(() => {
    if (connecting) {
      setStatus('connecting')
    } else if (authError) {
      setStatus('select')
      setWaitingForConnection(false)
      connectingRef.current = false
    } else if (connected && isAuthenticated) {
      setStatus('success')
      const t = setTimeout(() => {
        onClose()
        setStatus('select')
        setSelectedWallet(null)
      }, 1500)
      return () => clearTimeout(t)
    } else if (connected && isAuthenticating) {
      setStatus('authenticating')
    } else if (connected && !isAuthenticating && !isAuthenticated) {
      if (status === 'connecting' || status === 'authenticating') {
        setStatus('authenticating')
        const t = setTimeout(() => {
          if (connected && !isAuthenticated && !isAuthenticating) {
            login()
          }
        }, 300)
        return () => clearTimeout(t)
      }
    }
  }, [connecting, connected, isAuthenticating, isAuthenticated, authError, onClose, status, login])

  const handleWalletClick = async (wallet: typeof wallets[number]) => {
    if (connectingRef.current) return

    const isTWA = document.referrer.includes('android-app://') ||
      window.matchMedia('(display-mode: standalone)').matches
    const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent) && !isTWA

    if (isMobileBrowser) {
      const uniqueUrl = `${window.location.href}${window.location.href.includes('?') ? '&' : '?'}_t=${Date.now()}`
      let walletUrl = ''
      if (wallet.adapter.name === 'Phantom') {
        walletUrl = `https://phantom.app/ul/browse/${encodeURIComponent(uniqueUrl)}?ref=tawf`
      } else if (wallet.adapter.name === 'Solflare') {
        walletUrl = `https://solflare.com/ul/browse/${encodeURIComponent(uniqueUrl)}?ref=tawf`
      }
      if (walletUrl) { window.location.href = walletUrl; return }
    }

    try {
      connectingRef.current = true
      setSelectedWallet(wallet.adapter.name)
      setStatus('connecting')
      setWaitingForConnection(true)
      select(wallet.adapter.name)
      await new Promise(r => setTimeout(r, 100))
      await connect()
      setWaitingForConnection(false)
      connectingRef.current = false
      // Explicitly drive to authenticating — don't rely solely on the effect
      setStatus('authenticating')
    } catch {
      setStatus('select')
      setWaitingForConnection(false)
      connectingRef.current = false
    }
  }

  const handleClose = () => {
    if (status === 'connecting' || status === 'authenticating') return
    onClose()
    setStatus('select')
    setSelectedWallet(null)
  }

  const visibleWallets = wallets
    .filter(w => w.readyState === 'Installed' || w.readyState === 'Loadable')
    .filter((w, i, arr) => arr.findIndex(x => x.adapter.name === w.adapter.name) === i)

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={handleClose}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', padding: '1rem',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-tawf-sand rounded-2xl shadow-2xl"
            style={{ margin: 'auto' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-tawf-green/10">
              <h2 className="text-xl font-semibold text-tawf-ink font-serif">
                {status === 'select' && 'Connect Wallet'}
                {status === 'connecting' && 'Connecting...'}
                {status === 'authenticating' && 'Authenticating...'}
                {status === 'success' && 'Connected!'}
              </h2>
              <button
                onClick={handleClose}
                disabled={status === 'connecting' || status === 'authenticating'}
                className={`p-2 rounded-lg transition-colors ${
                  status === 'connecting' || status === 'authenticating'
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-tawf-green/10'
                }`}
              >
                <X size={20} className="text-tawf-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {status === 'select' && (
                <div className="space-y-3">
                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                      {authError}
                    </div>
                  )}
                  {visibleWallets.length === 0 && (
                    <p className="text-center text-tawf-muted py-4">
                      No wallets detected. Install Phantom or Solflare to continue.
                    </p>
                  )}
                  {visibleWallets.map(wallet => (
                    <button
                      key={wallet.adapter.name}
                      onClick={() => handleWalletClick(wallet)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-tawf-green/10 hover:border-tawf-green transition-all hover:shadow-md"
                    >
                      <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="w-10 h-10 rounded-lg" />
                      <span className="font-medium text-tawf-ink">{wallet.adapter.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {(status === 'connecting' || status === 'authenticating') && (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <Loader2 size={48} className="animate-spin text-tawf-green" />
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium text-tawf-ink">
                      {status === 'connecting' ? `Connecting to ${selectedWallet}...` : 'Waiting for signature...'}
                    </p>
                    <p className="text-sm text-tawf-muted">
                      {status === 'connecting' ? 'Approve the connection in your wallet' : 'Please sign the message in your wallet'}
                    </p>
                    {/Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent) && (
                      <div className="mt-4 p-4 bg-tawf-green/5 rounded-lg border border-tawf-green/20">
                        <p className="text-xs text-tawf-muted">
                          After approving, tap <strong>back</strong> or <strong>close the app</strong> to return here.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {status === 'success' && (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <CheckCircle2 size={48} className="text-tawf-green" />
                  <div className="text-center">
                    <p className="text-lg font-medium text-tawf-ink">Successfully Connected!</p>
                    <p className="text-sm text-tawf-muted mt-2">
                      {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {status === 'select' && (
              <div className="px-6 pb-6">
                <p className="text-xs text-center text-tawf-muted">
                  By connecting, you agree to our Terms of Service
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default WalletModal
