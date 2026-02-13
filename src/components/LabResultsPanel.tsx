'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import { FlaskConical, Loader2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react'

interface LabResultsPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName?: string
}

interface LabOrder {
  id: number
  drchrono_lab_order_id: number
  drchrono_patient_id: number
  requisition_id: string | null
  status: string | null
  vendor: string | null
  order_date: string | null
}

interface LabResult {
  id: number
  drchrono_lab_result_id: number
  drchrono_patient_id: number
  drchrono_lab_order_id: number | null
  test_name: string
  value: string | null
  unit: string | null
  normal_range: string | null
  abnormal_flag: string | null
  observation_date: string | null
}

export default function LabResultsPanel({ isOpen, onClose, patientId, patientName }: LabResultsPanelProps) {
  const [orders, setOrders] = useState<LabOrder[]>([])
  const [results, setResults] = useState<LabResult[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null)
  const [view, setView] = useState<'results' | 'orders'>('results')

  const fetchData = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const [ordersRes, resultsRes] = await Promise.all([
        supabase.from('drchrono_lab_orders').select('*').eq('drchrono_patient_id', patientId).order('order_date', { ascending: false }),
        supabase.from('drchrono_lab_results').select('*').eq('drchrono_patient_id', patientId).order('observation_date', { ascending: false }),
      ])
      if (ordersRes.data) setOrders(ordersRes.data as unknown as LabOrder[])
      if (resultsRes.data) setResults(resultsRes.data as unknown as LabResult[])
    } catch (err) {
      console.error('Error fetching lab data:', err)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen, fetchData])

  const getAbnormalColor = (flag: string | null) => {
    if (!flag || flag === 'N' || flag === 'normal') return 'text-green-400'
    if (flag === 'H' || flag === 'high' || flag === 'HH') return 'text-red-400'
    if (flag === 'L' || flag === 'low' || flag === 'LL') return 'text-orange-400'
    return 'text-yellow-400'
  }

  const abnormalCount = results.filter(r => r.abnormal_flag && r.abnormal_flag !== 'N' && r.abnormal_flag !== 'normal').length

  return (
    <DraggableOverlayWrapper
      panelId="lab-results"
      isOpen={isOpen}
      onClose={onClose}
      title="Lab Results"
      subtitle={patientName ? `${patientName} • ${results.length} results, ${orders.length} orders` : undefined}
      icon={<FlaskConical className="w-4 h-4" />}
      defaultTheme="cyan"
      defaultWidth={580}
    >
      <div className="p-4 space-y-3">
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          <button onClick={() => setView('results')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'results' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
            Results ({results.length}){abnormalCount > 0 && <span className="ml-1 text-red-400">⚠ {abnormalCount}</span>}
          </button>
          <button onClick={() => setView('orders')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'orders' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
            Orders ({orders.length})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>
        ) : view === 'results' ? (
          results.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">No lab results found</div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] text-white/30 uppercase tracking-wider font-bold">
                <div className="col-span-4">Test</div>
                <div className="col-span-2">Value</div>
                <div className="col-span-2">Range</div>
                <div className="col-span-2">Flag</div>
                <div className="col-span-2">Date</div>
              </div>
              {results.map(result => (
                <div key={result.id} className="grid grid-cols-12 gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors items-center">
                  <div className="col-span-4 text-xs text-white font-medium truncate" title={result.test_name}>{result.test_name}</div>
                  <div className={`col-span-2 text-xs font-mono ${getAbnormalColor(result.abnormal_flag)}`}>
                    {result.value || '—'}{result.unit ? ` ${result.unit}` : ''}
                  </div>
                  <div className="col-span-2 text-[10px] text-white/40 font-mono">{result.normal_range || '—'}</div>
                  <div className="col-span-2">
                    {result.abnormal_flag && result.abnormal_flag !== 'N' && result.abnormal_flag !== 'normal' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="w-2.5 h-2.5" />{result.abnormal_flag}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-green-400">
                        <CheckCircle className="w-2.5 h-2.5" />Normal
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 text-[10px] text-white/40">{result.observation_date ? new Date(result.observation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</div>
                </div>
              ))}
            </div>
          )
        ) : (
          orders.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">No lab orders found</div>
          ) : (
            <div className="space-y-2">
              {orders.map(order => {
                const isExpanded = expandedOrder === order.id
                const orderResults = results.filter(r => r.drchrono_lab_order_id === order.drchrono_lab_order_id)
                return (
                  <div key={order.id} className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                    <button
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-white/40" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
                        <span className="text-xs font-medium text-white">{order.vendor || 'Lab Order'}</span>
                        {order.requisition_id && <span className="text-[10px] text-white/30">#{order.requisition_id}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          order.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                          order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-white/10 text-white/50'
                        }`}>{order.status || 'unknown'}</span>
                        <span className="text-[10px] text-white/30">{order.order_date || ''}</span>
                        <span className="text-[10px] text-white/20">{orderResults.length} results</span>
                      </div>
                    </button>
                    {isExpanded && orderResults.length > 0 && (
                      <div className="px-3 pb-3 border-t border-white/5 pt-2 space-y-1">
                        {orderResults.map(r => (
                          <div key={r.id} className="flex items-center justify-between px-2 py-1.5 bg-white/5 rounded">
                            <span className="text-xs text-white/80">{r.test_name}</span>
                            <span className={`text-xs font-mono ${getAbnormalColor(r.abnormal_flag)}`}>
                              {r.value || '—'}{r.unit ? ` ${r.unit}` : ''} {r.normal_range ? `(${r.normal_range})` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </DraggableOverlayWrapper>
  )
}
