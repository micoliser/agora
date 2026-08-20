'use client'

import Link from 'next/link'
import { useMounted } from '@/hooks/useMounted'
import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { injected } from 'wagmi/connectors'
import { Shield } from 'lucide-react'
import { NotificationDropdown } from './NotificationDropdown'
import { usePathname } from 'next/navigation'

export function Navbar() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { logout } = useAuth()
  const pathname = usePathname()
  const mounted = useMounted()

  return (
    <nav className="fixed top-0 left-0 z-50 w-full px-6 py-6 flex items-center justify-between bg-[#0C061F]/90 backdrop-blur-xl border-b border-white/5">
      <div className="flex-1 md:flex-none">
        <Link href="/" className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Agora Logo" className="w-10 h-10 rounded-full object-cover" />
          <span className="font-heading font-black text-2xl tracking-tight text-white hidden sm:inline-block pt-0.5">Agora</span>
        </Link>
      </div>

      {/* Centered Pill Navigation */}
      <div className="hidden md:flex items-center p-1.5 bg-[#0C061F]/60 backdrop-blur-md border border-white/5 rounded-full text-xs font-semibold uppercase tracking-widest">
        <Link href="/" className={`px-5 py-2.5 rounded-full transition-colors ${pathname === '/' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-white'}`}>
          Home
        </Link>
        <Link href="/how-it-works" className="px-5 py-2.5 rounded-full transition-colors text-muted-foreground hover:text-white">
          How it Works
        </Link>
        <Link href="/communities" className={`px-5 py-2.5 rounded-full transition-colors ${pathname === '/communities' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-white'}`}>
          Hubs
        </Link>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 w-48 justify-end">
        <NotificationDropdown />

        {mounted ? (
          isConnected ? (
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                className="rounded-full bg-[#130E26] border-border hover:bg-[#1C1635] text-foreground font-semibold h-10 px-4"
                onClick={() => { logout(); disconnect(); }}
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
