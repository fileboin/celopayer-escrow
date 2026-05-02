import { createConfig, http } from 'wagmi'
import { celo, celoAlfajores } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '151590f77ea5a17de506eb6edfc34cbf' // Default fallback ID for testing

export const config = createConfig({
  chains: [celo, celoAlfajores],
  connectors: [
    injected({ 
      target: 'metaMask', // MetaMask
    }),
    injected({ 
      target: 'minipay', // MiniPay wallet
    }),
    injected({ 
      target: 'valor', // Valor wallet
    }),
    walletConnect({ 
      projectId, 
      showQrModal: false, // CRITICAL FIX: Disable QR modal on mobile - user will handle connection
    })
  ],
  transports: {
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
})

// Helper to detect if we're on mobile with MiniPay
export const isMiniPayAvailable = () => {
  if (typeof window === 'undefined') return false
  return !!(window as any).ethereum && (window as any).ethereum.isMiniPay === true
}

// Helper to detect if we're on a mobile device
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}
