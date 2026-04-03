import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import bs58 from 'bs58'
import { supabase } from '@/lib/supabase'

const API_KEY_KEY = 'tawf_api_key'
const USER_INFO_KEY = 'tawf_user_info'

export interface WalletUser {
  address: string
  plan?: string
  limit?: number
  usedThisMonth?: number
}

interface AuthContextType {
  user: WalletUser | null
  isAuthenticated: boolean
  isAuthenticating: boolean
  error: string | null
  login: (forceFresh?: boolean) => Promise<void>
  logout: () => void
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const getStoredApiKey = () => localStorage.getItem(API_KEY_KEY)
const getStoredUser = (): WalletUser | null => {
  try {
    const s = localStorage.getItem(USER_INFO_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const walletCtx = useWallet()
  const { publicKey, connected, disconnecting, wallet } = walletCtx
  // Use a ref so login() always gets the latest signMessage without stale closure
  const signMessageRef = useRef(walletCtx.signMessage)
  useEffect(() => { signMessageRef.current = walletCtx.signMessage }, [walletCtx.signMessage])

  const [apiKey, setApiKey] = useState<string | null>(() => getStoredApiKey())
  const [user, setUser] = useState<WalletUser | null>(() => getStoredUser())
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loginInProgressRef = useRef(false)
  const prevConnectedRef = useRef(connected)
  const isInitialLoadRef = useRef(true)

  // Clear auth on explicit disconnect
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      prevConnectedRef.current = connected
      return
    }
    const wasConnected = prevConnectedRef.current
    prevConnectedRef.current = connected
    if (wasConnected && !connected && !disconnecting) {
      setApiKey(null)
      setUser(null)
      setError(null)
      localStorage.removeItem(API_KEY_KEY)
      localStorage.removeItem(USER_INFO_KEY)
    }
  }, [connected, disconnecting])

  // Clear auth if a different wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      const stored = getStoredUser()
      if (stored?.address && stored.address !== publicKey.toBase58()) {
        setApiKey(null)
        setUser(null)
        localStorage.removeItem(API_KEY_KEY)
        localStorage.removeItem(USER_INFO_KEY)
      }
    }
  }, [connected, publicKey])

  const login = useCallback(async (forceFresh = false) => {
    if (!forceFresh) {
      const storedKey = getStoredApiKey()
      if (storedKey) {
        if (!apiKey) {
          setApiKey(storedKey)
          setUser(getStoredUser())
        }
        return
      }
    } else {
      localStorage.removeItem(API_KEY_KEY)
      localStorage.removeItem(USER_INFO_KEY)
    }

    if (apiKey && !forceFresh) return
    if (isAuthenticating || loginInProgressRef.current) return
    if (!publicKey || !connected) return

    loginInProgressRef.current = true
    setIsAuthenticating(true)
    setError(null)

    try {
      const address = publicKey.toBase58()

      const nonceRes = await supabase.functions.invoke('auth-nonce', {
        body: { address, chain: 'solana' },
      })
      if (nonceRes.error) throw new Error(`Nonce error: ${nonceRes.error.message}`)
      const { messageToSign } = nonceRes.data
      if (!messageToSign) throw new Error('No message received from server')

      if (!signMessageRef.current) throw new Error('Your wallet does not support message signing. Please use Phantom or Solflare.')

      const signed = await signMessageRef.current(new TextEncoder().encode(messageToSign))
      const signature = bs58.encode(signed)

      const verifyRes = await supabase.functions.invoke('auth-verify', {
        body: { address, chain: 'solana', signature },
      })
      if (verifyRes.error) throw new Error(verifyRes.error.message)
      const data = verifyRes.data

      const userInfo: WalletUser = {
        address,
        plan: data.plan,
        limit: data.limitPerMonth,
        usedThisMonth: data.usedThisMonth,
      }

      localStorage.setItem(API_KEY_KEY, data.apiKey)
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo))
      if (wallet?.adapter?.name) {
        localStorage.setItem('tawf_wallet_name', wallet.adapter.name)
      }

      setApiKey(data.apiKey)
      setUser(userInfo)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      loginInProgressRef.current = false
      setIsAuthenticating(false)
    }
  }, [publicKey, connected, apiKey, isAuthenticating, wallet])

  const logout = useCallback(() => {
    setApiKey(null)
    setUser(null)
    setError(null)
    localStorage.removeItem(API_KEY_KEY)
    localStorage.removeItem(USER_INFO_KEY)
    localStorage.removeItem('tawf_wallet_name')
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!apiKey,
      isAuthenticating,
      error,
      login,
      logout,
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
