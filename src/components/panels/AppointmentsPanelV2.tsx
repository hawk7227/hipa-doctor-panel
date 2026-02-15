'use client'
import React from 'react'
import { CalendarDays } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const STATUS_COLORS: Record<string, string> = {
  accepted: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  rejected: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  no_show: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}
const VISIT_COLORS: Record<string, string> = { video: 'text-green-400', phone: 'text-amber-400', async: 'text-blue-400' }

export default function AppointmentsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch } = usePanelData({ endpoint: 'patient-appointments', patientId })
  if (!isOpen) return null

  return (
    <PanelBase title={`Appointments — ${patientName}`} icon={CalendarDays} accentColor="#f97316" loading={loading} error={error}
      hasData={data.length > 0} emptyMessage="No appointments" emptyIcon={CalendarDays} onRetry={refetch} onClose={onClose} draggable={false}
      badge={data.length > 0 ? data.length : undefined}>
      <div className="p-3 space-y-1.5">
        {data.map((a: any) => (
          <a key={a.id} href={`/doctor/appointments?apt=${a.id}`}
            className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2.5 flex items-center gap-3 hover:bg-[#0d2d2d] transition-colors cursor-pointer block">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-white font-medium">
                  {a.requested_date_time ? new Date(a.requested_date_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                </span>
                {a.visit_type && <span className={`text-xs font-bold ${VISIT_COLORS[a.visit_type] || 'text-gray-400'}`}>{a.visit_type.toUpperCase()}</span>}
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[a.status] || STATUS_COLORS.pending}`}>{(a.status || 'pending').toUpperCase()}</span>
                {a.chart_status && a.chart_status !== 'draft' && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">{a.chart_status}</span>
                )}
              </div>
              {a.chief_complaint && <p className="text-xs text-gray-500 mt-0.5 truncate">{a.chief_complaint}</p>}
            </div>
            <span className="text-xs text-gray-600">→</span>
          </a>
        ))}
      </div>
    </PanelBase>
  )
}
