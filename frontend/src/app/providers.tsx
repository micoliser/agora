'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { defineChain } from 'viem'
import { injected } from 'wagmi/connectors'

// GenLayer Testnet or Simulator
export const genlayerTestnet = defineChain({
  id: 1, // Will need actual GenLayer chain id. For now using 1 to bypass strict type errors.
  name: 'GenLayer Studionet',
  nativeCurrency: {
    decimals: 18,
    name: 'GEN',
    symbol: 'GEN',
  },
  rpcUrls: {
    default: {
      http: ['https://studio.genlayer.com/api'], // Using studionet API
    },
    public: {
      http: ['https://studio.genlayer.com/api'],
    },
  },
})

export const config = createConfig({
  chains: [genlayerTestnet],
  connectors: [injected()],
  transports: {
    [genlayerTestnet.id]: http(),
  },
})

import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
