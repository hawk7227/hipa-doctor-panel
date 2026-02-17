// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  Pill, Plus, Search, RefreshCw, ArrowLeft, X, AlertTriangle,
  Clock, CheckCircle, XCircle, Filter, ChevronRight, Edit3,
  Trash2, RotateCcw, ShieldAlert, Building2, Phone, MapPin,
  Activity, FileText, Star, AlertCircle, TrendingUp, Archive
} from 'lucide-react'

// ═══ TYPES ═══
interface Medication {
  id: string; patient_id: string; medication_name: string; generic_name: string | null;
  dosage: string | null; frequency: string | null; route: string; quantity: number | null;
  refills: number; days_supply: number | null; pharmacy_name: string | null;
  prescriber_name: string | null; status: string; start_date: string | null;
  end_date: string | null; is_controlled: boolean; dea_schedule: string | null;
  sig: string | null; notes: string | null; created_at: string; discontinued_reason: string | null;
  patients?: { first_name: string; last_name: string; email: string; date_of_birth: string | null } | null;
}

interface PrescriptionStats { totalActive: number; totalControlled: number; pendingRefills: number; recentRx: number }
interface Pharmacy { id: string; name: string; npi: string | null; phone: string | null; fax: string | null; address: string | null; city: string | null; state: string | null; zip: string | null; is_preferred: boolean; is_mail_order: boolean }
interface HistoryEntry { id: string; action: string; performed_by: string | null; details: any; created_at: string; medication_id: string | null }
interface Interaction { id: string; drug_a: string; drug_b: string; severity: string | null; description: string | null; acknowledged_by: string | null; created_at: string }

type RxTab = 'active' | 'prescribe' | 'history' | 'pharmacies' | 'interactions'

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: typeof CheckCircle }> = {
  active: { color: 'text-green-400', bg: 'bg-green-500/15', icon: CheckCircle },
  discontinued: { color: 'text-red-400', bg: 'bg-red-500/15', icon: XCircle },
  completed: { color: 'text-gray-400', bg: 'bg-gray-500/15', icon: Archive },
  on_hold: { color: 'text-amber-400', bg: 'bg-amber-500/15', icon: Clock },
}

const FREQUENCIES = ['Once daily','Twice daily','Three times daily','Four times daily','Every morning','Every evening','At bedtime','Every 4 hours','Every 6 hours','Every 8 hours','Every 12 hours','Weekly','As needed (PRN)']
const ROUTES = ['oral','topical','sublingual','inhalation','injection','rectal','ophthalmic','otic','nasal','transdermal','intravenous']

export default function PrescriptionsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState('')
  const [activeTab, setActiveTab] = useState<RxTab>('active')
  const [stats, setStats] = useState<PrescriptionStats>({ totalActive: 0, totalControlled: 0, pendingRefills: 0, recentRx: 0 })

  // Data
  const [medications, setMedications] = useState<Medication[]>([])
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null)

  // Prescribe form
  const [rxForm, setRxForm] = useState({
    patientId: '', medicationName: '', genericName: '', dosage: '', frequency: 'Once daily',
    route: 'oral', quantity: '', refills: '0', daysSupply: '30', pharmacyName: '',
    sig: '', notes: '', isControlled: false, deaSchedule: ''
  })
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(null)

  // Modals
  const [showDiscontinue, setShowDiscontinue] = useState<Medication | null>(null)
  const [discontinueReason, setDiscontinueReason] = useState('')
  const [showPharmacyForm, setShowPharmacyForm] = useState(false)
  const [pharmacyForm, setPharmacyForm] = useState({ name: '', phone: '', fax: '', address: '', city: '', state: '', zip: '', npi: '', isPreferred: false })

  const showNotif = (type: string, message: string) => { setNotification({ type, message }); setTimeout(() => setNotification(null), 4000) }

  // ═══ INIT ═══
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

  // ═══ DATA FETCHING ═══
  const fetchMedications = useCallback(async () => {
    if (!doctorId) return
    const res = await fetch(`/api/prescriptions?action=medications&doctorId=${doctorId}&status=${statusFilter}`)
    const data = await res.json()
    if (data.medications) setMedications(data.medications)
  }, [doctorId, statusFilter])

  const fetchStats = useCallback(async () => {
    if (!doctorId) return
    const res = await fetch(`/api/prescriptions?action=stats&doctorId=${doctorId}`)
    const data = await res.json()
    if (data.stats) setStats(data.stats)
  }, [doctorId])

  const fetchPharmacies = useCallback(async () => {
    if (!doctorId) return
    const res = await fetch(`/api/prescriptions?action=pharmacies&doctorId=${doctorId}`)
    const data = await res.json()
    if (data.pharmacies) setPharmacies(data.pharmacies)
  }, [doctorId])

  useEffect(() => {
    if (!doctorId) return
    fetchMedications()
    fetchStats()
    if (activeTab === 'pharmacies') fetchPharmacies()
  }, [doctorId, activeTab, fetchMedications, fetchStats, fetchPharmacies])

  // ═══ PATIENT SEARCH ═══
  useEffect(() => {
    if (!patientSearch.trim() || !doctorId) { setPatientResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('patients')
        .select('id, first_name, last_name, email, date_of_birth')
        .eq('doctor_id', doctorId)
        .or(`first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%,email.ilike.%${patientSearch}%`)
        .limit(10)
      setPatientResults(data || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [patientSearch, doctorId])

  // ═══ ACTIONS ═══
  const prescribe = async () => {
    if (!rxForm.patientId || !rxForm.medicationName || !doctorId) { showNotif('error', 'Patient and medication required'); return }
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prescribe', doctorId, ...rxForm, quantity: parseInt(rxForm.quantity) || null, refills: parseInt(rxForm.refills) || 0, daysSupply: parseInt(rxForm.daysSupply) || null })
      })
      const data = await res.json()
      if (data.medication) {
        showNotif('success', `${rxForm.medicationName} prescribed successfully`)
        setRxForm({ patientId: '', medicationName: '', genericName: '', dosage: '', frequency: 'Once daily', route: 'oral', quantity: '', refills: '0', daysSupply: '30', pharmacyName: '', sig: '', notes: '', isControlled: false, deaSchedule: '' })
        setSelectedPatient(null)
        setActiveTab('active')
        fetchMedications()
        fetchStats()
      } else { showNotif('error', data.error || 'Failed to prescribe') }
    } catch (err) { showNotif('error', 'Network error') }
  }

  const discontinueMed = async () => {
    if (!showDiscontinue || !doctorId) return
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discontinue', doctorId, medicationId: showDiscontinue.id, reason: discontinueReason, performedBy: doctorName })
      })
      const data = await res.json()
      if (data.medication) { showNotif('success', 'Medication discontinued'); setShowDiscontinue(null); setDiscontinueReason(''); fetchMedications(); fetchStats() }
    } catch (err) { showNotif('error', 'Failed to discontinue') }
  }

  const refillMed = async (medId: string) => {
    if (!doctorId) return
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refill', doctorId, medicationId: medId, performedBy: doctorName })
      })
      const data = await res.json()
      if (data.medication) { showNotif('success', 'Refill processed'); fetchMedications() }
      else { showNotif('error', data.error || 'Failed to refill') }
    } catch (err) { showNotif('error', 'Network error') }
  }

  const addPharmacy = async () => {
    if (!pharmacyForm.name || !doctorId) return
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_pharmacy', doctorId, ...pharmacyForm })
      })
      const data = await res.json()
      if (data.pharmacy) { showNotif('success', 'Pharmacy added'); setShowPharmacyForm(false); setPharmacyForm({ name: '', phone: '', fax: '', address: '', city: '', state: '', zip: '', npi: '', isPreferred: false }); fetchPharmacies() }
    } catch (err) { showNotif('error', 'Failed to add pharmacy') }
  }

  const filteredMeds = useMemo(() => {
    if (!search.trim()) return medications
    const q = search.toLowerCase()
    return medications.filter(m => m.medication_name.toLowerCase().includes(q) || (m.patients?.first_name + ' ' + m.patients?.last_name).toLowerCase().includes(q))
  }, [medications, search])

  if (loading) return <div className="min-h-screen bg-[#0a1f1f] flex items-center justify-center"><RefreshCw className="w-8 h-8 text-teal-400 animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#0a1f1f] overflow-y-auto">
      {notification && <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-xl border ${notification.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-teal-500/20 border-teal-500/30 text-teal-300'}`}>{notification.message}</div>}

      {/* Header */}
      <div className="bg-[#0d2626] border-b border-[#1a3d3d] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => router.push('/doctor/dashboard')} className="p-1.5 rounded-lg hover:bg-[#1a3d3d] text-gray-400"><ArrowLeft className="w-4 h-4" /></button>
            <div><h1 className="text-lg font-bold text-white flex items-center space-x-2"><Pill className="w-5 h-5 text-teal-400" /><span>Prescriptions & Medications</span></h1></div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-3">
          {[
            { label: 'Active Meds', value: stats.totalActive, color: 'text-green-400', icon: CheckCircle },
            { label: 'Controlled', value: stats.totalControlled, color: 'text-red-400', icon: ShieldAlert },
            { label: 'No Refills', value: stats.pendingRefills, color: 'text-amber-400', icon: AlertCircle },
            { label: 'Rx This Month', value: stats.recentRx, color: 'text-blue-400', icon: TrendingUp },
          ].map(s => (
            <div key={s.label} className="bg-[#0a1f1f] rounded-lg p-3 border border-[#1a3d3d]">
              <div className="flex items-center space-x-2"><s.icon className={`w-4 h-4 ${s.color}`} /><span className={`text-xl font-bold ${s.color}`}>{s.value}</span></div>
              <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Sub-tabs */}
        <div className="flex mt-3 space-x-1 overflow-x-auto">
          {([
            { key: 'active' as RxTab, label: 'Active Meds', icon: Pill },
            { key: 'prescribe' as RxTab, label: 'Prescribe', icon: Plus },
            { key: 'history' as RxTab, label: 'History', icon: Clock },
            { key: 'pharmacies' as RxTab, label: 'Pharmacies', icon: Building2 },
            { key: 'interactions' as RxTab, label: 'Interactions', icon: AlertTriangle },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${activeTab === tab.key ? 'bg-teal-600/20 text-teal-400' : 'text-gray-400 hover:text-white hover:bg-[#1a3d3d]'}`}>
              <tab.icon className="w-3.5 h-3.5" /><span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">

        {/* ═══ ACTIVE MEDS TAB ═══ */}
        {activeTab === 'active' && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search medications or patients..."
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
                <option value="active">Active</option><option value="all">All</option><option value="discontinued">Discontinued</option><option value="completed">Completed</option>
              </select>
            </div>

            {filteredMeds.length === 0 ? (
              <div className="bg-[#0d2626] rounded-lg p-8 text-center text-gray-500 text-xs border border-[#1a3d3d]">No medications found</div>
            ) : filteredMeds.map(med => {
              const sc = STATUS_CONFIG[med.status] || STATUS_CONFIG.active
              return (
                <div key={med.id} className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d] hover:border-teal-500/30 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${sc.bg} ${sc.color}`}>{med.status}</span>
                        {med.is_controlled && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400">C-{med.dea_schedule || '?'}</span>}
                      </div>
                      <p className="text-sm font-bold text-white">{med.medication_name}</p>
                      {med.generic_name && <p className="text-[11px] text-gray-400">Generic: {med.generic_name}</p>}
                      <p className="text-xs text-gray-300 mt-1">{med.dosage} &bull; {med.frequency} &bull; {med.route}</p>
                      {med.sig && <p className="text-[11px] text-gray-400 mt-1 italic">Sig: {med.sig}</p>}
                      <div className="flex items-center flex-wrap gap-2 mt-2">
                        {med.patients && <span className="text-[10px] text-cyan-400">{med.patients.first_name} {med.patients.last_name}</span>}
                        {med.pharmacy_name && <span className="text-[10px] text-gray-500 flex items-center space-x-1"><Building2 className="w-3 h-3" /><span>{med.pharmacy_name}</span></span>}
                        <span className="text-[10px] text-gray-500">Qty: {med.quantity || '?'} | Refills: {med.refills}</span>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-1 ml-3">
                      {med.status === 'active' && med.refills > 0 && (
                        <button onClick={() => refillMed(med.id)} className="px-2 py-1 rounded text-[10px] font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600/40">Refill</button>
                      )}
                      {med.status === 'active' && (
                        <button onClick={() => setShowDiscontinue(med)} className="px-2 py-1 rounded text-[10px] font-bold bg-red-600/20 text-red-400 hover:bg-red-600/40">D/C</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ═══ PRESCRIBE TAB ═══ */}
        {activeTab === 'prescribe' && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-sm font-bold text-white">New Prescription</h2>

            {/* Patient Search */}
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Patient <span className="text-red-400">*</span></label>
              {selectedPatient ? (
                <div className="flex items-center space-x-2 bg-teal-600/10 border border-teal-500/30 rounded-lg px-3 py-2">
                  <span className="text-sm text-white font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</span>
                  <span className="text-[10px] text-gray-400">{selectedPatient.email}</span>
                  <button onClick={() => { setSelectedPatient(null); setRxForm(p => ({ ...p, patientId: '' })) }} className="ml-auto text-gray-400 hover:text-red-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="relative">
                  <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Search patient by name or email..."
                    className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
                  {patientResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d2626] border border-[#1a3d3d] rounded-lg z-10 max-h-40 overflow-y-auto">
                      {patientResults.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPatient(p); setRxForm(prev => ({ ...prev, patientId: p.id })); setPatientSearch(''); setPatientResults([]) }}
                          className="w-full text-left px-3 py-2 hover:bg-[#1a3d3d] text-xs text-white border-b border-[#1a3d3d]/50">
                          {p.first_name} {p.last_name} <span className="text-gray-500">({p.email})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Medication */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Medication Name <span className="text-red-400">*</span></label>
                <input value={rxForm.medicationName} onChange={e => setRxForm(p => ({ ...p, medicationName: e.target.value }))} placeholder="e.g. Amoxicillin"
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Generic Name</label>
                <input value={rxForm.genericName} onChange={e => setRxForm(p => ({ ...p, genericName: e.target.value }))} placeholder="Generic name"
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Dosage</label>
                <input value={rxForm.dosage} onChange={e => setRxForm(p => ({ ...p, dosage: e.target.value }))} placeholder="500mg"
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Frequency</label>
                <select value={rxForm.frequency} onChange={e => setRxForm(p => ({ ...p, frequency: e.target.value }))}
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50">
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Route</label>
                <select value={rxForm.route} onChange={e => setRxForm(p => ({ ...p, route: e.target.value }))}
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50">
                  {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Quantity</label>
                <input type="number" value={rxForm.quantity} onChange={e => setRxForm(p => ({ ...p, quantity: e.target.value }))} placeholder="30"
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Refills</label>
                <input type="number" value={rxForm.refills} onChange={e => setRxForm(p => ({ ...p, refills: e.target.value }))} placeholder="0" min="0" max="11"
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Days Supply</label>
                <input type="number" value={rxForm.daysSupply} onChange={e => setRxForm(p => ({ ...p, daysSupply: e.target.value }))} placeholder="30"
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Sig (Directions)</label>
              <input value={rxForm.sig} onChange={e => setRxForm(p => ({ ...p, sig: e.target.value }))} placeholder="Take 1 tablet by mouth twice daily with food"
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Pharmacy</label>
              <select value={rxForm.pharmacyName} onChange={e => setRxForm(p => ({ ...p, pharmacyName: e.target.value }))}
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50">
                <option value="">Select pharmacy</option>
                {pharmacies.map(ph => <option key={ph.id} value={ph.name}>{ph.name} {ph.is_preferred ? '⭐' : ''}</option>)}
              </select>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 text-xs text-gray-300">
                <input type="checkbox" checked={rxForm.isControlled} onChange={e => setRxForm(p => ({ ...p, isControlled: e.target.checked }))} className="rounded border-gray-600" />
                <span>Controlled Substance</span>
              </label>
              {rxForm.isControlled && (
                <select value={rxForm.deaSchedule} onChange={e => setRxForm(p => ({ ...p, deaSchedule: e.target.value }))}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-1.5 text-xs text-white">
                  <option value="">Schedule</option><option value="II">Schedule II</option><option value="III">Schedule III</option><option value="IV">Schedule IV</option><option value="V">Schedule V</option>
                </select>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Notes</label>
              <textarea value={rxForm.notes} onChange={e => setRxForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Additional notes..."
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50 resize-none" />
            </div>

            <button onClick={prescribe} disabled={!rxForm.patientId || !rxForm.medicationName}
              className="w-full py-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Prescribe Medication
            </button>
          </div>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {activeTab === 'history' && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-white">Prescription History</h2>
            <p className="text-[10px] text-gray-500">Select a patient to view their prescription history</p>
            {/* Shows all prescription actions chronologically */}
            {medications.slice(0, 20).map(med => (
              <div key={med.id} className="bg-[#0d2626] rounded-lg p-3 border border-[#1a3d3d]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">{med.medication_name} {med.dosage}</p>
                    <p className="text-[10px] text-gray-400">{med.patients?.first_name} {med.patients?.last_name} &bull; {med.frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[10px] font-bold ${STATUS_CONFIG[med.status]?.color || 'text-gray-400'}`}>{med.status}</p>
                    <p className="text-[9px] text-gray-500">{new Date(med.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ PHARMACIES TAB ═══ */}
        {activeTab === 'pharmacies' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Pharmacy Directory ({pharmacies.length})</h2>
              <button onClick={() => setShowPharmacyForm(true)} className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center space-x-1.5">
                <Plus className="w-3.5 h-3.5" /><span>Add Pharmacy</span>
              </button>
            </div>
            {pharmacies.map(ph => (
              <div key={ph.id} className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-white flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-teal-400" />
                      <span>{ph.name}</span>
                      {ph.is_preferred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                    </p>
                    {ph.address && <p className="text-[11px] text-gray-400 mt-1 flex items-center space-x-1"><MapPin className="w-3 h-3" /><span>{ph.address}{ph.city ? `, ${ph.city}, ${ph.state} ${ph.zip}` : ''}</span></p>}
                    {ph.phone && <p className="text-[11px] text-gray-400 flex items-center space-x-1"><Phone className="w-3 h-3" /><span>{ph.phone}</span></p>}
                  </div>
                  {ph.is_mail_order && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400">MAIL ORDER</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ INTERACTIONS TAB ═══ */}
        {activeTab === 'interactions' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2"><AlertTriangle className="w-4 h-4 text-amber-400" /><span>Drug Interaction Alerts</span></h2>
            <p className="text-[10px] text-gray-500">AI-powered drug interaction checking will flag potential interactions when prescribing</p>
            <div className="bg-[#0d2626] rounded-lg p-6 text-center text-gray-500 text-xs border border-[#1a3d3d] border-dashed">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No interaction alerts. Interactions are checked automatically when new medications are prescribed.</p>
              <p className="text-[10px] mt-2 text-gray-600">AI integration coming soon — will check against patient&apos;s full medication list in real-time</p>
            </div>
          </div>
        )}
      </div>

      {/* ═══ DISCONTINUE MODAL ═══ */}
      {showDiscontinue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Discontinue Medication</h3>
            <p className="text-xs text-gray-400">Discontinuing: <span className="text-white font-medium">{showDiscontinue.medication_name} {showDiscontinue.dosage}</span></p>
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Reason</label>
              <textarea value={discontinueReason} onChange={e => setDiscontinueReason(e.target.value)} rows={3} placeholder="Reason for discontinuation..."
                className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50 resize-none" />
            </div>
            <div className="flex space-x-3">
              <button onClick={() => { setShowDiscontinue(null); setDiscontinueReason('') }} className="flex-1 py-2 rounded-lg border border-[#1a3d3d] text-gray-400 text-sm">Cancel</button>
              <button onClick={discontinueMed} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold">Discontinue</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD PHARMACY MODAL ═══ */}
      {showPharmacyForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold text-white">Add Pharmacy</h3><button onClick={() => setShowPharmacyForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button></div>
            <input value={pharmacyForm.name} onChange={e => setPharmacyForm(p => ({ ...p, name: e.target.value }))} placeholder="Pharmacy name *"
              className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
            <div className="grid grid-cols-2 gap-3">
              <input value={pharmacyForm.phone} onChange={e => setPharmacyForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone"
                className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none" />
              <input value={pharmacyForm.fax} onChange={e => setPharmacyForm(p => ({ ...p, fax: e.target.value }))} placeholder="Fax"
                className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none" />
            </div>
            <input value={pharmacyForm.address} onChange={e => setPharmacyForm(p => ({ ...p, address: e.target.value }))} placeholder="Address"
              className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none" />
            <div className="grid grid-cols-3 gap-3">
              <input value={pharmacyForm.city} onChange={e => setPharmacyForm(p => ({ ...p, city: e.target.value }))} placeholder="City"
                className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none" />
              <input value={pharmacyForm.state} onChange={e => setPharmacyForm(p => ({ ...p, state: e.target.value }))} placeholder="State"
                className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none" />
              <input value={pharmacyForm.zip} onChange={e => setPharmacyForm(p => ({ ...p, zip: e.target.value }))} placeholder="ZIP"
                className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none" />
            </div>
            <label className="flex items-center space-x-2 text-xs text-gray-300">
              <input type="checkbox" checked={pharmacyForm.isPreferred} onChange={e => setPharmacyForm(p => ({ ...p, isPreferred: e.target.checked }))} />
              <span>Preferred pharmacy</span>
            </label>
            <div className="flex space-x-3">
              <button onClick={() => setShowPharmacyForm(false)} className="flex-1 py-2 rounded-lg border border-[#1a3d3d] text-gray-400 text-sm">Cancel</button>
              <button onClick={addPharmacy} disabled={!pharmacyForm.name} className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold disabled:opacity-50">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
