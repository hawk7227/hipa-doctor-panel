// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import { DollarSign, Loader2, Receipt } from 'lucide-react'

interface BillingPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName?: string
}

interface LineItem {
  id: number
  drchrono_patient_id: number
  procedure_code: string | null
  description: string | null
  diagnosis_pointers: string[] | null
  units: number | null
  charge: number | null
  allowed: number | null
  balance: number | null
  paid: number | null
  adjustment: number | null
  service_date: string | null
  billing_status: string | null
  insurance_status: string | null
  posted_date: string | null
}

export default function BillingPanel({ isOpen, onClose, patientId, patientName }: BillingPanelProps) {
  const [items, setItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('drchrono_line_items')
        .select('*')
        .eq('drchrono_patient_id', patientId)
        .order('service_date', { ascending: false })
      if (error) {
        console.log('drchrono_line_items query:', error.message)
        setItems([])
      } else {
        setItems(data || [])
      }
    } catch (err) {
      console.error('Error fetching billing:', err)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen, fetchData])

  const totalCharged = items.reduce((sum, i) => sum + (i.charge || 0), 0)
  const totalPaid = items.reduce((sum, i) => sum + (i.paid || 0), 0)
  const totalBalance = items.reduce((sum, i) => sum + (i.balance || 0), 0)

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '—'
    return `$${val.toFixed(2)}`
  }

  return (
    <DraggableOverlayWrapper
      panelId="billing"
      isOpen={isOpen}
      onClose={onClose}
      title="Billing & Claims"
      subtitle={patientName ? `${patientName} • ${items.length} line items` : undefined}
      icon={<DollarSign className="w-4 h-4" />}
      defaultTheme="emerald"
      defaultWidth={620}
    >
      <div className="p-4 space-y-3">
        {/* Summary cards */}
        {items.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 rounded-xl border border-white/5 p-3 text-center">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Charged</div>
              <div className="text-lg font-bold text-white mt-0.5">{formatCurrency(totalCharged)}</div>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/5 p-3 text-center">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Paid</div>
              <div className="text-lg font-bold text-green-400 mt-0.5">{formatCurrency(totalPaid)}</div>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/5 p-3 text-center">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Balance</div>
              <div className={`text-lg font-bold mt-0.5 ${totalBalance > 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(totalBalance)}</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-sm">
            <Receipt className="w-8 h-8 mx-auto mb-2 text-white/20" />
            No billing records found
          </div>
        ) : (
          <div className="space-y-1">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] text-white/30 uppercase tracking-wider font-bold">
              <div className="col-span-2">Date</div>
              <div className="col-span-2">CPT</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-1 text-right">Charge</div>
              <div className="col-span-1 text-right">Paid</div>
              <div className="col-span-1 text-right">Balance</div>
              <div className="col-span-2">Status</div>
            </div>
            {items.map(item => (
              <div key={item.id} className="grid grid-cols-12 gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors items-center text-xs">
                <div className="col-span-2 text-white/50">{item.service_date ? new Date(item.service_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</div>
                <div className="col-span-2 font-mono text-white/70">{item.procedure_code || '—'}</div>
                <div className="col-span-3 text-white/60 truncate" title={item.description || ''}>{item.description || '—'}</div>
                <div className="col-span-1 text-right text-white/70">{formatCurrency(item.charge)}</div>
                <div className="col-span-1 text-right text-green-400">{formatCurrency(item.paid)}</div>
                <div className={`col-span-1 text-right ${(item.balance || 0) > 0 ? 'text-red-400' : 'text-white/50'}`}>{formatCurrency(item.balance)}</div>
                <div className="col-span-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    item.billing_status === 'paid' ? 'bg-green-500/20 text-green-300' :
                    item.billing_status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                    item.billing_status === 'denied' ? 'bg-red-500/20 text-red-300' :
                    'bg-white/10 text-white/50'
                  }`}>{item.billing_status || 'unknown'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DraggableOverlayWrapper>
  )
}
