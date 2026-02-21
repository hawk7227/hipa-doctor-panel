// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import React from 'react'
import {
  Pill, ClipboardList, FileText, CalendarDays, AlertTriangle, AlertCircle,
  Activity, Stethoscope, User, FlaskConical, Syringe, FolderOpen, Users,
  Wine, Scissors, Building2, ClipboardCheck, DollarSign, MessageSquare,
  ArrowRight, Shield, ShieldCheck, Bell, Brain, BarChart3,
} from 'lucide-react'
import type { PanelId } from '../hooks/usePanelVisibility'

export const EHR_PANELS: ReadonlyArray<{
  id: PanelId
  label: string
  icon: typeof Pill
  color: string
  hoverBg: string
}> = [
  { id: 'medication-history', label: 'Med Hx', icon: Pill, color: '#a855f7', hoverBg: 'hover:bg-purple-700' },
  { id: 'orders', label: 'Orders', icon: ClipboardList, color: '#3b82f6', hoverBg: 'hover:bg-blue-700' },
  { id: 'prescription-history', label: 'Rx Hx', icon: FileText, color: '#14b8a6', hoverBg: 'hover:bg-teal-700' },
  { id: 'appointments', label: 'Appts', icon: CalendarDays, color: '#f97316', hoverBg: 'hover:bg-orange-700' },
  { id: 'allergies', label: 'Allergy', icon: AlertTriangle, color: '#ef4444', hoverBg: 'hover:bg-red-700' },
  { id: 'vitals', label: 'Vitals', icon: Activity, color: '#06b6d4', hoverBg: 'hover:bg-cyan-700' },
  { id: 'medications', label: 'Meds', icon: Pill, color: '#10b981', hoverBg: 'hover:bg-emerald-700' },
  { id: 'demographics', label: 'Demo', icon: User, color: '#64748b', hoverBg: 'hover:bg-slate-700' },
  { id: 'problems', label: 'Problems', icon: AlertCircle, color: '#f97316', hoverBg: 'hover:bg-orange-700' },
  { id: 'clinical-notes', label: 'Notes', icon: FileText, color: '#3b82f6', hoverBg: 'hover:bg-blue-700' },
  { id: 'lab-results-panel', label: 'Labs', icon: FlaskConical, color: '#06b6d4', hoverBg: 'hover:bg-cyan-700' },
  { id: 'immunizations', label: 'Immun', icon: Syringe, color: '#10b981', hoverBg: 'hover:bg-emerald-700' },
  { id: 'documents', label: 'Docs', icon: FolderOpen, color: '#f59e0b', hoverBg: 'hover:bg-amber-700' },
  { id: 'family-history', label: 'Fam Hx', icon: Users, color: '#f43f5e', hoverBg: 'hover:bg-rose-700' },
  { id: 'social-history', label: 'Social', icon: Wine, color: '#f59e0b', hoverBg: 'hover:bg-amber-700' },
  { id: 'surgical-history', label: 'Surg Hx', icon: Scissors, color: '#ef4444', hoverBg: 'hover:bg-red-700' },
  { id: 'pharmacy', label: 'Pharmacy', icon: Building2, color: '#14b8a6', hoverBg: 'hover:bg-teal-700' },
  { id: 'care-plans', label: 'Care Plan', icon: ClipboardCheck, color: '#a855f7', hoverBg: 'hover:bg-purple-700' },
  { id: 'billing', label: 'Billing', icon: DollarSign, color: '#10b981', hoverBg: 'hover:bg-emerald-700' },
  { id: 'comm-hub', label: 'Comms', icon: MessageSquare, color: '#3b82f6', hoverBg: 'hover:bg-blue-700' },
  { id: 'lab-results-inline', label: 'Lab Orders', icon: FlaskConical, color: '#0ea5e9', hoverBg: 'hover:bg-sky-700' },
  { id: 'referrals-followup', label: 'Referrals', icon: ArrowRight, color: '#f97316', hoverBg: 'hover:bg-orange-700' },
  { id: 'prior-auth', label: 'Prior Auth', icon: ShieldCheck, color: '#8b5cf6', hoverBg: 'hover:bg-violet-700' },
  { id: 'insurance', label: 'Insurance', icon: Shield, color: '#0ea5e9', hoverBg: 'hover:bg-sky-700' },
  { id: 'alerts', label: 'Alerts', icon: Bell, color: '#ef4444', hoverBg: 'hover:bg-red-700' },
  { id: 'ai-interactions', label: 'AI Assist', icon: Brain, color: '#a855f7', hoverBg: 'hover:bg-purple-700' },
  { id: 'quality-measures', label: 'Quality', icon: BarChart3, color: '#10b981', hoverBg: 'hover:bg-emerald-700' },
  { id: 'cohorts', label: 'Cohorts', icon: Users, color: '#6366f1', hoverBg: 'hover:bg-indigo-700' },
  { id: 'chart-management', label: 'Chart', icon: Shield, color: '#a855f7', hoverBg: 'hover:bg-purple-700' },
] as const

interface ToolbarButtonsProps {
  onPanelToggle: (id: PanelId) => void
  isPanelOpen: (id: PanelId) => boolean
}

export default React.memo(function ToolbarButtons({ onPanelToggle, isPanelOpen }: ToolbarButtonsProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {EHR_PANELS.map(panel => {
        const Icon = panel.icon
        const isActive = isPanelOpen(panel.id)
        return (
          <button
            key={panel.id}
            onClick={() => onPanelToggle(panel.id)}
            className={`flex items-center gap-1 rounded-lg font-bold whitespace-nowrap transition-all border hover:text-white relative ${
              isActive
                ? 'px-2 py-1.5 text-[11px] border-white/30 text-white'
                : 'px-2 py-1.5 text-[11px] border-white/10 hover:border-white/30 text-slate-300'
            }`}
            style={{ background: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)' }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: panel.color }} />
            {panel.label}
            {isActive && (
              <span
                className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: panel.color }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
})


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: EHR Panel toolbar button configs
// Built: 2026-02-17 | 28 panel buttons + eRx
//
// Each button maps to a panel ID used in WorkspaceCanvas PANEL_CONTENT
// If you add a button here, you MUST add matching entry in
// WorkspaceCanvas.tsx PANEL_CONTENT and create the panel component
//
// FIX-005 (2026-02-17): lab-results-inline and referrals-followup
//   were in this file but missing from PANEL_CONTENT
// ═══════════════════════════════════════════════════════════════
