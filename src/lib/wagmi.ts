import { createConfig, http } from 'wagmi'
import { celo, celoAlfajores } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [celo, celoAlfajores],
  connectors: [injected()], // Supports MiniPay and other injected Web3 wallets
  transports: {
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
})
