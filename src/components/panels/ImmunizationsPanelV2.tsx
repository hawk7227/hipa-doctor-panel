'use client'
import React from 'react'
import { Syringe } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function ImmunizationsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch } = usePanelData({ endpoint: 'immunizations', patientId })
  if (!isOpen) return null
  return (
    <PanelBase title={`Immunizations — ${patientName}`} icon={Syringe} accentColor="#10b981" loading={loading} error={error}
      hasData={data.length > 0} emptyMessage="No immunization records" emptyIcon={Syringe} onRetry={refetch} onClose={onClose} draggable={false}
      badge={data.length > 0 ? data.length : undefined} syncStatus={data.length > 0 ? 'synced' : null}>
      <div className="p-3 space-y-1.5">
        {data.map((v: any, i: number) => (
          <div key={v.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{v.vaccine_name || v.cvx_description || 'Vaccine'}</span>
              {v.status && <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${v.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>{v.status}</span>}
            </div>
            <div className="flex gap-3 mt-1 text-xs text-gray-500">
              {v.administered_date && <span>{new Date(v.administered_date).toLocaleDateString()}</span>}
              {v.dose_quantity && <span>Dose: {v.dose_quantity}{v.dose_unit ? " " + v.dose_unit : ""}</span>}
              {v.site && <span>Site: {v.site}</span>}
              {v.route && <span>Route: {v.route}</span>}
            </div>
            {v.lot_number && <p className="text-[10px] text-gray-600 mt-0.5">Lot: {v.lot_number}</p>}
          </div>
        ))}
      </div>
    </PanelBase>
  )
}
