// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { ShieldCheck, Plus, Search, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, Phone, FileText, ChevronRight, X, Calendar, Building2, Send } from 'lucide-react'

interface PriorAuth {
  id: string; patient_id: string; auth_type: string; service_description: string
  cpt_codes: string[] | null; icd10_codes: string[] | null
  payer_name: string | null; auth_number: string | null; status: string
  submitted_at: string | null; approved_at: string | null; denied_at: string | null
  effective_date: string | null; expiration_date: string | null
  approved_units: number | null; used_units: number; denial_reason: string | null
  appeal_deadline: string | null; notes: string | null; created_at: string
  patients?: { first_name: string; last_name: string } | null
}

const STATUS_COLORS: Record<string, string> = { pending: 'bg-amber-600/20 text-amber-400 border-amber-500/30', submitted: 'bg-blue-600/20 text-blue-400 border-blue-500/30', approved: 'bg-green-600/20 text-green-400 border-green-500/30', denied: 'bg-red-600/20 text-red-400 border-red-500/30', expired: 'bg-gray-600/20 text-gray-400 border-gray-500/30' }
const INP = "w-full px-2.5 py-1.5 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—'

export default function PriorAuthPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [auths, setAuths] = useState<PriorAuth[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    const init = async () => {
      try { const au = await getCurrentUser(); if (!au?.doctor?.id) { router.push('/login'); return }; setDoctorId(au.doctor.id); await fetchAuths(au.doctor.id) } catch { router.push('/login') }
    }; init()
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAuths = useCallback(async (docId: string) => {
    setLoading(true); setError(null)
    try {
      const { data, error: e } = await supabase.from('prior_authorizations').select('*, patients(first_name, last_name)').eq('doctor_id', docId).order('created_at', { ascending: false }).limit(200)
      if (e) throw e
      setAuths((data || []).map((a: any) => ({ ...a, patients: Array.isArray(a.patients) ? a.patients[0] : a.patients })) as PriorAuth[])
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [])

  const updateStatus = async (id: string, status: string) => {
    if (!doctorId) return
    try {
      const u: any = { status }
      if (status === 'submitted') u.submitted_at = new Date().toISOString()
      if (status === 'approved') u.approved_at = new Date().toISOString()
      if (status === 'denied') u.denied_at = new Date().toISOString()
      const { error: e } = await supabase.from('prior_authorizations').update(u).eq('id', id)
      if (e) throw e
      setSuccess(`Auth ${status}`); setTimeout(() => setSuccess(null), 3000)
      await fetchAuths(doctorId)
    } catch (e: any) { setError(e.message) }
  }

  const createAuth = async (data: any) => {
    if (!doctorId) return
    try {
      const { error: e } = await supabase.from('prior_authorizations').insert({ ...data, doctor_id: doctorId })
      if (e) throw e
      setSuccess('Prior auth created'); setShowNew(false); setTimeout(() => setSuccess(null), 3000)
      await fetchAuths(doctorId)
    } catch (e: any) { setError(e.message) }
  }

  const filtered = useMemo(() => {
    let list = auths
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter)
    if (search) { const q = search.toLowerCase(); list = list.filter(a => a.service_description.toLowerCase().includes(q) || a.payer_name?.toLowerCase().includes(q) || a.patients?.first_name?.toLowerCase().includes(q) || a.patients?.last_name?.toLowerCase().includes(q)) }
    return list
  }, [auths, statusFilter, search])

  const pending = auths.filter(a => a.status === 'pending' || a.status === 'submitted').length
  const expiringSoon = auths.filter(a => a.status === 'approved' && a.expiration_date && new Date(a.expiration_date) < new Date(Date.now() + 30 * 86400000)).length

  if (loading) return <div className="min-h-screen bg-[#030f0f] flex items-center justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      <div className="sticky top-0 z-20 bg-[#030f0f]/95 backdrop-blur-sm border-b border-[#1a3d3d]/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-emerald-400" /><div><h1 className="text-lg font-bold">Prior Authorizations</h1><p className="text-xs text-gray-500">{pending} pending{expiringSoon > 0 ? ` • ${expiringSoon} expiring soon` : ''}</p></div></div>
          <button onClick={() => doctorId && fetchAuths(doctorId)} className="p-2 hover:bg-[#0a1f1f] rounded-lg"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search authorizations..." className={`${INP} pl-8`} /></div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${INP} w-auto`}><option value="all">All Status</option>{['pending','submitted','approved','denied','expired'].map(s => <option key={s} value={s}>{s}</option>)}</select>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs hover:bg-emerald-600/30 whitespace-nowrap"><Plus className="w-3.5 h-3.5" />New Auth</button>
        </div>
      </div>

      {error && <div className="mx-4 mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}<button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button></div>}
      {success && <div className="mx-4 mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-xs text-green-400 flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}

      <div className="p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16"><ShieldCheck className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400 text-sm">No prior authorizations found</p></div>
        ) : (
          <div className="space-y-2">{filtered.map(a => (
            <div key={a.id} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3 hover:border-[#1a3d3d] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : 'Patient'}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${STATUS_COLORS[a.status] || STATUS_COLORS.pending}`}>{a.status}</span>
                    {a.auth_number && <span className="text-[10px] text-gray-500 font-mono">#{a.auth_number}</span>}
                  </div>
                  <div className="text-[11px] text-gray-300 mt-1">{a.service_description}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                    {a.payer_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{a.payer_name}</span>}
                    <span>{a.auth_type}</span>
                    {a.effective_date && <span>Eff: {fmtDate(a.effective_date)}</span>}
                    {a.expiration_date && <span>Exp: {fmtDate(a.expiration_date)}</span>}
                    {a.approved_units && <span>Units: {a.used_units}/{a.approved_units}</span>}
                  </div>
                  {a.denial_reason && <div className="text-[11px] text-red-400 mt-1">Denial: {a.denial_reason}</div>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#1a3d3d]/30">
                {a.status === 'pending' && <button onClick={() => updateStatus(a.id, 'submitted')} className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-cyan-400 hover:bg-cyan-600/10"><Send className="w-3 h-3" />Submit</button>}
                {a.status === 'submitted' && <><button onClick={() => updateStatus(a.id, 'approved')} className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-green-400 hover:bg-green-600/10"><CheckCircle className="w-3 h-3" />Approved</button><button onClick={() => updateStatus(a.id, 'denied')} className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-red-400 hover:bg-red-600/10"><XCircle className="w-3 h-3" />Denied</button></>}
                {a.denial_reason && a.appeal_deadline && <span className="text-[10px] text-red-400 ml-auto">Appeal by: {fmtDate(a.appeal_deadline)}</span>}
              </div>
            </div>
          ))}</div>
        )}
      </div>

      {showNew && <NewAuthModal doctorId={doctorId!} onSave={createAuth} onClose={() => setShowNew(false)} />}
    </div>
  )
}

function NewAuthModal({ doctorId, onSave, onClose }: { doctorId: string; onSave: (d: any) => void; onClose: () => void }) {
  const [pts, setPts] = useState<any[]>([])
  const [f, setF] = useState({ patient_id: '', auth_type: 'procedure', service_description: '', payer_name: '', cpt_codes: '', icd10_codes: '', notes: '' })
  useEffect(() => { supabase.from('patients').select('id,first_name,last_name').eq('doctor_id', doctorId).order('last_name').then(({ data }) => setPts(data || [])) }, [doctorId])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}><div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-5 w-full max-w-lg space-y-3" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold">New Prior Authorization</h3><button onClick={onClose}><X className="w-4 h-4 text-gray-500 hover:text-white" /></button></div>
      <div><label className="block text-[11px] text-gray-400 mb-1">Patient *</label><select value={f.patient_id} onChange={e => setF({...f, patient_id: e.target.value})} className={INP}><option value="">Select...</option>{pts.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-[11px] text-gray-400 mb-1">Type</label><select value={f.auth_type} onChange={e => setF({...f, auth_type: e.target.value})} className={INP}><option value="procedure">Procedure</option><option value="medication">Medication</option><option value="imaging">Imaging</option><option value="dme">DME</option><option value="referral">Referral</option></select></div>
        <div><label className="block text-[11px] text-gray-400 mb-1">Payer</label><input value={f.payer_name} onChange={e => setF({...f, payer_name: e.target.value})} className={INP} placeholder="Insurance company" /></div>
      </div>
      <div><label className="block text-[11px] text-gray-400 mb-1">Service Description *</label><input value={f.service_description} onChange={e => setF({...f, service_description: e.target.value})} className={INP} placeholder="MRI Lumbar Spine" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-[11px] text-gray-400 mb-1">CPT Codes</label><input value={f.cpt_codes} onChange={e => setF({...f, cpt_codes: e.target.value})} className={INP} placeholder="72148, 72149" /></div>
        <div><label className="block text-[11px] text-gray-400 mb-1">ICD-10 Codes</label><input value={f.icd10_codes} onChange={e => setF({...f, icd10_codes: e.target.value})} className={INP} placeholder="M54.5, G89.29" /></div>
      </div>
      <div><label className="block text-[11px] text-gray-400 mb-1">Notes</label><textarea value={f.notes} onChange={e => setF({...f, notes: e.target.value})} className={`${INP} h-16 resize-none`} /></div>
      <div className="flex justify-end gap-2 pt-1"><button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400">Cancel</button><button onClick={() => { if (f.patient_id && f.service_description) onSave({ ...f, status: 'pending', cpt_codes: f.cpt_codes ? f.cpt_codes.split(',').map(c => c.trim()) : null, icd10_codes: f.icd10_codes ? f.icd10_codes.split(',').map(c => c.trim()) : null }) }} disabled={!f.patient_id || !f.service_description} className="px-4 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40">Create</button></div>
    </div></div>
  )
}
