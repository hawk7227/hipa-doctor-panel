'use client'
import React from 'react'
import { History, Pill } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function MedicationHistoryPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch } = usePanelData({ endpoint: 'medication-history', patientId })
  const all = [...data.map((d: any) => ({ ...d, _src: 'local' })), ...drchronoData.map((d: any) => ({ ...d, _src: 'drchrono' }))]
    .sort((a: any, b: any) => new Date(b.date_prescribed || b.created_at || 0).getTime() - new Date(a.date_prescribed || a.created_at || 0).getTime())

  if (!isOpen) return null
  return (
    <PanelBase title={`Medication History — ${patientName}`} icon={History} accentColor="#a855f7" loading={loading} error={error}
      hasData={all.length > 0} emptyMessage="No medication history" emptyIcon={Pill} onRetry={refetch} onClose={onClose} draggable={false}
      badge={all.length > 0 ? all.length : undefined} syncStatus={drchronoData.length > 0 ? 'synced' : null}>
      <div className="p-3 space-y-1.5">
        {all.map((m: any, i: number) => (
          <div key={m.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{m.name || m.medication_name || 'Unknown'}</span>
                {m.status && <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${m.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>{m.status}</span>}
                {m._src === 'drchrono' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>}
              </div>
              <div className="flex gap-2 mt-0.5 text-xs text-gray-500">
                {(m.dosage || m.dosage_quantity) && <span>{m.dosage || `${m.dosage_quantity || ''}${m.dosage_unit ? ' ' + m.dosage_unit : ''}`}</span>}{m.frequency && <span>• {m.frequency}</span>}
                {(m.date_prescribed || m.created_at) && <span>• {new Date(m.date_prescribed || m.created_at).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </PanelBase>
  )
}
