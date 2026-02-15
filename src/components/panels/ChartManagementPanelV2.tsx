'use client'
import React from 'react'
import { Shield, Lock, Unlock, FileSignature, FilePlus } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; appointmentId?: string; chartStatus?: string }

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'DRAFT', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Unlock },
  preliminary: { label: 'PRELIMINARY', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: FileSignature },
  signed: { label: 'SIGNED', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: FileSignature },
  closed: { label: 'CLOSED', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Lock },
  amended: { label: 'AMENDED', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: FilePlus },
}

export default function ChartManagementPanelV2({ isOpen, onClose, patientId, patientName, appointmentId, chartStatus = 'draft' }: Props) {
  const status = STATUS_MAP[chartStatus] || STATUS_MAP.draft
  const StatusIcon = status.icon

  const handleAction = async (action: string) => {
    if (!appointmentId) return
    try {
      await fetch(`/api/chart/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointment_id: appointmentId }) })
    } catch (err) { console.error(`Chart ${action} failed:`, err) }
  }

  if (!isOpen) return null
  return (
    <PanelBase title={`Chart — ${patientName}`} icon={Shield} accentColor="#a855f7" loading={false} error={null}
      hasData={true} onClose={onClose} draggable={false}>
      <div className="p-3 space-y-3">
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-4 text-center">
          <StatusIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <span className={`inline-block px-3 py-1 text-sm font-bold rounded border ${status.color}`}>{status.label}</span>
          {!appointmentId && <p className="text-xs text-gray-500 mt-2">No appointment selected — patient chart only</p>}
        </div>

        {appointmentId && (
          <div className="space-y-2">
            {chartStatus === 'draft' && (
              <button onClick={() => handleAction('sign')} className="w-full bg-green-600 hover:bg-green-500 text-white py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                <FileSignature className="w-4 h-4" /> Sign Chart
              </button>
            )}
            {chartStatus === 'signed' && (
              <button onClick={() => handleAction('close')} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" /> Close Chart
              </button>
            )}
            {(chartStatus === 'closed' || chartStatus === 'amended') && (
              <>
                <button onClick={() => handleAction('addendum')} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                  <FilePlus className="w-4 h-4" /> Add Addendum
                </button>
                <button onClick={() => handleAction('unlock')} className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                  <Unlock className="w-4 h-4" /> Unlock Chart
                </button>
              </>
            )}
            <button onClick={() => window.open(`/api/chart/pdf?appointment_id=${appointmentId}`, '_blank')}
              className="w-full bg-[#0d2626] border border-[#1a3d3d] text-gray-300 hover:text-white py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2">
              📄 Download PDF
            </button>
          </div>
        )}
      </div>
    </PanelBase>
  )
}
