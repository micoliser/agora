"use client";

import Link from "next/link";
import { useMounted } from "@/hooks/useMounted";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { NotificationDropdown } from "./NotificationDropdown";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Navbar() {
  const pathname = usePathname();
  const mounted = useMounted();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="fixed top-0 left-0 z-50 w-full px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between bg-[#0C061F]/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex-1 md:flex-none">
          <Link href="/" className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpg"
              alt="Agora Logo"
              className="w-10 h-10 rounded-full object-cover"
            />
            <span className="font-heading font-black text-2xl tracking-tight text-white hidden sm:inline-block pt-0.5">
              Agora
            </span>
          </Link>
        </div>

        {/* Centered Pill Navigation (Desktop) */}
        <div className="hidden md:flex items-center p-1.5 bg-[#0C061F]/60 backdrop-blur-md border border-white/5 rounded-full text-xs font-semibold uppercase tracking-widest">
          <Link
            href="/"
            className={`px-5 py-2.5 rounded-full transition-colors ${pathname === "/" ? "bg-primary text-white shadow-lg shadow-primary/25" : "text-muted-foreground hover:text-white"}`}
          >
            Home
          </Link>
          <Link
            href="/how-it-works"
            className={`px-5 py-2.5 rounded-full transition-colors ${pathname === "/how-it-works" ? "bg-primary text-white shadow-lg shadow-primary/25" : "text-muted-foreground hover:text-white"}`}
          >
            How it Works
          </Link>
          <Link
            href="/communities"
            className={`px-5 py-2.5 rounded-full transition-colors ${pathname === "/communities" ? "bg-primary text-white shadow-lg shadow-primary/25" : "text-muted-foreground hover:text-white"}`}
          >
            Hubs
          </Link>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 sm:gap-4 md:w-auto justify-end">
          <NotificationDropdown />

          {/* Desktop Wallet Button */}
          <div className="hidden md:block">
            {mounted ? (
              <ConnectButton showBalance={false} />
            ) : (
              <div className="h-10 w-[140px] bg-muted animate-pulse rounded-full" />
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden flex items-center justify-center w-11 h-11 rounded-full bg-[#130E26] border border-border hover:bg-[#1C1635] transition-colors text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#0C061F]/95 backdrop-blur-xl flex flex-col pt-24 px-6 pb-6 md:hidden">
          <div className="flex flex-col gap-4 text-center text-lg font-heading font-black tracking-wider">
            <Link
              href="/"
              className={`p-4 rounded-xl ${pathname === "/" ? "bg-primary/20 text-primary border border-primary/50" : "text-white"}`}
            >
              HOME
            </Link>
            <Link
              href="/how-it-works"
              className={`p-4 rounded-xl ${pathname === "/how-it-works" ? "bg-primary/20 text-primary border border-primary/50" : "text-white"}`}
            >
              HOW IT WORKS
            </Link>
            <Link
              href="/communities"
              className={`p-4 rounded-xl ${pathname === "/communities" ? "bg-primary text-white shadow-lg shadow-primary/25" : "text-muted-foreground hover:text-white"}`}
            >
              HUBS
            </Link>
          </div>

          <div className="mt-auto pt-6 border-t border-white/10 flex justify-center">
            {mounted ? (
              <ConnectButton showBalance={false} />
            ) : (
              <div className="h-14 w-full bg-muted animate-pulse rounded-xl" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
