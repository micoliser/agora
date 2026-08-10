'use client'

import Link from 'next/link'
import { useMounted } from '@/hooks/useMounted'
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { injected } from 'wagmi/connectors'
import { formatUnits } from 'viem'
import { Bell, Shield } from 'lucide-react'
import { usePathname } from 'next/navigation'

export function Navbar() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const pathname = usePathname()
  const mounted = useMounted()

  const { data: balance } = useBalance({
    address,
  })

  return (
    <nav className="absolute top-0 z-50 w-full px-6 py-6 flex items-center justify-between">
      <div className="flex-1 md:flex-none">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <span className="font-heading font-black text-xl tracking-tight text-white hidden sm:inline-block">Agora</span>
        </Link>
      </div>

      {/* Centered Pill Navigation */}
      <div className="hidden md:flex items-center p-1.5 bg-[#0C061F]/60 backdrop-blur-md border border-white/5 rounded-full text-xs font-semibold uppercase tracking-widest">
        <Link href="/" className={`px-5 py-2.5 rounded-full transition-colors ${pathname === '/' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-white'}`}>
          Home
        </Link>
        <Link href="/#how-it-works" className="px-5 py-2.5 rounded-full transition-colors text-muted-foreground hover:text-white">
          How it Works
        </Link>
        <Link href="/#hubs" className="px-5 py-2.5 rounded-full transition-colors text-muted-foreground hover:text-white">
          Hubs
        </Link>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 w-48 justify-end">
        <button className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-[#130E26] border border-border hover:bg-[#1C1635] transition-colors text-muted-foreground">
          <Bell className="w-4 h-4" />
        </button>

        {mounted ? (
          isConnected ? (
            <div className="flex items-center gap-3">
              {balance && (
                <Badge variant="secondary" className="hidden xl:flex rounded-full bg-[#130E26] border-border text-foreground">
                  {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)} GEN
                </Badge>
              )}
              <Button 
                variant="outline" 
                size="sm"
                className="rounded-full bg-[#130E26] border-border hover:bg-[#1C1635] text-foreground font-semibold h-10 px-4"
                onClick={() => disconnect()}
              >
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </Button>
            </div>
          ) : (
            <Button 
              onClick={() => connect({ connector: injected() })}
              className="rounded-full bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 shadow-[0_0_20px_rgba(130,80,223,0.3)] transition-all"
            >
              Connect Wallet
            </Button>
          )
        ) : (
          <div className="h-10 w-[140px] bg-muted animate-pulse rounded-full" />
        )}
      </div>
    </nav>
  )
}
