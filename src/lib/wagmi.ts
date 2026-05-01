import { createConfig, http } from 'wagmi'
import { celo, celoAlfajores } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '151590f77ea5a17de506eb6edfc34cbf' // Default fallback ID for testing

export const config = createConfig({
  chains: [celo, celoAlfajores],
  connectors: [
    injected(), 
    walletConnect({ projectId, showQrModal: true })
  ],
  transports: {
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
})
