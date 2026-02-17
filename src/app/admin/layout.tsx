// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Shield, MessageSquare, Bell, Bug, Settings,
  ChevronLeft, ChevronRight, LogOut, ClipboardList, Calendar, BarChart3, Database
} from 'lucide-react'
import AdminFloatingMessenger from '@/components/AdminFloatingMessenger'

const NAV_ITEMS = [
  { href: '/admin/doctors/dashboard', label: 'Dashboard', icon: LayoutDashboard, badgeKey: '' },
  { href: '/admin/doctors', label: 'Doctor Approvals', icon: Users, badgeKey: 'approvals' },
  { href: '/admin/messaging', label: 'Messaging', icon: MessageSquare, badgeKey: 'messaging' },
  { href: '/admin/appointments', label: 'Appointments', icon: Calendar, badgeKey: '' },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell, badgeKey: 'notifications' },
  { href: '/admin/bug-reports', label: 'Bug Reports', icon: Bug, badgeKey: 'bugs' },
  { href: '/admin/drchrono-migration', label: 'DrChrono Sync', icon: Database, badgeKey: '' },
  { href: '/admin/audit', label: 'Audit Log', icon: ClipboardList, badgeKey: '' },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, badgeKey: '' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, badgeKey: '' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [badges, setBadges] = useState<Record<string, number>>({})

  // Fetch unread counts for sidebar badges
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const { supabase } = await import('@/lib/supabase')

        // Messaging unread
        const msgRes = await fetch('/api/admin/messaging?action=conversations')
        const msgData = await msgRes.json()
        const msgUnread = (msgData.conversations || []).reduce((s: number, c: any) => s + (c.unread_count || 0), 0)

        // Pending doctor approvals
        const { count: pendingDocs } = await supabase
          .from('doctors').select('id', { count: 'exact', head: true }).eq('is_approved', false)

        // Open bug reports
        const { count: openBugs } = await supabase
          .from('bug_reports').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress'])

        setBadges({
          messaging: msgUnread,
          approvals: pendingDocs || 0,
          bugs: openBugs || 0,
        })
      } catch {}
    }
    fetchBadges()
    const interval = setInterval(fetchBadges, 20000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#030f0f] flex">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-[#050e14] border-r border-[#1a3d3d] flex flex-col transition-all duration-200 flex-shrink-0`}>
        {/* Logo */}
        <div className="p-4 border-b border-[#1a3d3d] flex items-center justify-between">
          {!collapsed && (
            <div>
              <div className="text-sm font-bold text-white">Medazon Health</div>
              <div className="text-[10px] text-red-400 font-semibold">MASTER ADMIN</div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 text-gray-500 hover:text-white">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const badge = item.badgeKey ? (badges[item.badgeKey] || 0) : 0
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors relative ${
                  isActive ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
                <div className="relative flex-shrink-0">
                  <Icon className="w-4 h-4" />
                  {badge > 0 && collapsed && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#1a3d3d]">
          <Link href="/login" className="flex items-center gap-3 px-2 py-2 text-gray-500 hover:text-red-400 text-sm">
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Logout</span>}
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Floating Messenger — always visible even when sidebar collapsed */}
      <AdminFloatingMessenger />
    </div>
  )
}
