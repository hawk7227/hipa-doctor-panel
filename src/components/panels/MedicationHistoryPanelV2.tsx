// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'
import React, { useMemo } from 'react'
import { Clock, Pill } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function MedicationHistoryPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch } = usePanelData({ endpoint: 'medication-history', patientId })
  const allItems = useMemo(() => {
    const dc = (drchronoData || []).map((d: any) => ({ ...d, _source: 'drchrono', medication_name: d.name || d.medication_name || 'Unknown' }))
    return [...(data || []), ...dc].sort((a: any, b: any) => new Date(b.start_date || b.created_at).getTime() - new Date(a.start_date || a.created_at).getTime())
  }, [data, drchronoData])

  if (!isOpen) return null

  return (
    <PanelBase title={`Medication History — ${patientName}`} icon={Clock} accentColor="#a855f7" loading={loading}
      error={error} hasData={allItems.length > 0} emptyMessage="No medication history"
      onRetry={refetch} onClose={onClose} draggable={false} badge={allItems.length || undefined}
      syncStatus={drchronoData.length > 0 ? 'synced' : null}>
      <div className="p-3 space-y-2">
        {allItems.map((m: any, i: number) => (
          <div key={m.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Pill className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-white">{m.medication_name}</span>
              {m._source === 'drchrono' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>}
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-5">
              {m.dosage && <span>{m.dosage}</span>}
              {m.frequency && <span className="ml-2">{m.frequency}</span>}
              {m.route && <span className="ml-2 capitalize">{m.route}</span>}
            </div>
            <div className="text-xs text-gray-600 mt-0.5 ml-5">
              {m.start_date && <span>{new Date(m.start_date).toLocaleDateString()}</span>}
              {m.end_date && <span> → {new Date(m.end_date).toLocaleDateString()}</span>}
              {m.discontinuation_reason && <span className="ml-2 text-amber-400">Stopped: {m.discontinuation_reason}</span>}
            </div>
          </div>
        ))}
      </div>
    </PanelBase>
  )
}
