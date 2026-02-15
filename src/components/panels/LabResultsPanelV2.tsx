'use client'
import React from 'react'
import { FlaskConical } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function LabResultsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch } = usePanelData({ endpoint: 'lab-results', patientId })
  // data = lab results, drchronoData = lab orders
  if (!isOpen) return null
  const all = [...data, ...drchronoData.map((o: any) => ({ ...o, _type: 'order' }))]
  return (
    <PanelBase title={`Lab Results — ${patientName}`} icon={FlaskConical} accentColor="#06b6d4" loading={loading} error={error}
      hasData={all.length > 0} emptyMessage="No lab results" onRetry={refetch} onClose={onClose} draggable={false}
      badge={data.length > 0 ? `${data.length} results` : undefined} syncStatus={data.length > 0 ? 'synced' : null}>
      <div className="p-3 space-y-1.5">
        {data.length > 0 && <p className="text-[9px] text-gray-500 uppercase font-semibold">Results</p>}
        {data.map((r: any, i: number) => (
          <div key={r.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{r.test_name || r.observation_name || 'Lab Test'}</span>
              {r.abnormal_flag && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">ABNORMAL</span>}
            </div>
            <div className="flex gap-3 mt-1 text-xs text-gray-400">
              {r.observation_value && <span>Value: <strong className="text-white">{r.observation_value}</strong> {r.units || ''}</span>}
              {r.normal_range && <span>Range: {r.normal_range}</span>}
            </div>
            {r.observation_date && <p className="text-[10px] text-gray-600 mt-1">{new Date(r.observation_date).toLocaleDateString()}</p>}
          </div>
        ))}
        {drchronoData.length > 0 && <p className="text-[9px] text-gray-500 uppercase font-semibold mt-2">Lab Orders</p>}
        {drchronoData.map((o: any, i: number) => (
          <div key={o.id || `o-${i}`} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2 flex items-center gap-2">
            <span className="text-xs text-gray-400 flex-1">{o.lab_name || o.test_name || 'Lab Order'}</span>
            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${o.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>{o.status || 'pending'}</span>
          </div>
        ))}
      </div>
    </PanelBase>
  )
}
