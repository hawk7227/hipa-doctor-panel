// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { BarChart3, RefreshCw, Target, Users, AlertTriangle, CheckCircle, Clock, Plus, Search, X, TrendingUp, Activity, Heart, Shield, ChevronRight, XCircle } from 'lucide-react'

type QTab = 'measures' | 'care_gaps' | 'registries'
interface Measure { id: string; measure_id: string | null; measure_name: string; measure_type: string; description: string | null; target_percentage: number; current_percentage: number; is_active: boolean; last_calculated_at: string | null }
interface CareGap { id: string; patient_id: string; gap_type: string; description: string; priority: string; status: string; due_date: string | null; addressed_at: string | null; patients?: { first_name: string; last_name: string } | null }
interface Registry { id: string; name: string; description: string | null; member_count: number; is_active: boolean; created_at: string }

const INP = "w-full px-2.5 py-1.5 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
const TABS: { key: QTab; label: string; icon: typeof Target }[] = [
  { key: 'measures', label: 'Quality Measures', icon: Target },
  { key: 'care_gaps', label: 'Care Gaps', icon: AlertTriangle },
  { key: 'registries', label: 'Patient Registries', icon: Users },
]
const PRI_COLORS: Record<string, string> = { urgent: 'bg-red-600/20 text-red-400 border-red-500/30', high: 'bg-amber-600/20 text-amber-400 border-amber-500/30', normal: 'bg-blue-600/20 text-blue-400 border-blue-500/30', low: 'bg-gray-600/20 text-gray-400 border-gray-500/30' }
const GAP_COLORS: Record<string, string> = { open: 'bg-red-600/20 text-red-400 border-red-500/30', in_progress: 'bg-amber-600/20 text-amber-400 border-amber-500/30', addressed: 'bg-green-600/20 text-green-400 border-green-500/30', excluded: 'bg-gray-600/20 text-gray-400 border-gray-500/30' }

export default function QualityPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [tab, setTab] = useState<QTab>('measures')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [measures, setMeasures] = useState<Measure[]>([])
  const [careGaps, setCareGaps] = useState<CareGap[]>([])
  const [registries, setRegistries] = useState<Registry[]>([])
  const [showNewMeasure, setShowNewMeasure] = useState(false)
  const [gapFilter, setGapFilter] = useState('open')

  useEffect(() => {
    const init = async () => {
      try { const au = await getCurrentUser(); if (!au?.doctor?.id) { router.push('/login'); return }; setDoctorId(au.doctor.id); await fetchAll(au.doctor.id) } catch { router.push('/login') }
    }; init()
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = useCallback(async (docId: string) => {
    setLoading(true); setError(null)
    try {
      const [mR, gR, rR] = await Promise.all([
        supabase.from('quality_measures').select('*').eq('doctor_id', docId).order('measure_name'),
        supabase.from('care_gaps').select('*, patients(first_name, last_name)').eq('doctor_id', docId).order('created_at', { ascending: false }).limit(100),
        supabase.from('patient_registries').select('*').eq('doctor_id', docId).order('name'),
      ])
      setMeasures((mR.data || []) as Measure[])
      setCareGaps((gR.data || []).map((g: any) => ({ ...g, patients: Array.isArray(g.patients) ? g.patients[0] : g.patients })) as CareGap[])
      setRegistries((rR.data || []) as Registry[])
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [])

  const addressGap = async (id: string) => {
    if (!doctorId) return
    try {
      const { error: e } = await supabase.from('care_gaps').update({ status: 'addressed', addressed_at: new Date().toISOString() }).eq('id', id)
      if (e) throw e
      setSuccess('Care gap addressed'); setTimeout(() => setSuccess(null), 3000)
      await fetchAll(doctorId)
    } catch (e: any) { setError(e.message) }
  }

  const createMeasure = async (data: any) => {
    if (!doctorId) return
    try {
      const { error: e } = await supabase.from('quality_measures').insert({ ...data, doctor_id: doctorId })
      if (e) throw e
      setSuccess('Measure created'); setShowNewMeasure(false); setTimeout(() => setSuccess(null), 3000)
      await fetchAll(doctorId)
    } catch (e: any) { setError(e.message) }
  }

  const filteredGaps = useMemo(() => {
    let g = careGaps
    if (gapFilter !== 'all') g = g.filter(x => x.status === gapFilter)
    if (search) { const q = search.toLowerCase(); g = g.filter(x => x.description.toLowerCase().includes(q) || x.patients?.first_name?.toLowerCase().includes(q) || x.patients?.last_name?.toLowerCase().includes(q)) }
    return g
  }, [careGaps, gapFilter, search])

  // Stats
  const openGaps = careGaps.filter(g => g.status === 'open').length
  const avgPerformance = measures.length > 0 ? Math.round(measures.reduce((s, m) => s + m.current_percentage, 0) / measures.length) : 0
  const meetingTarget = measures.filter(m => m.current_percentage >= m.target_percentage).length

  if (loading) return <div className="min-h-screen bg-[#030f0f] flex items-center justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      <div className="sticky top-0 z-20 bg-[#030f0f]/95 backdrop-blur-sm border-b border-[#1a3d3d]/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><BarChart3 className="w-5 h-5 text-emerald-400" /><div><h1 className="text-lg font-bold">Quality & Population Health</h1><p className="text-xs text-gray-500">MIPS • HEDIS • Care Gap Tracking</p></div></div>
          <button onClick={() => doctorId && fetchAll(doctorId)} className="p-2 hover:bg-[#0a1f1f] rounded-lg"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-2 text-center"><Target className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" /><div className="text-sm font-bold text-emerald-400">{measures.length}</div><div className="text-[10px] text-gray-500">Measures</div></div>
          <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-2 text-center"><TrendingUp className="w-3.5 h-3.5 text-blue-400 mx-auto mb-1" /><div className="text-sm font-bold text-blue-400">{avgPerformance}%</div><div className="text-[10px] text-gray-500">Avg Score</div></div>
          <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-2 text-center"><CheckCircle className="w-3.5 h-3.5 text-green-400 mx-auto mb-1" /><div className="text-sm font-bold text-green-400">{meetingTarget}/{measures.length}</div><div className="text-[10px] text-gray-500">On Target</div></div>
          <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-2 text-center"><AlertTriangle className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1" /><div className="text-sm font-bold text-amber-400">{openGaps}</div><div className="text-[10px] text-gray-500">Open Gaps</div></div>
        </div>
        <div className="flex gap-1 mt-3">
          {TABS.map(t => <button key={t.key} onClick={() => { setTab(t.key); setSearch('') }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${tab === t.key ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-[#0a1f1f]'}`}><t.icon className="w-3.5 h-3.5" />{t.label}</button>)}
        </div>
        {tab === 'care_gaps' && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search care gaps..." className={`${INP} pl-8`} /></div>
            <select value={gapFilter} onChange={e => setGapFilter(e.target.value)} className={`${INP} w-auto`}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="addressed">Addressed</option><option value="all">All</option></select>
          </div>
        )}
        {tab === 'measures' && <div className="flex justify-end mt-2"><button onClick={() => setShowNewMeasure(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs hover:bg-emerald-600/30"><Plus className="w-3.5 h-3.5" />Add Measure</button></div>}
      </div>

      {error && <div className="mx-4 mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}<button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button></div>}
      {success && <div className="mx-4 mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-xs text-green-400 flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}

      <div className="p-4">
        {tab === 'measures' && (
          measures.length === 0 ? <Empty text="No quality measures configured" sub="Add MIPS/HEDIS measures to track performance" /> :
          <div className="space-y-2">{measures.map(m => (
            <div key={m.id} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div><div className="text-sm font-medium">{m.measure_name}</div>{m.measure_id && <span className="text-[10px] text-gray-500 font-mono">{m.measure_id}</span>}{m.description && <div className="text-[11px] text-gray-400 mt-0.5">{m.description}</div>}</div>
                <div className="text-right"><span className={`text-lg font-bold ${m.current_percentage >= m.target_percentage ? 'text-green-400' : m.current_percentage >= m.target_percentage * 0.8 ? 'text-amber-400' : 'text-red-400'}`}>{m.current_percentage}%</span><div className="text-[10px] text-gray-500">Target: {m.target_percentage}%</div></div>
              </div>
              <div className="h-2 bg-[#061818] rounded-full overflow-hidden"><div className={`h-full rounded-full ${m.current_percentage >= m.target_percentage ? 'bg-emerald-500' : m.current_percentage >= m.target_percentage * 0.8 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(m.current_percentage, 100)}%` }} /></div>
              <div className="flex items-center justify-between mt-1"><span className="text-[10px] text-gray-500">{m.measure_type.toUpperCase()}</span>{m.last_calculated_at && <span className="text-[10px] text-gray-500">Updated: {new Date(m.last_calculated_at).toLocaleDateString()}</span>}</div>
            </div>
          ))}</div>
        )}

        {tab === 'care_gaps' && (
          filteredGaps.length === 0 ? <Empty text="No care gaps found" sub={gapFilter === 'open' ? 'All care gaps have been addressed' : 'No gaps match current filters'} /> :
          <div className="space-y-2">{filteredGaps.map(g => (
            <div key={g.id} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="text-sm font-medium">{g.patients ? `${g.patients.first_name} ${g.patients.last_name}` : 'Patient'}</span><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${GAP_COLORS[g.status] || GAP_COLORS.open}`}>{g.status.replace(/_/g, ' ')}</span><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${PRI_COLORS[g.priority] || PRI_COLORS.normal}`}>{g.priority}</span></div>
                  <div className="text-[11px] text-gray-300 mt-1">{g.description}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{g.gap_type.replace(/_/g, ' ')}{g.due_date ? ` • Due: ${new Date(g.due_date).toLocaleDateString()}` : ''}</div>
                </div>
                {g.status === 'open' && <button onClick={() => addressGap(g.id)} className="px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-600/10 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3" />Address</button>}
              </div>
            </div>
          ))}</div>
        )}

        {tab === 'registries' && (
          registries.length === 0 ? <Empty text="No patient registries" sub="Create registries to track patient cohorts" /> :
          <div className="space-y-2">{registries.map(r => (
            <div key={r.id} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3 flex items-center justify-between">
              <div><div className="text-sm font-medium">{r.name}</div>{r.description && <div className="text-[11px] text-gray-400">{r.description}</div>}</div>
              <div className="text-right"><div className="text-sm font-bold text-cyan-400">{r.member_count}</div><div className="text-[10px] text-gray-500">patients</div></div>
            </div>
          ))}</div>
        )}
      </div>

      {showNewMeasure && <MeasureModal onSave={createMeasure} onClose={() => setShowNewMeasure(false)} />}
    </div>
  )
}

function MeasureModal({ onSave, onClose }: { onSave: (d: any) => void; onClose: () => void }) {
  const [f, setF] = useState({ measure_name: '', measure_id: '', measure_type: 'mips', description: '', target_percentage: '90' })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}><div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Add Quality Measure</h3><button onClick={onClose}><X className="w-4 h-4 text-gray-500 hover:text-white" /></button></div>
      <div><label className="block text-[11px] text-gray-400 mb-1">Measure Name *</label><input value={f.measure_name} onChange={e => setF({...f, measure_name: e.target.value})} className={INP} placeholder="Controlling High Blood Pressure" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-[11px] text-gray-400 mb-1">Measure ID</label><input value={f.measure_id} onChange={e => setF({...f, measure_id: e.target.value})} className={INP} placeholder="CMS165v12" /></div>
        <div><label className="block text-[11px] text-gray-400 mb-1">Type</label><select value={f.measure_type} onChange={e => setF({...f, measure_type: e.target.value})} className={INP}><option value="mips">MIPS</option><option value="hedis">HEDIS</option><option value="custom">Custom</option></select></div>
      </div>
      <div><label className="block text-[11px] text-gray-400 mb-1">Target %</label><input type="number" value={f.target_percentage} onChange={e => setF({...f, target_percentage: e.target.value})} className={INP} /></div>
      <div><label className="block text-[11px] text-gray-400 mb-1">Description</label><textarea value={f.description} onChange={e => setF({...f, description: e.target.value})} className={`${INP} h-16 resize-none`} /></div>
      <div className="flex justify-end gap-2 pt-1"><button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400">Cancel</button><button onClick={() => { if (f.measure_name) onSave({...f, target_percentage: parseFloat(f.target_percentage) || 90, current_percentage: 0, is_active: true}) }} disabled={!f.measure_name} className="px-4 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40">Create</button></div>
    </div></div>
  )
}

function Empty({ text, sub }: { text: string; sub: string }) { return <div className="text-center py-16"><Target className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400 text-sm">{text}</p><p className="text-gray-600 text-xs mt-1">{sub}</p></div> }
