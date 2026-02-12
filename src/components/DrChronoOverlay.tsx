'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Search, User, Pill, Calendar, AlertTriangle, Stethoscope, Download, ExternalLink, RefreshCw, ChevronRight, Loader2 } from 'lucide-react'

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
interface DrChronoPatient {
  id: number
  chart_id: string
  first_name: string
  last_name: string
  date_of_birth: string
  email: string
  phone: string
  gender: string
  address: string
  city: string
  state: string
  zip_code: string
  primary_insurance?: any
  secondary_insurance?: any
  pharmacy?: string
}

interface Medication {
  id: number
  name: string
  dosage_quantity: string
  dosage_unit: string
  frequency: string
  route: string
  sig: string
  date_prescribed: string
  date_started_taking: string
  date_stopped_taking: string
  status: string
  daw: boolean
  number_refills: number
  pharmacy_note: string
  doctor: number
}

interface Appointment {
  id: number
  scheduled_time: string
  duration: number
  status: string
  reason: string
  notes: string
  exam_room: number
  office: string
  patient: number
  doctor: number
}

interface Problem {
  id: number
  name: string
  icd_code: string
  date_diagnosis: string
  date_changed: string
  status: string
  notes: string
}

interface Allergy {
  id: number
  reaction: string
  status: string
  notes: string
  snomed_reaction?: string
}

type TabType = 'search' | 'demographics' | 'appointments' | 'medications' | 'problems' | 'allergies'

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════
export default function DrChronoOverlay({
  isOpen,
  onClose,
  patientName,
}: {
  isOpen: boolean
  onClose: () => void
  patientName?: string
}) {
  const [activeTab, setActiveTab] = useState<TabType>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DrChronoPatient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<DrChronoPatient | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)

  // Data states
  const [medications, setMedications] = useState<Medication[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [problems, setProblems] = useState<Problem[]>([])
  const [allergies, setAllergies] = useState<Allergy[]>([])
  const [exportingTab, setExportingTab] = useState<string | null>(null)

  // Check connection on mount
  useEffect(() => {
    if (isOpen && connected === null) {
      checkConnection()
    }
  }, [isOpen])

  // Auto-search if patientName is passed
  useEffect(() => {
    if (isOpen && patientName && connected === true) {
      setSearchQuery(patientName)
      // Auto-search after a small delay
      const timer = setTimeout(() => {
        searchPatientsByName(patientName)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, patientName, connected])

  const checkConnection = async () => {
    try {
      const res = await fetch('/api/drchrono/test')
      setConnected(res.ok)
      if (!res.ok) {
        setError('DrChrono not connected. Click "Connect" to authorize.')
      }
    } catch {
      setConnected(false)
      setError('DrChrono not connected.')
    }
  }

  const handleConnect = () => {
    window.open('/api/drchrono/auth', '_blank', 'width=600,height=700')
  }

  // ═══ SEARCH ═══
  const searchPatientsByName = async (name: string) => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const parts = name.trim().split(' ')
      let url = '/api/drchrono/patients?'
      if (parts.length >= 2) {
        url += `first_name=${encodeURIComponent(parts[0])}&last_name=${encodeURIComponent(parts.slice(1).join(' '))}`
      } else {
        url += `last_name=${encodeURIComponent(parts[0])}`
      }
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setSearchResults(data.patients || [])
      if ((data.patients || []).length === 0) setError('No patients found in DrChrono')
    } catch (e: any) {
      console.error('[DrChrono Search]', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const searchPatients = async () => {
    await searchPatientsByName(searchQuery)
  }

  const selectPatient = async (patient: DrChronoPatient) => {
    setSelectedPatient(patient)
    setActiveTab('demographics')
    // Fetch all data for this patient
    await Promise.all([
      fetchMedications(patient.id),
      fetchAppointments(patient.id),
      fetchProblems(patient.id),
      fetchAllergies(patient.id),
    ])
  }

  // ═══ DATA FETCHERS ═══
  const fetchMedications = async (patientId: number) => {
    try {
      const res = await fetch(`/api/drchrono/medications?patient_id=${patientId}`)
      const data = await res.json()
      setMedications(data.medications || [])
    } catch (e) { console.error('[DrChrono Meds]', e) }
  }

  const fetchAppointments = async (patientId: number) => {
    try {
      const res = await fetch(`/api/drchrono/appointments?patient_id=${patientId}`)
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch (e) { console.error('[DrChrono Appts]', e) }
  }

  const fetchProblems = async (patientId: number) => {
    try {
      const res = await fetch(`/api/drchrono/problems?patient_id=${patientId}`)
      const data = await res.json()
      setProblems(data.problems || [])
    } catch (e) { console.error('[DrChrono Problems]', e) }
  }

  const fetchAllergies = async (patientId: number) => {
    try {
      const res = await fetch(`/api/drchrono/allergies?patient_id=${patientId}`)
      const data = await res.json()
      setAllergies(data.allergies || [])
    } catch (e) { console.error('[DrChrono Allergies]', e) }
  }

  // ═══ eRx POPUP ═══
  const openErx = () => {
    if (!selectedPatient) return
    const erxUrl = `https://app.drchrono.com/clinical/#/patient/${selectedPatient.chart_id}/erx`
    window.open(erxUrl, 'drchrono-erx', 'width=1100,height=800,scrollbars=yes,resizable=yes')
  }

  // ═══ EXPORT ═══
  const exportData = async (type: string, data: any[]) => {
    if (data.length === 0) return
    setExportingTab(type)
    try {
      const res = await fetch('/api/drchrono/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          data,
          patientName: selectedPatient ? `${selectedPatient.first_name}_${selectedPatient.last_name}` : 'patient',
        }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `drchrono-${type}-${selectedPatient?.last_name || 'patient'}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      console.error('[DrChrono Export]', e)
      setError(e.message)
    } finally {
      setExportingTab(null)
    }
  }

  // ═══ BACK TO SEARCH ═══
  const backToSearch = () => {
    setSelectedPatient(null)
    setActiveTab('search')
    setMedications([])
    setAppointments([])
    setProblems([])
    setAllergies([])
  }

  if (!isOpen) return null

  // Tabs to show when a patient is selected
  const patientTabs: { key: TabType; label: string; icon: any; count?: number }[] = selectedPatient ? [
    { key: 'demographics', label: 'Info', icon: User },
    { key: 'medications', label: 'Meds', icon: Pill, count: medications.length },
    { key: 'appointments', label: 'Appts', icon: Calendar, count: appointments.length },
    { key: 'problems', label: 'Problems', icon: Stethoscope, count: problems.length },
    { key: 'allergies', label: 'Allergies', icon: AlertTriangle, count: allergies.length },
  ] : []

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[200]" onClick={onClose} />

      {/* Panel - slides in from right */}
      <div className="fixed top-0 right-0 h-full w-[520px] max-w-[95vw] z-[201] flex flex-col"
        style={{ background: 'linear-gradient(180deg, #0B1220 0%, #0D1628 100%)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            {selectedPatient && (
              <button onClick={backToSearch} className="text-[#7B8CA3] hover:text-white transition-colors text-xs">
                ← Back
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
                <span className="text-sm">🏥</span>
              </div>
              <span className="text-[13px] font-semibold text-[#E8ECF1]">DrChrono EHR</span>
              {connected === true && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              {connected === false && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected === false && (
              <button onClick={handleConnect}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors">
                Connect
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors">
              <X className="w-4 h-4 text-[#7B8CA3]" />
            </button>
          </div>
        </div>

        {/* ── PATIENT TABS (when patient selected) ── */}
        {selectedPatient && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.06] flex-shrink-0 overflow-x-auto">
            {patientTabs.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                    active ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' : 'text-[#7B8CA3] hover:text-white hover:bg-white/[0.04]'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full ${active ? 'bg-purple-500/30 text-purple-200' : 'bg-white/[0.08] text-[#7B8CA3]'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
            {/* eRx button */}
            <button onClick={openErx}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-all ml-auto">
              <ExternalLink className="w-3.5 h-3.5" />
              Send eRx
            </button>
          </div>
        )}

        {/* ── CONTENT ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Error banner */}
          {error && !loading && (
            <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.08] flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-red-300">{error}</p>
                {connected === false && (
                  <button onClick={handleConnect} className="text-[11px] text-purple-400 hover:text-purple-300 mt-1 underline">
                    Connect DrChrono →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ═══ SEARCH TAB ═══ */}
          {activeTab === 'search' && (
            <div>
              <p className="text-xs text-[#7B8CA3] mb-3">Search for a patient in DrChrono by name</p>
              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5568]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setError(null) }}
                    onKeyDown={e => e.key === 'Enter' && searchPatients()}
                    placeholder="Patient name..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#151D28] border border-[#1E2A3A] text-sm text-white placeholder-[#4A5568] focus:outline-none focus:border-purple-500/40 transition-colors"
                  />
                </div>
                <button onClick={searchPatients} disabled={loading || !searchQuery.trim()}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold disabled:opacity-40 transition-colors flex items-center gap-2">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Search
                </button>
              </div>

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map(p => (
                    <button key={p.id} onClick={() => selectPatient(p)}
                      className="w-full text-left p-4 rounded-xl bg-[#151D28] border border-[#1E2A3A] hover:border-purple-500/30 hover:bg-[#1A2332] transition-all group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#E8ECF1] group-hover:text-white">
                            {p.first_name} {p.last_name}
                          </p>
                          <p className="text-[11px] text-[#7B8CA3] mt-0.5">
                            DOB: {p.date_of_birth || 'N/A'} · Chart: {p.chart_id || 'N/A'}
                          </p>
                          {p.phone && <p className="text-[11px] text-[#4A5568] mt-0.5">{p.phone}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#4A5568] group-hover:text-purple-400 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ DEMOGRAPHICS TAB ═══ */}
          {activeTab === 'demographics' && selectedPatient && (
            <div>
              <div className="rounded-xl bg-[#151D28] border border-[#1E2A3A] p-5 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">
                      {selectedPatient.first_name?.[0]}{selectedPatient.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">{selectedPatient.first_name} {selectedPatient.last_name}</h3>
                    <p className="text-[11px] text-[#7B8CA3]">Chart ID: {selectedPatient.chart_id} · DrChrono #{selectedPatient.id}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Date of Birth', value: selectedPatient.date_of_birth || '—' },
                    { label: 'Gender', value: selectedPatient.gender || '—' },
                    { label: 'Phone', value: selectedPatient.phone || '—' },
                    { label: 'Email', value: selectedPatient.email || '—' },
                    { label: 'Address', value: [selectedPatient.address, selectedPatient.city, selectedPatient.state, selectedPatient.zip_code].filter(Boolean).join(', ') || '—' },
                    { label: 'Pharmacy', value: selectedPatient.pharmacy || '—' },
                  ].map((field, i) => (
                    <div key={i} className={`${i >= 4 ? 'col-span-2' : ''}`}>
                      <p className="text-[10px] text-[#4A5568] uppercase tracking-wider mb-0.5">{field.label}</p>
                      <p className="text-xs text-[#E8ECF1]">{field.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Summary */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Medications', count: medications.length, color: '#a855f7', tab: 'medications' as TabType },
                  { label: 'Problems', count: problems.length, color: '#3b82f6', tab: 'problems' as TabType },
                  { label: 'Allergies', count: allergies.length, color: '#ef4444', tab: 'allergies' as TabType },
                  { label: 'Appointments', count: appointments.length, color: '#f97316', tab: 'appointments' as TabType },
                ].map(s => (
                  <button key={s.label} onClick={() => setActiveTab(s.tab)}
                    className="p-3 rounded-xl bg-[#151D28] border border-[#1E2A3A] hover:border-white/[0.12] transition-all text-left">
                    <p className="text-lg font-bold" style={{ color: s.color }}>{s.count}</p>
                    <p className="text-[11px] text-[#7B8CA3]">{s.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ MEDICATIONS TAB ═══ */}
          {activeTab === 'medications' && selectedPatient && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[#7B8CA3]">{medications.length} medication{medications.length !== 1 ? 's' : ''}</p>
                <div className="flex gap-2">
                  <button onClick={() => fetchMedications(selectedPatient.id)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
                    <RefreshCw className="w-3.5 h-3.5 text-[#7B8CA3]" />
                  </button>
                  <button onClick={() => exportData('medications', medications)} disabled={medications.length === 0 || exportingTab === 'medications'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-[#7B8CA3] hover:text-white transition-all disabled:opacity-40">
                    {exportingTab === 'medications' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    XLSX
                  </button>
                </div>
              </div>
              {medications.length === 0 ? (
                <div className="text-center py-8">
                  <Pill className="w-8 h-8 text-[#2A3A4F] mx-auto mb-2" />
                  <p className="text-xs text-[#4A5568]">No medications found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {medications.map(med => (
                    <div key={med.id} className="p-3.5 rounded-xl bg-[#151D28] border border-[#1E2A3A]">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[13px] font-medium text-[#E8ECF1]">{med.name || 'Unknown'}</p>
                          <p className="text-[11px] text-[#7B8CA3] mt-0.5">
                            {[med.dosage_quantity, med.dosage_unit, med.frequency, med.route].filter(Boolean).join(' · ') || 'No dosage info'}
                          </p>
                          {med.sig && <p className="text-[11px] text-[#4A5568] mt-1 italic">SIG: {med.sig}</p>}
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                          med.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.06] text-[#7B8CA3]'
                        }`}>
                          {med.status || 'unknown'}
                        </span>
                      </div>
                      <div className="flex gap-4 mt-2">
                        {med.date_prescribed && <p className="text-[10px] text-[#4A5568]">Prescribed: {med.date_prescribed}</p>}
                        {med.number_refills !== undefined && <p className="text-[10px] text-[#4A5568]">Refills: {med.number_refills}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ APPOINTMENTS TAB ═══ */}
          {activeTab === 'appointments' && selectedPatient && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[#7B8CA3]">{appointments.length} appointment{appointments.length !== 1 ? 's' : ''}</p>
                <div className="flex gap-2">
                  <button onClick={() => fetchAppointments(selectedPatient.id)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
                    <RefreshCw className="w-3.5 h-3.5 text-[#7B8CA3]" />
                  </button>
                  <button onClick={() => exportData('appointments', appointments)} disabled={appointments.length === 0 || exportingTab === 'appointments'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-[#7B8CA3] hover:text-white transition-all disabled:opacity-40">
                    {exportingTab === 'appointments' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    XLSX
                  </button>
                </div>
              </div>
              {appointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-8 h-8 text-[#2A3A4F] mx-auto mb-2" />
                  <p className="text-xs text-[#4A5568]">No appointments found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {appointments.map(appt => (
                    <div key={appt.id} className="p-3.5 rounded-xl bg-[#151D28] border border-[#1E2A3A]">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[13px] font-medium text-[#E8ECF1]">
                            {appt.scheduled_time ? new Date(appt.scheduled_time).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No date'}
                          </p>
                          <p className="text-[11px] text-[#7B8CA3] mt-0.5">
                            {appt.duration ? `${appt.duration} min` : ''}{appt.reason ? ` · ${appt.reason}` : ''}
                          </p>
                          {appt.notes && <p className="text-[11px] text-[#4A5568] mt-1">{appt.notes}</p>}
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                          appt.status === 'Complete' ? 'bg-emerald-500/15 text-emerald-400' :
                          appt.status === 'Confirmed' ? 'bg-blue-500/15 text-blue-400' :
                          appt.status === 'No Show' ? 'bg-red-500/15 text-red-400' :
                          'bg-white/[0.06] text-[#7B8CA3]'
                        }`}>
                          {appt.status || 'unknown'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ PROBLEMS TAB ═══ */}
          {activeTab === 'problems' && selectedPatient && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[#7B8CA3]">{problems.length} problem{problems.length !== 1 ? 's' : ''}</p>
                <div className="flex gap-2">
                  <button onClick={() => fetchProblems(selectedPatient.id)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
                    <RefreshCw className="w-3.5 h-3.5 text-[#7B8CA3]" />
                  </button>
                  <button onClick={() => exportData('problems', problems)} disabled={problems.length === 0 || exportingTab === 'problems'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-[#7B8CA3] hover:text-white transition-all disabled:opacity-40">
                    {exportingTab === 'problems' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    XLSX
                  </button>
                </div>
              </div>
              {problems.length === 0 ? (
                <div className="text-center py-8">
                  <Stethoscope className="w-8 h-8 text-[#2A3A4F] mx-auto mb-2" />
                  <p className="text-xs text-[#4A5568]">No problems found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {problems.map(prob => (
                    <div key={prob.id} className="p-3.5 rounded-xl bg-[#151D28] border border-[#1E2A3A]">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[13px] font-medium text-[#E8ECF1]">{prob.name || 'Unknown'}</p>
                          {prob.icd_code && <p className="text-[11px] text-purple-400 mt-0.5">ICD: {prob.icd_code}</p>}
                          {prob.notes && <p className="text-[11px] text-[#4A5568] mt-1">{prob.notes}</p>}
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                          prob.status === 'active' ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-[#7B8CA3]'
                        }`}>
                          {prob.status || 'unknown'}
                        </span>
                      </div>
                      {prob.date_diagnosis && <p className="text-[10px] text-[#4A5568] mt-2">Diagnosed: {prob.date_diagnosis}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ ALLERGIES TAB ═══ */}
          {activeTab === 'allergies' && selectedPatient && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[#7B8CA3]">{allergies.length} allerg{allergies.length !== 1 ? 'ies' : 'y'}</p>
                <div className="flex gap-2">
                  <button onClick={() => fetchAllergies(selectedPatient.id)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
                    <RefreshCw className="w-3.5 h-3.5 text-[#7B8CA3]" />
                  </button>
                  <button onClick={() => exportData('allergies', allergies)} disabled={allergies.length === 0 || exportingTab === 'allergies'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-[#7B8CA3] hover:text-white transition-all disabled:opacity-40">
                    {exportingTab === 'allergies' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    XLSX
                  </button>
                </div>
              </div>
              {allergies.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-8 h-8 text-[#2A3A4F] mx-auto mb-2" />
                  <p className="text-xs text-[#4A5568]">No allergies found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allergies.map(allergy => (
                    <div key={allergy.id} className="p-3.5 rounded-xl bg-[#151D28] border border-[#1E2A3A]">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[13px] font-medium text-[#E8ECF1]">{allergy.reaction || 'Unknown'}</p>
                          {allergy.notes && <p className="text-[11px] text-[#4A5568] mt-1">{allergy.notes}</p>}
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                          allergy.status === 'active' ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-[#7B8CA3]'
                        }`}>
                          {allergy.status || 'unknown'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        {selectedPatient && (
          <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between flex-shrink-0">
            <p className="text-[10px] text-[#4A5568]">
              Data live from DrChrono API · Not stored in Medazon DB
            </p>
            <button onClick={openErx}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              Send eRx
            </button>
          </div>
        )}
      </div>
    </>
  )
}
