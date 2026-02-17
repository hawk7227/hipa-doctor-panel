// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'
import React, { useState, useMemo } from 'react'
import { FlaskConical, Plus, Pencil, AlertTriangle, CheckCircle, Clock, Eye, Bell, FileText, Filter } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Results', 'Orders', 'Review Queue'] as const
const INTERP_COLORS: Record<string, string> = {
  normal: 'text-green-400', abnormal: 'text-red-400', critical: 'text-red-500 font-bold',
  high: 'text-amber-400', low: 'text-blue-400', positive: 'text-red-400', negative: 'text-green-400',
}

export default function LabResultsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data: results, drchronoData, loading, error, refetch, create, update } = usePanelData({ endpoint: 'lab-results', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Results')
  const [showAdd, setShowAdd] = useState(false)
  const [orderForm, setOrderForm] = useState({ lab_name: '', lab_type: 'labcorp', tests: '', priority: 'routine', fasting_required: false, special_instructions: '', notes: '' })

  const allResults = useMemo(() => {
    const dc = (drchronoData || []).map((d: any) => ({ ...d, _source: 'drchrono', test_name: d.test_name || d.name || 'Unknown' }))
    return [...(results || []), ...dc].sort((a: any, b: any) => new Date(b.resulted_at || b.created_at).getTime() - new Date(a.resulted_at || a.created_at).getTime())
  }, [results, drchronoData])

  const needsReview = allResults.filter((r: any) => !r.reviewed_by && r.status === 'final')
  const abnormalCount = allResults.filter((r: any) => r.is_abnormal || r.is_critical).length

  const handleOrderSubmit = async () => {
    if (!orderForm.lab_name || !orderForm.tests) return
    await create({ _type: 'order', patient_id: patientId, lab_name: orderForm.lab_name, lab_type: orderForm.lab_type,
      tests: orderForm.tests.split(',').map((t: string) => ({ name: t.trim() })),
      priority: orderForm.priority, fasting_required: orderForm.fasting_required,
      special_instructions: orderForm.special_instructions, notes: orderForm.notes, status: 'pending' })
    setShowAdd(false)
    setOrderForm({ lab_name: '', lab_type: 'labcorp', tests: '', priority: 'routine', fasting_required: false, special_instructions: '', notes: '' })
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Labs — ${patientName}`} icon={FlaskConical} accentColor="#8b5cf6" loading={loading}
      error={error} hasData={allResults.length > 0 || showAdd} emptyMessage="No lab results"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={needsReview.length > 0 ? `${needsReview.length} to review` : allResults.length || undefined}
      syncStatus={drchronoData.length > 0 ? 'synced' : null}
      headerActions={<button onClick={() => setShowAdd(!showAdd)} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-purple-400 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Review Queue' && needsReview.length > 0 && <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-400 px-1 rounded">{needsReview.length}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* Abnormal Summary */}
          {tab === 'Results' && abnormalCount > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-xs text-red-400 font-medium">{abnormalCount} abnormal result{abnormalCount > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* New Order Form */}
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-purple-400">New Lab Order</div>
              <div className="grid grid-cols-2 gap-2">
                <select value={orderForm.lab_type} onChange={e => setOrderForm({...orderForm, lab_type: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  <option value="labcorp">Labcorp</option><option value="quest">Quest</option><option value="in_house">In-house</option><option value="other">Other</option>
                </select>
                <select value={orderForm.priority} onChange={e => setOrderForm({...orderForm, priority: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
                </select>
              </div>
              <input value={orderForm.lab_name} onChange={e => setOrderForm({...orderForm, lab_name: e.target.value})}
                placeholder="Lab facility name..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <input value={orderForm.tests} onChange={e => setOrderForm({...orderForm, tests: e.target.value})}
                placeholder="Tests (comma-separated): CBC, CMP, Lipid Panel..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={orderForm.fasting_required} onChange={e => setOrderForm({...orderForm, fasting_required: e.target.checked})} /> Fasting required
              </label>
              <textarea value={orderForm.special_instructions} onChange={e => setOrderForm({...orderForm, special_instructions: e.target.value})}
                placeholder="Special instructions..." rows={2} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                <button onClick={handleOrderSubmit} className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500">Submit Order</button>
              </div>
            </div>
          )}

          {/* Results List */}
          {tab === 'Results' && allResults.map((r: any, idx: number) => (
            <div key={r.id || idx} className={`bg-[#0a1f1f] border rounded-lg p-3 ${r.is_critical ? 'border-red-500/50' : r.is_abnormal ? 'border-amber-500/30' : 'border-[#1a3d3d]'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{r.test_name}</span>
                  {r._source === 'drchrono' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>}
                  {r.is_critical && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">CRITICAL</span>}
                </div>
                <span className="text-[10px] text-gray-500">{r.resulted_at ? new Date(r.resulted_at).toLocaleDateString() : ''}</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-lg font-bold ${INTERP_COLORS[r.interpretation] || 'text-white'}`}>{r.value || r.value_numeric}</span>
                {r.unit && <span className="text-xs text-gray-500">{r.unit}</span>}
                {r.reference_range_text && <span className="text-[10px] text-gray-600 ml-2">Ref: {r.reference_range_text}</span>}
                {!r.reference_range_text && r.reference_range_low != null && <span className="text-[10px] text-gray-600 ml-2">Ref: {r.reference_range_low}-{r.reference_range_high}</span>}
              </div>
              {r.interpretation && <span className={`text-xs capitalize ${INTERP_COLORS[r.interpretation] || 'text-gray-400'}`}>{r.interpretation}</span>}
              {!r.reviewed_by && r.status === 'final' && (
                <button onClick={() => update(r.id, { reviewed_by: 'Provider', reviewed_at: new Date().toISOString(), _type: r._source ? undefined : undefined })}
                  className="mt-2 px-2 py-1 text-[10px] bg-amber-500/10 text-amber-400 rounded border border-amber-500/30 hover:bg-amber-500/20">
                  Mark Reviewed
                </button>
              )}
            </div>
          ))}

          {/* Review Queue */}
          {tab === 'Review Queue' && needsReview.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
              <p className="text-sm text-green-400">All results reviewed</p>
            </div>
          )}
          {tab === 'Review Queue' && needsReview.map((r: any, idx: number) => (
            <div key={r.id || idx} className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{r.test_name}</span>
                <span className={`text-sm font-bold ${INTERP_COLORS[r.interpretation] || 'text-white'}`}>{r.value || r.value_numeric} {r.unit}</span>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => update(r.id, { reviewed_by: 'Provider', reviewed_at: new Date().toISOString() })}
                  className="flex-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500">
                  <CheckCircle className="w-3 h-3 inline mr-1" />Reviewed
                </button>
                <button onClick={() => update(r.id, { reviewed_by: 'Provider', reviewed_at: new Date().toISOString(), notified_patient: true, notified_at: new Date().toISOString() })}
                  className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500">
                  <Bell className="w-3 h-3 inline mr-1" />Review & Notify
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PanelBase>
  )
}
