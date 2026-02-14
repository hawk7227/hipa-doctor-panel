'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import {
  Settings, User, Bell, Shield, Users, ClipboardList,
  Key, Globe, Palette, ChevronRight, Lock, Mail
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// SETTINGS HUB — Links to all settings pages
// ═══════════════════════════════════════════════════════════════

interface SettingsCard {
  href: string
  icon: typeof Settings
  color: string
  bgColor: string
  title: string
  description: string
  badge?: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorName, setDoctorName] = useState('')

  useEffect(() => {
    const init = async () => {
      const authUser = await getCurrentUser()
      if (!authUser?.doctor) { router.push('/login'); return }
      setDoctorName(`Dr. ${authUser.doctor.first_name} ${authUser.doctor.last_name}`)
      setLoading(false)
    }
    init()
  }, [router])

  const settingsCards: SettingsCard[] = [
    {
      href: '/doctor/profile',
      icon: User,
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/15',
      title: 'Profile & Credentials',
      description: 'Name, specialty, NPI number, license info',
    },
    {
      href: '/doctor/settings/staff',
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/15',
      title: 'Staff Management',
      description: 'Invite assistants, set roles and permissions',
    },
    {
      href: '/doctor/settings/audit',
      icon: ClipboardList,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/15',
      title: 'Audit Log',
      description: 'HIPAA-compliant activity trail, CSV export',
      badge: 'HIPAA',
    },
    {
      href: '/doctor/chart-management',
      icon: Shield,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      title: 'Chart Management',
      description: 'Unsigned notes, overdue charts, cosign queue',
    },
    {
      href: '/doctor/availability',
      icon: Globe,
      color: 'text-green-400',
      bgColor: 'bg-green-500/15',
      title: 'Availability & Scheduling',
      description: 'Set available hours, booking rules, timezone',
    },
    {
      href: '/doctor/billing',
      icon: Key,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/15',
      title: 'Billing & Revenue',
      description: 'Payment history, revenue analytics, exports',
    },
  ]

  if (loading) {
    return (
      <div className="h-full bg-[#0a1f1f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-[#0a1f1f] text-white">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-gray-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Settings</h1>
            <p className="text-xs text-gray-400">{doctorName} — Practice settings and preferences</p>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {settingsCards.map(card => {
            const Icon = card.icon
            return (
              <Link
                key={card.href}
                href={card.href}
                className="flex items-center space-x-4 bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 hover:border-teal-500/30 hover:bg-[#0d2626]/80 transition-all group"
              >
                <div className={`w-10 h-10 ${card.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-bold text-white">{card.title}</p>
                    {card.badge && (
                      <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">{card.badge}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{card.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-teal-400 transition-colors flex-shrink-0" />
              </Link>
            )
          })}
        </div>

        {/* Security Section */}
        <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Lock className="w-4 h-4 text-red-400" />
            <p className="text-xs font-bold text-white">Security</p>
          </div>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex items-center justify-between py-2 border-b border-[#1a3d3d]/50">
              <span>Two-factor authentication</span>
              <span className="text-amber-400 font-bold">Not enabled</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#1a3d3d]/50">
              <span>Session timeout</span>
              <span className="text-gray-300">30 minutes</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span>HIPAA audit logging</span>
              <span className="text-green-400 font-bold">Active</span>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="text-[10px] text-gray-600 text-center space-y-0.5">
          <p>Medazon Health — HIPAA-Compliant Telehealth Platform</p>
          <p>Enterprise Workspace v2.0 — {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}
