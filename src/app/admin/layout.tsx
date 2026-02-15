'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Shield, MessageSquare, Bell, Bug, Settings,
  ChevronLeft, ChevronRight, LogOut, ClipboardList, Calendar, BarChart3
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/admin/doctors/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/doctors', label: 'Doctor Approvals', icon: Users },
  { href: '/admin/messaging', label: 'Messaging', icon: MessageSquare },
  { href: '/admin/appointments', label: 'Appointments', icon: Calendar },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/bug-reports', label: 'Bug Reports', icon: Bug },
  { href: '/admin/audit', label: 'Audit Log', icon: ClipboardList },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

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
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
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
    </div>
  )
}
