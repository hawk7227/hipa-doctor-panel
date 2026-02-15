'use client'
import React from 'react'
import { DollarSign } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function BillingPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch } = usePanelData({ endpoint: 'billing', patientId })
  if (!isOpen) return null

  const total = data.reduce((sum: number, item: any) => sum + (parseFloat(item.price || item.amount || 0)), 0)

  return (
    <PanelBase title={`Billing — ${patientName}`} icon={DollarSign} accentColor="#10b981" loading={loading} error={error}
      hasData={data.length > 0} emptyMessage="No billing records" emptyIcon={DollarSign} onRetry={refetch} onClose={onClose} draggable={false}
      badge={data.length > 0 ? `$${total.toFixed(2)}` : undefined} syncStatus={data.length > 0 ? 'synced' : null}>
      <div className="p-3 space-y-1.5">
        {data.map((item: any, i: number) => (
          <div key={item.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{item.description || item.procedure_type || 'Line Item'}</span>
                {item.code && <span className="px-1.5 py-0.5 text-[9px] font-mono text-cyan-400 bg-cyan-500/10 rounded border border-cyan-500/20">{item.code}</span>}
              </div>
              <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                {item.service_date && <span>{new Date(item.service_date).toLocaleDateString()}</span>}
                {item.diagnosis_pointers && <span>DX: {item.diagnosis_pointers}</span>}
              </div>
            </div>
            <span className="text-sm font-bold text-green-400 flex-shrink-0">${parseFloat(item.price || item.amount || 0).toFixed(2)}</span>
          </div>
        ))}
        {data.length > 0 && (
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg p-3 flex items-center justify-between mt-2">
            <span className="text-sm text-gray-400 font-semibold">Total</span>
            <span className="text-lg font-bold text-green-400">${total.toFixed(2)}</span>
          </div>
        )}
      </div>
    </PanelBase>
  )
}
