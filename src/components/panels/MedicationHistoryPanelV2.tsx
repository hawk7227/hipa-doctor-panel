// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import React, { useMemo } from 'react'
import { Clock, Pill } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function MedicationHistoryPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch } = usePanelData({ endpoint: 'medication-history', patientId })
  const allItems = useMemo(() => {
    return [...(data || [])].sort((a: any, b: any) => new Date(b.start_date || b.created_at).getTime() - new Date(a.start_date || a.created_at).getTime())
  }, [data])

  if (!isOpen) return null

  return (
    <PanelBase title={`Medication History — ${patientName}`} icon={Clock} accentColor="#a855f7" loading={loading}
      error={error} hasData={allItems.length > 0} emptyMessage="No medication history"
      onRetry={refetch} onClose={onClose} draggable={false} badge={allItems.length || undefined}>
      <div className="p-3 space-y-2">
        {allItems.map((m: any, i: number) => (
          <div key={m.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Pill className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-white">{m.medication_name}</span>
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
