// Buffer polyfill for Solana packages
// This file must be imported BEFORE any Solana-related imports
import { Buffer } from 'buffer'

// Polyfill Buffer for all contexts
if (typeof window === 'undefined') {
  // Node.js / SSR context
  ;(global as any).Buffer = Buffer
} else {
  // Browser context - set on both window and globalThis
  ;(window as any).Buffer = Buffer
  ;(globalThis as any).Buffer = Buffer
}

export {}
