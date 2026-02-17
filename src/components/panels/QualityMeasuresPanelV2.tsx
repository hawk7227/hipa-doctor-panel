// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import React, { useState, useMemo } from 'react'
import { BarChart3, Plus, Target, CheckCircle, AlertTriangle, TrendingUp, Award } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['MIPS', 'Care Gaps', 'Performance'] as const
const MEASURE_TYPES = ['quality', 'promoting_interoperability', 'improvement_activities', 'cost'] as const

export default function QualityMeasuresPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch, create, update } = usePanelData({ endpoint: 'quality-measures', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('MIPS')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ measure_id: '', measure_name: '', measure_type: 'quality', reporting_period: '', numerator: false, denominator: true, exclusion: false, exception: false, score: '', notes: '' })

  const measures = useMemo(() => data || [], [data])
  const gaps = measures.filter((m: any) => m.denominator && !m.numerator && !m.exclusion && !m.exception)
  const score = useMemo(() => {
    const scored = measures.filter((m: any) => m.denominator)
    if (scored.length === 0) return 0
    const met = scored.filter((m: any) => m.numerator || m.exclusion || m.exception).length
    return ((met / scored.length) * 100).toFixed(0)
  }, [measures])

  const handleSave = async () => {
    if (!form.measure_name.trim()) return
    await create({ ...form, patient_id: patientId, score: form.score ? parseFloat(form.score) : null })
    setShowAdd(false)
    setForm({ measure_id: '', measure_name: '', measure_type: 'quality', reporting_period: '', numerator: false, denominator: true, exclusion: false, exception: false, score: '', notes: '' })
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Quality Measures — ${patientName}`} icon={BarChart3} accentColor="#10b981" loading={loading}
      error={error} hasData={measures.length > 0 || showAdd} emptyMessage="No quality measures tracked"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={gaps.length > 0 ? `${gaps.length} gaps` : undefined}
      headerActions={<button onClick={() => setShowAdd(!showAdd)} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        {/* Score Banner */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a3d3d] bg-[#0a1f1f]">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400">MIPS Composite</span>
          </div>
          <span className={`text-lg font-bold ${Number(score) >= 75 ? 'text-green-400' : Number(score) >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{score}%</span>
        </div>

        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Care Gaps' && gaps.length > 0 && <span className="ml-1 text-[9px] bg-red-500/20 text-red-400 px-1 rounded">{gaps.length}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <input value={form.measure_name} onChange={e => setForm({...form, measure_name: e.target.value})}
                placeholder="Measure name (e.g., Diabetes A1C Control)..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.measure_id} onChange={e => setForm({...form, measure_id: e.target.value})} placeholder="Measure ID (e.g., CMS122v12)"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <select value={form.measure_type} onChange={e => setForm({...form, measure_type: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  {MEASURE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="flex gap-3 text-xs text-gray-400">
                <label className="flex items-center gap-1"><input type="checkbox" checked={form.numerator} onChange={e => setForm({...form, numerator: e.target.checked})} /> Met (Numerator)</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={form.exclusion} onChange={e => setForm({...form, exclusion: e.target.checked})} /> Exclusion</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={form.exception} onChange={e => setForm({...form, exception: e.target.checked})} /> Exception</label>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                <button onClick={handleSave} className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500">{!form.measure_name.trim() ? 'Add' : 'Save'}</button>
              </div>
            </div>
          )}

          {tab === 'MIPS' && measures.map((m: any) => (
            <div key={m.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                m.numerator || m.exclusion ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                {m.numerator || m.exclusion ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-white">{m.measure_name}</span>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {m.measure_id && <span className="font-mono mr-2">{m.measure_id}</span>}
                  <span className="capitalize">{(m.measure_type || '').replace('_', ' ')}</span>
                  {m.exclusion && <span className="ml-2 text-amber-400">Excluded</span>}
                  {m.exception && <span className="ml-2 text-blue-400">Exception</span>}
                </div>
              </div>
            </div>
          ))}

          {tab === 'Care Gaps' && gaps.length === 0 && (
            <div className="flex flex-col items-center py-8">
              <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
              <p className="text-sm text-green-400">No care gaps identified</p>
            </div>
          )}
          {tab === 'Care Gaps' && gaps.map((m: any) => (
            <div key={m.id} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold text-white">{m.measure_name}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-6">Patient is in denominator but measure not met. Action needed.</p>
              <button onClick={() => update(m.id, { numerator: true })}
                className="mt-2 ml-6 px-2 py-1 text-[10px] bg-green-500/10 text-green-400 rounded border border-green-500/20">Mark as Met</button>
            </div>
          ))}

          {tab === 'Performance' && (
            <div className="space-y-3">
              {MEASURE_TYPES.map(type => {
                const typed = measures.filter((m: any) => m.measure_type === type)
                const met = typed.filter((m: any) => m.numerator || m.exclusion || m.exception).length
                const pct = typed.length > 0 ? ((met / typed.length) * 100).toFixed(0) : '0'
                return (
                  <div key={type} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-white capitalize">{type.replace('_', ' ')}</span>
                      <span className="text-xs text-gray-400">{met}/{typed.length}</span>
                    </div>
                    <div className="w-full bg-[#0d2626] rounded-full h-2">
                      <div className={`h-2 rounded-full ${Number(pct) >= 75 ? 'bg-green-500' : Number(pct) >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">{pct}% performance</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PanelBase>
  )
}
