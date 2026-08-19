'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, ExternalLink } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'
import { useMounted } from '@/hooks/useMounted'

interface Notification {
  id: number
  user_address: string
  notification_type: string
  message: string
  link: string
  is_read: boolean
  created_at: number
}

export function NotificationDropdown() {
  const { address } = useAccount()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const mounted = useMounted()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (!address) return
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/notifications/?address=${address}`)
        if (res.ok) {
          const data = await res.json()
          setNotifications(data)
        }
      } catch (err) {
        console.error("Failed to fetch notifications", err)
      }
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [address])

  const unreadCount = notifications.filter(n => !n.is_read).length

  const markAsRead = async (id: number, link: string) => {
    try {
      await fetch(`http://localhost:8000/api/notifications/${id}/mark-read/`, { method: 'POST' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      if (link) {
        router.push(link)
      }
      setIsOpen(false)
    } catch (err) {
      console.error(err)
    }
  }


  const markAllAsRead = async () => {
    try {
      await fetch(`http://localhost:8000/api/notifications/mark-all-read/`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error(err)
    }
  }

  const clearAll = async () => {
    try {
      await fetch(`http://localhost:8000/api/notifications/clear/`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      })
      setNotifications([])
    } catch (err) {
      console.error(err)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'REPLY': return '💬'
      case 'CONTENT_REMOVED': return '🗑️'
      case 'FLAG_ACCEPTED': return '🏆'
      case 'APPEAL_GRANTED': return '⚖️'
      case 'APPEAL_DENIED': return '❌'
      case 'REP_REWARD_REVERSED': return '↩️'
      default: return '🔔'
    }
  }

  if (!mounted || !address) return (
      <button 
        disabled
        className="hidden sm:flex relative items-center justify-center w-10 h-10 rounded-full bg-[#130E26] border border-border transition-colors text-muted-foreground opacity-50"
      >
        <Bell className="w-4 h-4" />
      </button>
  )

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="hidden sm:flex relative items-center justify-center w-10 h-10 rounded-full bg-[#130E26] border border-border hover:bg-[#1C1635] transition-colors text-muted-foreground"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#130E26]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[#130E26] border border-[#291F4A] rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="p-3 border-b border-[#291F4A] bg-[#1C1635] flex justify-between items-center">
            <h3 className="font-bold text-white">Notifications</h3>
            {notifications.length > 0 && (
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs text-primary hover:text-primary/80 font-medium">
                    Mark all as read
                  </button>
                )}
                <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300 font-medium ml-2">
                  Clear
                </button>
              </div>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => markAsRead(n.id, n.link)}
                  className={`p-3 border-b border-[#291F4A]/50 hover:bg-[#1C1635] cursor-pointer transition-colors flex gap-3 ${n.is_read ? 'opacity-60' : ''}`}
                >
                  <div className="text-xl">{getIcon(n.notification_type)}</div>
                  <div className="flex-1 space-y-1">
                    <p className={`text-sm ${!n.is_read ? 'text-white font-semibold' : 'text-muted-foreground'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(n.created_at * 1000).toLocaleString()}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
