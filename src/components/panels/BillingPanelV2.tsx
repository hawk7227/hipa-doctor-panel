'use client'
import React, { useState, useMemo } from 'react'
import { DollarSign, Plus, CreditCard, FileText, Shield, Receipt, AlertCircle } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }
const TABS = ['Claims', 'Payments', 'Insurance'] as const
const CLAIM_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400', ready: 'bg-blue-500/20 text-blue-400',
  submitted: 'bg-cyan-500/20 text-cyan-400', paid: 'bg-green-500/20 text-green-400',
  denied: 'bg-red-500/20 text-red-400', partial_paid: 'bg-amber-500/20 text-amber-400',
}

export default function BillingPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data: claims, drchronoData, loading, error, refetch, create } = usePanelData({ endpoint: 'billing', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Claims')

  const totalBilled = useMemo(() => (claims || []).reduce((s: number, c: any) => s + (c.billed_amount || 0), 0), [claims])
  const totalPaid = useMemo(() => (claims || []).reduce((s: number, c: any) => s + (c.paid_amount || 0), 0), [claims])
  const balance = totalBilled - totalPaid

  if (!isOpen) return null

  return (
    <PanelBase title={`Billing — ${patientName}`} icon={DollarSign} accentColor="#f59e0b" loading={loading}
      error={error} hasData={(claims || []).length > 0 || drchronoData.length > 0} emptyMessage="No billing records"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={balance > 0 ? `$${balance.toFixed(2)} due` : undefined}
      syncStatus={drchronoData.length > 0 ? 'synced' : null}>
      <div className="flex flex-col h-full">
        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-2 p-3 border-b border-[#1a3d3d]">
          <div className="text-center"><div className="text-[10px] text-gray-500">Billed</div><div className="text-sm font-bold text-white">${totalBilled.toFixed(2)}</div></div>
          <div className="text-center"><div className="text-[10px] text-gray-500">Paid</div><div className="text-sm font-bold text-green-400">${totalPaid.toFixed(2)}</div></div>
          <div className="text-center"><div className="text-[10px] text-gray-500">Balance</div><div className={`text-sm font-bold ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>${balance.toFixed(2)}</div></div>
        </div>

        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-amber-400 text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{t}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tab === 'Claims' && (claims || []).map((c: any) => (
            <div key={c.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">${c.billed_amount?.toFixed(2) || '0.00'}</span>
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${CLAIM_STATUS_COLORS[c.status] || ''}`}>{(c.status || 'draft').toUpperCase()}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {c.cpt_codes?.length > 0 && <span className="font-mono">{c.cpt_codes.map((c: any) => c.code || c).join(', ')}</span>}
                {c.submission_date && <span className="ml-2">Submitted: {new Date(c.submission_date).toLocaleDateString()}</span>}
              </div>
              {c.denial_reason && <p className="text-xs text-red-400 mt-1">{c.denial_reason}</p>}
            </div>
          ))}

          {tab === 'Claims' && drchronoData.map((d: any, i: number) => (
            <div key={`dc-${i}`} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">{d.description || d.procedure_code || 'DrChrono Line Item'}</span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400">DrChrono</span>
              </div>
              {d.total && <div className="text-xs text-gray-400 mt-1">${parseFloat(d.total).toFixed(2)}</div>}
            </div>
          ))}

          {tab === 'Payments' && <div className="text-center py-8 text-xs text-gray-500">Payment history loads from billing API</div>}
          {tab === 'Insurance' && <div className="text-center py-8 text-xs text-gray-500">Insurance details loads from insurance API</div>}
        </div>
      </div>
    </PanelBase>
  )
}
