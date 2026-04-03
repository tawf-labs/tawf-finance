import { useWallet } from '@solana/wallet-adapter-react'
import { useAuth } from '@/contexts/AuthContext'
import { useWalletModal } from '@/contexts/WalletModalContext'

interface WalletButtonProps {
  className?: string
  style?: React.CSSProperties
}

export function WalletButton({ className, style }: WalletButtonProps) {
  const { connected, disconnect, publicKey, wallet } = useWallet()
  const { isAuthenticated } = useAuth()
  const { openModal } = useWalletModal()

  const handleClick = () => {
    if (connected && isAuthenticated) {
      disconnect()
    } else {
      openModal()
    }
  }

  const getButtonText = () => {
    if (connected && isAuthenticated && publicKey) {
      const addr = publicKey.toBase58()
      return `${addr.slice(0, 4)}...${addr.slice(-4)}`
    }
    if (connected && !isAuthenticated) return 'Authenticating...'
    return 'Get Started'
  }

  const icon = connected && wallet?.adapter?.icon ? wallet.adapter.icon : null

  return (
    <button onClick={handleClick} style={style} className={`flex items-center gap-2 ${className ?? ''}`}>
      {icon && <img src={icon} alt="Wallet" className="w-5 h-5 rounded" />}
      {getButtonText()}
    </button>
  )
}

export default WalletButton
