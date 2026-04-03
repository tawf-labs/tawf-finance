import { createContext, useContext, useState, type ReactNode } from 'react'

interface WalletModalContextType {
  isOpen: boolean
  openModal: () => void
  closeModal: () => void
}

const WalletModalContext = createContext<WalletModalContextType | undefined>(undefined)

export function WalletModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <WalletModalContext.Provider value={{
      isOpen,
      openModal: () => setIsOpen(true),
      closeModal: () => setIsOpen(false),
    }}>
      {children}
    </WalletModalContext.Provider>
  )
}

export function useWalletModal() {
  const ctx = useContext(WalletModalContext)
  if (!ctx) throw new Error('useWalletModal must be used within WalletModalProvider')
  return ctx
}
