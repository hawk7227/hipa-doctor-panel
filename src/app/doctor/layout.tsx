'use client'

import { ReactNode, useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import AuthWrapper from '@/components/AuthWrapper'
import ErrorBoundary from '@/components/ErrorBoundary'
import { signOutAndRedirect } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { NotificationProvider, NotificationBell, NotificationToast } from '@/lib/notifications'
import SyncIndicator from '@/components/SyncIndicator'
import {
  Menu, X, LayoutDashboard, Calendar, Users, UserPlus,
  FileText, MessageSquare, DollarSign, UserCircle, Clock,
  Shield, UsersRound, LogOut, ChevronLeft, ChevronRight, ClipboardList, Settings
} from 'lucide-react'

// ─── NAV ITEMS ───────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/doctor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/doctor/appointments', label: 'Appointments', icon: Calendar },
  { href: '/doctor/patients', label: 'Patients', icon: Users },
  { href: '/doctor/new-patient', label: 'New Patient', icon: UserPlus },
  { href: '/doctor/records', label: 'Medical Records', icon: FileText },
  { href: '/doctor/communication', label: 'Communication', icon: MessageSquare },
  { href: '/doctor/billing', label: 'Billing & Reports', icon: DollarSign },
  { href: '/doctor/profile', label: 'Profile & Credentials', icon: UserCircle },
  { href: '/doctor/availability', label: 'Availability', icon: Clock },
] as const

const ADMIN_ITEMS = [
  { href: '/doctor/settings', label: 'Settings', icon: Settings },
  { href: '/doctor/settings/staff', label: 'Staff Management', icon: UsersRound },
  { href: '/doctor/chart-management', label: 'Chart Management', icon: Shield },
  { href: '/doctor/settings/audit', label: 'Audit Log', icon: ClipboardList },
] as const

// ─── COMPONENT ───────────────────────────────────────────────
export default function DoctorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [doctorId, setDoctorId] = useState<string | null>(null)

  const isActive = (path: string) => pathname === path

  // Fetch doctor ID for notification provider
  useEffect(() => {
    const fetchDoctorId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: doctor } = await supabase.from('doctors').select('id').eq('email', user.email).single()
        if (doctor) setDoctorId(doctor.id)
      } catch { /* silent */ }
    }
    fetchDoctorId()
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Persist collapse state
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sidebar-collapsed') : null
    if (saved === 'true') setCollapsed(true)
  }, [])

  // Auto-collapse on workspace-heavy pages (calendar, chart management)
  const isWorkspacePage = pathname === '/doctor/appointments' || pathname === '/doctor/chart-management'
  useEffect(() => {
    if (isWorkspacePage && !collapsed && window.innerWidth >= 1024) {
      setCollapsed(true)
    }
  }, [isWorkspacePage]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }, [])

  const sidebarWidth = collapsed ? 'w-16' : 'w-56'
  const contentMargin = collapsed ? 'lg:ml-16' : 'lg:ml-56'

  // ─── NAV LINK COMPONENT ───────────────────────────────────
  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof LayoutDashboard }) => {
    const active = isActive(href)
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`
          flex items-center rounded-lg transition-colors group relative
          ${collapsed ? 'justify-center p-2.5 mx-1' : 'px-3 py-2.5 mx-2'}
          ${active
            ? 'bg-teal-500/15 text-teal-400'
            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
          }
        `}
        title={collapsed ? label : undefined}
      >
        <Icon className={`flex-shrink-0 ${collapsed ? 'w-5 h-5' : 'w-4 h-4'}`} />
        {!collapsed && <span className="ml-3 text-sm font-medium truncate">{label}</span>}
        {/* Active indicator bar */}
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-teal-400 rounded-r-full" />
        )}
        {/* Tooltip for collapsed mode */}
        {collapsed && (
          <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#1a3d3d] text-white text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg pointer-events-none">
            {label}
          </div>
        )}
      </Link>
    )
  }

  return (
    <AuthWrapper>
      <NotificationProvider doctorId={doctorId}>
      <div className="h-screen bg-[#0a1f1f] flex overflow-hidden">
        {/* Skip to content — accessibility */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:bg-teal-400 focus:text-[#0a1f1f] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-bold">
          Skip to main content
        </a>

        {/* ═══ MOBILE: Hamburger Button ═══ */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden fixed top-3 left-3 z-[60] p-2 bg-[#0d2626] text-gray-300 rounded-lg border border-[#1a3d3d] hover:bg-[#164e4e] hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* ═══ MOBILE: Backdrop ═══ */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />
        )}

        {/* ═══ SIDEBAR ═══ */}
        <aside
          role="navigation"
          aria-label="Main navigation"
          className={`
            fixed left-0 top-0 h-full bg-[#0d2626] border-r border-[#1a3d3d] z-50
            flex flex-col transition-all duration-200 ease-out
            ${sidebarWidth}
            ${mobileOpen ? 'translate-x-0 w-56' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Header */}
          <div className={`flex items-center flex-shrink-0 border-b border-[#1a3d3d] ${collapsed ? 'justify-center py-4 px-2' : 'px-4 py-4'}`}>
            <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 bg-white rounded-full" />
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="ml-3 min-w-0">
                <h1 className="text-sm font-bold text-white truncate">Medazon Health</h1>
                <p className="text-[10px] text-teal-400">Doctor Panel</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.href} {...item} />
            ))}

            <div className={`border-t border-[#1a3d3d] my-2 ${collapsed ? 'mx-2' : 'mx-4'}`} />

            {ADMIN_ITEMS.map(item => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>

          {/* Footer: Notifications + Sign out + Collapse toggle */}
          <div className="flex-shrink-0 border-t border-[#1a3d3d] p-2 space-y-1">
            {/* Notification Bell */}
            <div className={`flex ${collapsed ? 'justify-center' : 'px-1'}`}>
              <NotificationBell />
            </div>

            {/* DrChrono Sync */}
            <div className={`flex ${collapsed ? 'justify-center' : 'px-1'}`}>
              <SyncIndicator doctorId={doctorId} compact={collapsed} />
            </div>

            {/* Sign Out */}
            <button
              onClick={signOutAndRedirect}
              className={`
                flex items-center rounded-lg transition-colors w-full text-gray-400 hover:bg-white/5 hover:text-gray-200
                ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}
              `}
              title={collapsed ? 'Sign Out' : undefined}
            >
              <LogOut className={`flex-shrink-0 ${collapsed ? 'w-5 h-5' : 'w-4 h-4'}`} />
              {!collapsed && <span className="ml-3 text-sm font-medium">Sign Out</span>}
            </button>

            {/* Collapse toggle (desktop only) */}
            <button
              onClick={toggleCollapsed}
              className="hidden lg:flex items-center justify-center w-full p-2 rounded-lg text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-colors"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        {/* ═══ MAIN CONTENT ═══ */}
        <main id="main-content" className={`flex-1 h-full overflow-hidden transition-all duration-200 ${contentMargin}`}>
          {/* Mobile top padding for hamburger button */}
          <div className="h-full pt-12 lg:pt-0">
            <ErrorBoundary label="Page">
              {children}
            </ErrorBoundary>
          </div>
        </main>

        {/* Global notification toast */}
        <NotificationToast />
      </div>
      </NotificationProvider>
    </AuthWrapper>
  )
}
