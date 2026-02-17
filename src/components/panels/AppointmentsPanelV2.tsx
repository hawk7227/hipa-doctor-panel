// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import React, { useState, useMemo } from 'react'
import { Calendar, Clock, Video, MapPin, User, Phone, FileText, AlertCircle, CheckCircle, XCircle, Filter } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Upcoming', 'Past', 'All'] as const
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  checked_in: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  in_progress: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  no_show: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  rescheduled: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}
const TYPE_ICONS: Record<string, React.ElementType> = {
  telehealth: Video, video: Video, in_person: MapPin, phone: Phone,
}

function formatDateTime(d: string) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' at ' +
    dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function AppointmentsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch } = usePanelData({ endpoint: 'patient-appointments', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Upcoming')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const now = new Date()
  const sorted = useMemo(() => [...(data || [])].sort((a: any, b: any) => 
    new Date(b.appointment_date || b.scheduled_time || b.created_at).getTime() - 
    new Date(a.appointment_date || a.scheduled_time || a.created_at).getTime()
  ), [data])

  const filtered = useMemo(() => {
    if (tab === 'Upcoming') return sorted.filter((a: any) => {
      const d = new Date(a.appointment_date || a.scheduled_time)
      return d >= now && a.status !== 'cancelled' && a.status !== 'completed'
    }).reverse()
    if (tab === 'Past') return sorted.filter((a: any) => {
      const d = new Date(a.appointment_date || a.scheduled_time)
      return d < now || a.status === 'completed'
    })
    return sorted
  }, [sorted, tab, now])

  const upcomingCount = sorted.filter((a: any) => {
    const d = new Date(a.appointment_date || a.scheduled_time)
    return d >= now && a.status !== 'cancelled' && a.status !== 'completed'
  }).length

  if (!isOpen) return null

  return (
    <PanelBase title={`Appointments — ${patientName}`} icon={Calendar} accentColor="#3b82f6" loading={loading}
      error={error} hasData={sorted.length > 0} emptyMessage="No appointments found"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={upcomingCount > 0 ? `${upcomingCount} upcoming` : sorted.length || undefined}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Upcoming' && upcomingCount > 0 && <span className="ml-1 text-[9px] bg-blue-500/20 text-blue-400 px-1 rounded">{upcomingCount}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-xs text-gray-500">
              {tab === 'Upcoming' ? 'No upcoming appointments' : 'No appointments found'}
            </div>
          )}
          {filtered.map((apt: any) => {
            const TypeIcon = TYPE_ICONS[apt.visit_type || apt.appointment_type] || Calendar
            const isExpanded = expandedId === apt.id
            return (
              <div key={apt.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg overflow-hidden">
                <div className="p-3 cursor-pointer hover:bg-[#0d2a2a] transition-colors" onClick={() => setExpandedId(isExpanded ? null : apt.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {formatDateTime(apt.appointment_date || apt.scheduled_time)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {apt.visit_reason || apt.reason || apt.service_type || apt.appointment_type || 'General Visit'}
                          {apt.duration_minutes && <span className="ml-2">({apt.duration_minutes} min)</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[apt.status] || STATUS_COLORS.pending}`}>
                      {(apt.status || 'pending').replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-[#1a3d3d] p-3 space-y-2 text-xs">
                    {apt.visit_type && <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-white capitalize">{apt.visit_type.replace('_', ' ')}</span></div>}
                    {apt.provider_name && <div className="flex justify-between"><span className="text-gray-500">Provider</span><span className="text-white">{apt.provider_name}</span></div>}
                    {apt.location && <div className="flex justify-between"><span className="text-gray-500">Location</span><span className="text-white">{apt.location}</span></div>}
                    {apt.chief_complaint && <div className="flex justify-between"><span className="text-gray-500">Chief Complaint</span><span className="text-white">{apt.chief_complaint}</span></div>}
                    {(apt.copay_amount || apt.copay) && <div className="flex justify-between"><span className="text-gray-500">Copay</span><span className="text-white">${apt.copay_amount || apt.copay}</span></div>}
                    {apt.notes && <div><span className="text-gray-500">Notes:</span><p className="text-gray-300 mt-1">{apt.notes}</p></div>}
                    {apt.chart_status && <div className="flex justify-between"><span className="text-gray-500">Chart</span><span className={`capitalize ${apt.chart_status === 'signed' ? 'text-green-400' : apt.chart_status === 'open' ? 'text-amber-400' : 'text-gray-400'}`}>{apt.chart_status}</span></div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </PanelBase>
  )
}
