'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  ArrowRightLeft, Plus, Search, RefreshCw, ArrowLeft, X, Clock,
  CheckCircle, XCircle, Send, MapPin, Phone, User, FileText,
  Calendar, BookOpen, ChevronRight, Star, AlertCircle, TrendingUp
} from 'lucide-react'

interface Referral {
  id: string; patient_id: string; direction: string; status: string; priority: string;
  referred_to_name: string | null; referred_to_specialty: string | null; referred_to_phone: string | null;
  referred_from_name: string | null; reason: string; diagnosis_codes: string[] | null;
  clinical_notes: string | null; insurance_auth_required: boolean; insurance_auth_number: string | null;
  follow_up_date: string | null; completed_date: string | null; created_at: string;
  patients?: { first_name: string; last_name: string } | null;
}

interface Specialist {
  id: string; name: string; specialty: string | null; phone: string | null; fax: string | null;
  email: string | null; address: string | null; city: string | null; state: string | null;
  accepts_medicaid: boolean; accepts_medicare: boolean; is_preferred: boolean;
}

type RefTab = 'outgoing' | 'incoming' | 'new' | 'directory' | 'analytics'

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  draft: { color: 'text-gray-400', bg: 'bg-gray-500/15' },
  sent: { color: 'text-blue-400', bg: 'bg-blue-500/15' },
  received: { color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  scheduled: { color: 'text-amber-400', bg: 'bg-amber-500/15' },
  completed: { color: 'text-green-400', bg: 'bg-green-500/15' },
  cancelled: { color: 'text-red-400', bg: 'bg-red-500/15' },
  expired: { color: 'text-gray-500', bg: 'bg-gray-600/15' },
}

const SPECIALTIES = ['Cardiology','Dermatology','Endocrinology','Gastroenterology','Neurology','Oncology','Ophthalmology','Orthopedics','Psychiatry','Pulmonology','Rheumatology','Urology','OB/GYN','ENT','Allergy/Immunology','Nephrology','Pain Management','Physical Therapy','Podiatry','General Surgery','Radiology']

export default function ReferralsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState('')
  const [activeTab, setActiveTab] = useState<RefTab>('outgoing')
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [specialists, setSpecialists] = useState<Specialist[]>([])
  const [search, setSearch] = useState('')
  const [notif, setNotif] = useState<{ type: string; msg: string } | null>(null)

  // New referral form
  const [refForm, setRefForm] = useState({ patientId: '', toName: '', toSpecialty: '', toPhone: '', toFax: '', reason: '', clinicalNotes: '', priority: 'routine', authRequired: false, authNumber: '', followUpDate: '' })
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [showAddSpecialist, setShowAddSpecialist] = useState(false)
  const [specForm, setSpecForm] = useState({ name: '', specialty: '', phone: '', fax: '', email: '', address: '', city: '', state: '', acceptsMedicaid: false, acceptsMedicare: false, isPreferred: false })

  const showNotif = (type: string, msg: string) => { setNotif({ type, msg }); setTimeout(() => setNotif(null), 4000) }

  useEffect(() => {
    const init = async () => {
      try {
        const authUser = await getCurrentUser()
        if (!authUser?.doctor) { router.push('/login'); return }
        setDoctorId(authUser.doctor.id)
        setDoctorName(`Dr. ${authUser.doctor.first_name || ''} ${authUser.doctor.last_name || ''}`.trim())
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    init()
  }, [router])

  const fetchReferrals = useCallback(async () => {
    if (!doctorId) return
    const { data } = await supabase.from('referrals')
      .select('*, patients(first_name, last_name)')
      .eq('doctor_id', doctorId).order('created_at', { ascending: false }).limit(200)
    if (data) setReferrals(data as any)
  }, [doctorId])

  const fetchSpecialists = useCallback(async () => {
    if (!doctorId) return
    const { data } = await supabase.from('specialist_directory')
      .select('*').eq('doctor_id', doctorId).order('is_preferred', { ascending: false })
    if (data) setSpecialists(data as any)
  }, [doctorId])

  useEffect(() => { if (doctorId) { fetchReferrals(); fetchSpecialists() } }, [doctorId, fetchReferrals, fetchSpecialists])

  useEffect(() => {
    if (!patientSearch.trim() || !doctorId) { setPatientResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('patients').select('id, first_name, last_name, email').eq('doctor_id', doctorId)
        .or(`first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%`).limit(10)
      setPatientResults(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [patientSearch, doctorId])

  const submitReferral = async () => {
    if (!refForm.patientId || !refForm.toName || !refForm.reason || !doctorId) { showNotif('error', 'Patient, specialist, and reason required'); return }
    const { error } = await supabase.from('referrals').insert({
      doctor_id: doctorId, patient_id: refForm.patientId, direction: 'outgoing', status: 'sent',
      priority: refForm.priority, referred_to_name: refForm.toName, referred_to_specialty: refForm.toSpecialty,
      referred_to_phone: refForm.toPhone, referred_to_fax: refForm.toFax, referred_from_name: doctorName,
      reason: refForm.reason, clinical_notes: refForm.clinicalNotes,
      insurance_auth_required: refForm.authRequired, insurance_auth_number: refForm.authNumber || null,
      follow_up_date: refForm.followUpDate || null,
    })
    if (error) { showNotif('error', error.message); return }
    showNotif('success', 'Referral sent')
    setRefForm({ patientId: '', toName: '', toSpecialty: '', toPhone: '', toFax: '', reason: '', clinicalNotes: '', priority: 'routine', authRequired: false, authNumber: '', followUpDate: '' })
    setSelectedPatient(null)
    setActiveTab('outgoing')
    fetchReferrals()
  }

  const updateRefStatus = async (id: string, status: string) => {
    await supabase.from('referrals').update({ status, ...(status === 'completed' ? { completed_date: new Date().toISOString().split('T')[0] } : {}) }).eq('id', id)
    showNotif('success', `Referral marked ${status}`)
    fetchReferrals()
  }

  const addSpecialist = async () => {
    if (!specForm.name || !doctorId) return
    const { error } = await supabase.from('specialist_directory').insert({
      doctor_id: doctorId, name: specForm.name, specialty: specForm.specialty, phone: specForm.phone,
      fax: specForm.fax, email: specForm.email, address: specForm.address, city: specForm.city, state: specForm.state,
      accepts_medicaid: specForm.acceptsMedicaid, accepts_medicare: specForm.acceptsMedicare, is_preferred: specForm.isPreferred,
    })
    if (error) { showNotif('error', error.message); return }
    showNotif('success', 'Specialist added')
    setShowAddSpecialist(false)
    setSpecForm({ name: '', specialty: '', phone: '', fax: '', email: '', address: '', city: '', state: '', acceptsMedicaid: false, acceptsMedicare: false, isPreferred: false })
    fetchSpecialists()
  }

  const outgoing = useMemo(() => referrals.filter(r => r.direction === 'outgoing'), [referrals])
  const incoming = useMemo(() => referrals.filter(r => r.direction === 'incoming'), [referrals])
  const stats = useMemo(() => ({ outgoing: outgoing.length, incoming: incoming.length, pending: referrals.filter(r => r.status === 'sent' || r.status === 'received').length, completed: referrals.filter(r => r.status === 'completed').length }), [referrals, outgoing, incoming])

  if (loading) return <div className="min-h-screen bg-[#0a1f1f] flex items-center justify-center"><RefreshCw className="w-8 h-8 text-teal-400 animate-spin" /></div>

  const renderReferralCard = (ref: Referral) => {
    const sc = STATUS_CONFIG[ref.status] || STATUS_CONFIG.draft
    return (
      <div key={ref.id} className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${sc.bg} ${sc.color}`}>{ref.status}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] ${ref.priority === 'stat' ? 'bg-red-500/20 text-red-400' : ref.priority === 'urgent' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/15 text-gray-400'}`}>{ref.priority}</span>
              {ref.insurance_auth_required && <span className="text-[9px] text-amber-400">AUTH REQ</span>}
            </div>
            <p className="text-sm font-medium text-white">{ref.patients?.first_name} {ref.patients?.last_name}</p>
            <p className="text-[11px] text-gray-300 mt-1">{ref.direction === 'outgoing' ? '→' : '←'} {ref.referred_to_name} {ref.referred_to_specialty ? `(${ref.referred_to_specialty})` : ''}</p>
            <p className="text-[10px] text-gray-400 mt-1">{ref.reason}</p>
            <p className="text-[9px] text-gray-500 mt-1">{new Date(ref.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex flex-col space-y-1 ml-3">
            {(ref.status === 'sent' || ref.status === 'received') && (
              <button onClick={() => updateRefStatus(ref.id, 'scheduled')} className="px-2 py-1 rounded text-[10px] font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600/40">Scheduled</button>
            )}
            {ref.status === 'scheduled' && (
              <button onClick={() => updateRefStatus(ref.id, 'completed')} className="px-2 py-1 rounded text-[10px] font-bold bg-green-600/20 text-green-400 hover:bg-green-600/40">Complete</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a1f1f] overflow-y-auto">
      {notif && <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-xl border ${notif.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-teal-500/20 border-teal-500/30 text-teal-300'}`}>{notif.msg}</div>}

      <div className="bg-[#0d2626] border-b border-[#1a3d3d] px-4 py-3">
        <div className="flex items-center space-x-3">
          <button onClick={() => router.push('/doctor/dashboard')} className="p-1.5 rounded-lg hover:bg-[#1a3d3d] text-gray-400"><ArrowLeft className="w-4 h-4" /></button>
          <h1 className="text-lg font-bold text-white flex items-center space-x-2"><ArrowRightLeft className="w-5 h-5 text-teal-400" /><span>Referrals</span></h1>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-3">
          {[
            { label: 'Outgoing', value: stats.outgoing, color: 'text-blue-400', icon: Send },
            { label: 'Incoming', value: stats.incoming, color: 'text-cyan-400', icon: ArrowRightLeft },
            { label: 'Pending', value: stats.pending, color: 'text-amber-400', icon: Clock },
            { label: 'Completed', value: stats.completed, color: 'text-green-400', icon: CheckCircle },
          ].map(s => (
            <div key={s.label} className="bg-[#0a1f1f] rounded-lg p-3 border border-[#1a3d3d]">
              <div className="flex items-center space-x-2"><s.icon className={`w-4 h-4 ${s.color}`} /><span className={`text-xl font-bold ${s.color}`}>{s.value}</span></div>
              <p className="text-[10px] text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="flex mt-3 space-x-1 overflow-x-auto">
          {([
            { key: 'outgoing' as RefTab, label: 'Outgoing', icon: Send },
            { key: 'incoming' as RefTab, label: 'Incoming', icon: ArrowRightLeft },
            { key: 'new' as RefTab, label: 'New Referral', icon: Plus },
            { key: 'directory' as RefTab, label: 'Directory', icon: BookOpen },
            { key: 'analytics' as RefTab, label: 'Analytics', icon: TrendingUp },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${activeTab === tab.key ? 'bg-teal-600/20 text-teal-400' : 'text-gray-400 hover:text-white hover:bg-[#1a3d3d]'}`}>
              <tab.icon className="w-3.5 h-3.5" /><span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'outgoing' && <div className="space-y-3">{outgoing.length === 0 ? <div className="bg-[#0d2626] rounded-lg p-8 text-center text-xs text-gray-500 border border-[#1a3d3d]">No outgoing referrals</div> : outgoing.map(renderReferralCard)}</div>}
        {activeTab === 'incoming' && <div className="space-y-3">{incoming.length === 0 ? <div className="bg-[#0d2626] rounded-lg p-8 text-center text-xs text-gray-500 border border-[#1a3d3d]">No incoming referrals</div> : incoming.map(renderReferralCard)}</div>}

        {activeTab === 'new' && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-sm font-bold text-white">New Referral</h2>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Patient <span className="text-red-400">*</span></label>
              {selectedPatient ? (
                <div className="flex items-center space-x-2 bg-teal-600/10 border border-teal-500/30 rounded-lg px-3 py-2">
                  <span className="text-sm text-white">{selectedPatient.first_name} {selectedPatient.last_name}</span>
                  <button onClick={() => { setSelectedPatient(null); setRefForm(p => ({ ...p, patientId: '' })) }} className="ml-auto text-gray-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="relative">
                  <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Search patient..."
                    className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
                  {patientResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d2626] border border-[#1a3d3d] rounded-lg z-10 max-h-40 overflow-y-auto">
                    {patientResults.map(p => <button key={p.id} onClick={() => { setSelectedPatient(p); setRefForm(prev => ({ ...prev, patientId: p.id })); setPatientSearch(''); setPatientResults([]) }} className="w-full text-left px-3 py-2 hover:bg-[#1a3d3d] text-xs text-white border-b border-[#1a3d3d]/50">{p.first_name} {p.last_name}</button>)}
                  </div>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-400 mb-1 block">Specialist Name <span className="text-red-400">*</span></label>
                <select value={refForm.toName} onChange={e => { const spec = specialists.find(s => s.name === e.target.value); setRefForm(p => ({ ...p, toName: e.target.value, toSpecialty: spec?.specialty || '', toPhone: spec?.phone || '', toFax: spec?.fax || '' })) }}
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white">
                  <option value="">Select or type...</option>
                  {specialists.map(s => <option key={s.id} value={s.name}>{s.name} — {s.specialty}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-gray-400 mb-1 block">Specialty</label>
                <select value={refForm.toSpecialty} onChange={e => setRefForm(p => ({ ...p, toSpecialty: e.target.value }))}
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white">
                  <option value="">Select</option>{SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div><label className="text-xs text-gray-400 mb-1 block">Reason for Referral <span className="text-red-400">*</span></label>
              <textarea value={refForm.reason} onChange={e => setRefForm(p => ({ ...p, reason: e.target.value }))} rows={2} placeholder="Reason..."
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none resize-none" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Clinical Notes</label>
              <textarea value={refForm.clinicalNotes} onChange={e => setRefForm(p => ({ ...p, clinicalNotes: e.target.value }))} rows={2} placeholder="Clinical details..."
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none resize-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-400 mb-1 block">Priority</label>
                <select value={refForm.priority} onChange={e => setRefForm(p => ({ ...p, priority: e.target.value }))} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white">
                  <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
                </select></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Follow-up Date</label>
                <input type="date" value={refForm.followUpDate} onChange={e => setRefForm(p => ({ ...p, followUpDate: e.target.value }))} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white" /></div>
            </div>
            <label className="flex items-center space-x-2 text-xs text-gray-300">
              <input type="checkbox" checked={refForm.authRequired} onChange={e => setRefForm(p => ({ ...p, authRequired: e.target.checked }))} />
              <span>Prior Authorization Required</span>
            </label>
            {refForm.authRequired && <input value={refForm.authNumber} onChange={e => setRefForm(p => ({ ...p, authNumber: e.target.value }))} placeholder="Auth number" className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />}
            <button onClick={submitReferral} disabled={!refForm.patientId || !refForm.toName || !refForm.reason}
              className="w-full py-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm disabled:opacity-50">Send Referral</button>
          </div>
        )}

        {activeTab === 'directory' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Specialist Directory ({specialists.length})</h2>
              <button onClick={() => setShowAddSpecialist(true)} className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center space-x-1.5"><Plus className="w-3.5 h-3.5" /><span>Add</span></button>
            </div>
            {specialists.map(s => (
              <div key={s.id} className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
                <p className="text-sm font-bold text-white flex items-center space-x-2"><User className="w-4 h-4 text-teal-400" /><span>{s.name}</span>{s.is_preferred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}</p>
                {s.specialty && <span className="px-1.5 py-0.5 bg-[#1a3d3d] rounded text-[9px] text-gray-300">{s.specialty}</span>}
                {s.phone && <p className="text-[11px] text-gray-400 mt-1"><Phone className="w-3 h-3 inline mr-1" />{s.phone}</p>}
                {s.address && <p className="text-[11px] text-gray-400"><MapPin className="w-3 h-3 inline mr-1" />{s.address}{s.city ? `, ${s.city}, ${s.state}` : ''}</p>}
                <div className="flex space-x-2 mt-2">
                  {s.accepts_medicare && <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">Medicare</span>}
                  {s.accepts_medicaid && <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">Medicaid</span>}
                </div>
                <button onClick={() => { setRefForm(p => ({ ...p, toName: s.name, toSpecialty: s.specialty || '', toPhone: s.phone || '', toFax: s.fax || '' })); setActiveTab('new') }}
                  className="mt-2 text-[10px] text-teal-400 hover:underline">Create referral →</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white">Referral Analytics</h2>
            <div className="bg-[#0d2626] rounded-lg p-6 text-center border border-[#1a3d3d] border-dashed">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              <p className="text-xs text-gray-500">Analytics will show referral patterns, top specialists, completion rates, and turnaround times</p>
              <p className="text-[10px] text-gray-600 mt-1">AI-powered referral optimization coming soon</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Specialist Modal */}
      {showAddSpecialist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl w-full max-w-md p-6 space-y-3 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold text-white">Add Specialist</h3><button onClick={() => setShowAddSpecialist(false)} className="text-gray-400"><X className="w-5 h-5" /></button></div>
            <input value={specForm.name} onChange={e => setSpecForm(p => ({ ...p, name: e.target.value }))} placeholder="Name *" className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />
            <select value={specForm.specialty} onChange={e => setSpecForm(p => ({ ...p, specialty: e.target.value }))} className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white"><option value="">Specialty</option>{SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <div className="grid grid-cols-2 gap-3">
              <input value={specForm.phone} onChange={e => setSpecForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />
              <input value={specForm.fax} onChange={e => setSpecForm(p => ({ ...p, fax: e.target.value }))} placeholder="Fax" className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />
            </div>
            <input value={specForm.email} onChange={e => setSpecForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />
            <input value={specForm.address} onChange={e => setSpecForm(p => ({ ...p, address: e.target.value }))} placeholder="Address" className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />
            <div className="flex space-x-4">
              <label className="flex items-center space-x-1.5 text-xs text-gray-300"><input type="checkbox" checked={specForm.acceptsMedicare} onChange={e => setSpecForm(p => ({ ...p, acceptsMedicare: e.target.checked }))} /><span>Medicare</span></label>
              <label className="flex items-center space-x-1.5 text-xs text-gray-300"><input type="checkbox" checked={specForm.acceptsMedicaid} onChange={e => setSpecForm(p => ({ ...p, acceptsMedicaid: e.target.checked }))} /><span>Medicaid</span></label>
              <label className="flex items-center space-x-1.5 text-xs text-gray-300"><input type="checkbox" checked={specForm.isPreferred} onChange={e => setSpecForm(p => ({ ...p, isPreferred: e.target.checked }))} /><span>Preferred</span></label>
            </div>
            <div className="flex space-x-3 pt-2">
              <button onClick={() => setShowAddSpecialist(false)} className="flex-1 py-2 rounded-lg border border-[#1a3d3d] text-gray-400 text-sm">Cancel</button>
              <button onClick={addSpecialist} disabled={!specForm.name} className="flex-1 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold disabled:opacity-50">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
