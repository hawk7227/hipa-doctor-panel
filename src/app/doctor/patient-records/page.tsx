'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search, X, ChevronLeft, Pill, AlertTriangle, FileText, Calendar,
  Phone, Mail, MapPin, Activity, Loader2,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// Patient Records — Offline-first patient chart viewer
//
// Reads from /data/patient-medications.json (static export)
// Smart search: name, email, DOB, phone, address, patient ID
// Chart view: medications, allergies, problems, appointments
// ═══════════════════════════════════════════════════════════════

interface Medication {
  name: string
  dosage: string
  sig: string
  status: string
  date_prescribed: string
  date_stopped: string | null
}

interface Allergy {
  name: string
  severity: string
  status: string
  onset_date: string
}

interface Problem {
  name: string
  icd_code: string
  status: string
  date_diagnosis: string
}

interface Appointment {
  id: string
  date: string
  status: string
  visit_type: string
  chief_complaint: string
}

interface Patient {
  drchrono_patient_id: number // legacy field from static JSON
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  address: string | null
  pharmacy: string | null
  medications: Medication[]
  allergies: Allergy[]
  problems: Problem[]
  appointments: Appointment[]
}

interface PatientData {
  export_info: { generated_at: string }
  summary: {
    total_patients: number
    total_medications: number
    total_allergies: number
    total_problems: number
    total_appointments: number
  }
  patients: Patient[]
}

// ── Smart search: matches across all fields ──
function matchesSearch(patient: Patient, query: string): boolean {
  if (!query || query.length < 2) return false
  const q = query.toLowerCase().trim()

  // Name match
  const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase()
  if (fullName.includes(q)) return true

  // Last name, first name
  if (patient.last_name?.toLowerCase().includes(q)) return true
  if (patient.first_name?.toLowerCase().includes(q)) return true

  // Email
  if (patient.email?.toLowerCase().includes(q)) return true

  // Phone (strip non-digits for comparison)
  if (patient.phone) {
    const phoneDigits = patient.phone.replace(/\D/g, '')
    const queryDigits = q.replace(/\D/g, '')
    if (queryDigits.length >= 3 && phoneDigits.includes(queryDigits)) return true
    if (patient.phone.toLowerCase().includes(q)) return true
  }

  // DOB
  if (patient.date_of_birth) {
    if (patient.date_of_birth.includes(q)) return true
    // Try MM/DD/YYYY format
    const [y, m, d] = patient.date_of_birth.split('-')
    if (y && m && d) {
      const formatted = `${m}/${d}/${y}`
      if (formatted.includes(q)) return true
    }
  }

  // Address
  if (patient.address?.toLowerCase().includes(q)) return true

  // Patient ID
  if (String(patient.drchrono_patient_id).includes(q)) return true

  // Chart # / Patient ID with prefix
  if (q.startsWith('#') && String(patient.drchrono_patient_id).includes(q.slice(1))) return true

  return false
}

// ── Format date helper ──
function formatDate(d: string | null): string {
  if (!d) return '—'
  try {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return d }
}

function formatDOB(d: string | null): string {
  if (!d) return '—'
  try {
    const date = new Date(d + 'T00:00:00')
    const age = Math.floor((Date.now() - date.getTime()) / 31557600000)
    return `${date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} (${age}y)`
  } catch { return d }
}

export default function PatientRecordsPage() {
  const [data, setData] = useState<PatientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [activeTab, setActiveTab] = useState<'meds' | 'allergies' | 'problems' | 'appointments'>('meds')
  const [medFilter, setMedFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Load data ──
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/data/patient-medications.json')
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`)
        const json = await res.json()
        // Also get total patient count from Supabase (may be more than JSON)
        try {
          const { supabase } = await import('@/lib/supabase')
          const { count } = await supabase.from('patients').select('*', { count: 'exact', head: true })
          if (count && count > (json.patients?.length || 0)) {
            json.summary = { ...json.summary, total_patients: count }
            console.log(`[PatientRecords] Supabase total: ${count} (JSON has ${json.patients.length})`)
          }
        } catch { /* fallback to JSON count */ }
        setData(json)
        console.log(`[PatientRecords] Loaded ${json.patients.length} patients`)
      } catch (err: any) {
        console.error('[PatientRecords] Load error:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Search results (limited to 50 for performance) ──
  // When no search query, show first 50 patients as default list
  const results = useMemo(() => {
    if (!data) return []
    if (search.length < 2) return data.patients.slice(0, 50)
    const matches: Patient[] = []
    for (const p of data.patients) {
      if (matchesSearch(p, search)) {
        matches.push(p)
        if (matches.length >= 50) break
      }
    }
    return matches
  }, [data, search])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedPatient) setSelectedPatient(null)
        else if (search) setSearch('')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedPatient, search])

  // ── Filtered meds ──
  const filteredMeds = useMemo(() => {
    if (!selectedPatient) return []
    if (medFilter === 'all') return selectedPatient.medications
    return selectedPatient.medications.filter(m => m.status === medFilter)
  }, [selectedPatient, medFilter])

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-400 mx-auto mb-3" />
          <p className="text-gray-400">Loading patient records...</p>
          <p className="text-gray-600 text-xs mt-1">6,968 patients · 20,132 medications</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-semibold">Failed to load patient records</p>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
          <p className="text-gray-600 text-xs mt-3">Make sure <code className="bg-[#1a3d3d] px-1.5 py-0.5 rounded">public/data/patient-medications.json</code> exists</p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // CHART VIEW — Selected patient
  // ═══════════════════════════════════════════════════════════
  if (selectedPatient) {
    const p = selectedPatient
    const activeMeds = p.medications.filter(m => m.status === 'active')
    const activeProblems = p.problems.filter(pr => pr.status === 'active')

    return (
      <div className="h-full flex flex-col bg-[#0a1628]">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-[#1a3d3d] bg-[#0d2626] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedPatient(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div className="w-10 h-10 rounded-full bg-teal-600/30 flex items-center justify-center">
                <span className="text-sm font-bold text-teal-300">
                  {p.first_name[0]}{p.last_name[0]}
                </span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  {p.first_name} {p.last_name}
                </h1>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>DOB: {formatDOB(p.date_of_birth)}</span>
                  <span>·</span>
                  <span>Chart #{p.drchrono_patient_id}</span>{/* legacy ID from static data */}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedPatient(null)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Patient info strip */}
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
            {p.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> {p.phone}
              </span>
            )}
            {p.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> {p.email}
              </span>
            )}
            {p.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> {p.address}
              </span>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex gap-2 mt-3">
            <div className="px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 rounded-lg text-xs">
              <span className="text-teal-400 font-bold">{activeMeds.length}</span>
              <span className="text-gray-500 ml-1">Active Meds</span>
            </div>
            <div className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs">
              <span className="text-orange-400 font-bold">{p.allergies.length}</span>
              <span className="text-gray-500 ml-1">Allergies</span>
            </div>
            <div className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs">
              <span className="text-purple-400 font-bold">{activeProblems.length}</span>
              <span className="text-gray-500 ml-1">Active Problems</span>
            </div>
            <div className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs">
              <span className="text-blue-400 font-bold">{p.appointments.length}</span>
              <span className="text-gray-500 ml-1">Appointments</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-[#1a3d3d] bg-[#0d2020] px-4">
          <div className="flex gap-0">
            {([
              { key: 'meds', label: 'Medications', icon: Pill, count: p.medications.length },
              { key: 'allergies', label: 'Allergies', icon: AlertTriangle, count: p.allergies.length },
              { key: 'problems', label: 'Problems', icon: FileText, count: p.problems.length },
              { key: 'appointments', label: 'Appointments', icon: Calendar, count: p.appointments.length },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-teal-400 text-teal-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === tab.key ? 'bg-teal-500/20 text-teal-300' : 'bg-white/5 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* ── MEDICATIONS TAB ── */}
          {activeTab === 'meds' && (
            <div>
              {/* Filter bar */}
              <div className="flex gap-2 mb-3">
                {(['all', 'active', 'inactive'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setMedFilter(f)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                      medFilter === f
                        ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                        : 'bg-white/5 text-gray-500 border border-transparent hover:text-gray-300'
                    }`}
                  >
                    {f === 'all' ? `All (${p.medications.length})` :
                     f === 'active' ? `Active (${activeMeds.length})` :
                     `Inactive (${p.medications.length - activeMeds.length})`}
                  </button>
                ))}
              </div>

              {filteredMeds.length === 0 ? (
                <div className="text-center text-gray-600 py-12">No medications found</div>
              ) : (
                <div className="space-y-1">
                  {filteredMeds.map((med, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-[#0d2626] border border-[#1a3d3d] rounded-lg hover:border-[#2a5d5d] transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${med.status === 'active' ? 'bg-green-400' : 'bg-gray-600'}`} />
                        <div className="min-w-0">
                          <div className="text-sm text-white font-medium truncate">{med.name}</div>
                          <div className="text-xs text-gray-500 flex gap-2">
                            {med.dosage && med.dosage !== '0' && <span>Dose: {med.dosage}</span>}
                            {med.sig && <span>Sig: {med.sig}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          med.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-500'
                        }`}>
                          {med.status}
                        </div>
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          {med.date_prescribed ? formatDate(med.date_prescribed) : ''}
                          {med.date_stopped ? ` → ${formatDate(med.date_stopped)}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ALLERGIES TAB ── */}
          {activeTab === 'allergies' && (
            <div>
              {p.allergies.length === 0 ? (
                <div className="text-center text-gray-600 py-12">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No known allergies
                </div>
              ) : (
                <div className="space-y-1">
                  {p.allergies.map((a, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-[#0d2626] border border-[#1a3d3d] rounded-lg">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${
                          a.severity === 'severe' ? 'text-red-400' :
                          a.severity === 'moderate' ? 'text-orange-400' : 'text-yellow-400'
                        }`} />
                        <div>
                          <div className="text-sm text-white font-medium">{a.name}</div>
                          <div className="text-xs text-gray-500">
                            {a.severity && <span className="capitalize">{a.severity}</span>}
                            {a.onset_date && <span> · Onset: {formatDate(a.onset_date)}</span>}
                          </div>
                        </div>
                      </div>
                      <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        a.status === 'active' ? 'bg-orange-500/10 text-orange-400' : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {a.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PROBLEMS TAB ── */}
          {activeTab === 'problems' && (
            <div>
              {p.problems.length === 0 ? (
                <div className="text-center text-gray-600 py-12">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No documented problems
                </div>
              ) : (
                <div className="space-y-1">
                  {p.problems.map((pr, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-[#0d2626] border border-[#1a3d3d] rounded-lg">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Activity className={`w-4 h-4 flex-shrink-0 ${pr.status === 'active' ? 'text-purple-400' : 'text-gray-600'}`} />
                        <div className="min-w-0">
                          <div className="text-sm text-white font-medium truncate">{pr.name}</div>
                          <div className="text-xs text-gray-500">
                            {pr.icd_code && <span className="font-mono text-purple-400/60">{pr.icd_code}</span>}
                            {pr.date_diagnosis && <span> · Dx: {formatDate(pr.date_diagnosis)}</span>}
                          </div>
                        </div>
                      </div>
                      <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded flex-shrink-0 ${
                        pr.status === 'active' ? 'bg-purple-500/10 text-purple-400' : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {pr.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── APPOINTMENTS TAB ── */}
          {activeTab === 'appointments' && (
            <div>
              {p.appointments.length === 0 ? (
                <div className="text-center text-gray-600 py-12">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No appointments found
                </div>
              ) : (
                <div className="space-y-1">
                  {p.appointments.map((apt, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-[#0d2626] border border-[#1a3d3d] rounded-lg">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm text-white font-medium truncate">
                            {apt.chief_complaint || 'No complaint listed'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {apt.date && formatDate(apt.date)}
                            {apt.visit_type && <span> · {apt.visit_type}</span>}
                          </div>
                        </div>
                      </div>
                      <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded flex-shrink-0 ${
                        apt.status === 'Complete' ? 'bg-green-500/10 text-green-400' :
                        apt.status === 'Cancelled' ? 'bg-red-500/10 text-red-400' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>
                        {apt.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // SEARCH VIEW — Main page
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col bg-[#0a1628]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#1a3d3d] bg-[#0d2626] px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-white">Patient Records</h1>
            <p className="text-xs text-gray-500">
              {data?.summary.total_patients.toLocaleString()} patients · {data?.summary.total_medications.toLocaleString()} medications · {data?.summary.total_allergies.toLocaleString()} allergies · {data?.summary.total_problems.toLocaleString()} problems
            </p>
          </div>
          <div className="text-xs text-gray-600">
            Last export: {data?.export_info.generated_at ? new Date(data.export_info.generated_at).toLocaleDateString() : '—'}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="Search by name, email, phone, DOB, address, chart #..."
            className="w-full pl-10 pr-20 py-2.5 bg-[#0a1628] border border-[#1a3d3d] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-teal-500/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-10 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">⌘K</span>
        </div>

        {/* Search hints */}
        {!search && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {['LaMonica Hodges', '09/15/1986', 'lamonicahodges@gmail.com', '928-606', 'Scottsdale', '#104988035'].map(hint => (
              <button
                key={hint}
                onClick={() => setSearch(hint.replace('#', ''))}
                className="px-2 py-0.5 text-[10px] text-gray-500 bg-[#0a1f1f] rounded border border-[#1a3d3d] hover:text-teal-400 hover:border-teal-500/30 transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && search.length < 2 ? (
          <div className="text-center text-gray-600 py-20">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No patients loaded</p>
            <p className="text-xs mt-1 text-gray-700">Search by first name, last name, email, phone, DOB, address, or chart #</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center text-gray-600 py-20">
            <p className="text-sm">No patients found for &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div>
            <div className="px-4 py-2 text-xs text-gray-600 border-b border-[#1a3d3d]/50">
              {results.length >= 50 ? '50+ results' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
              {results.length >= 50 && <span className="ml-1 text-gray-700">· Refine your search for more specific results</span>}
            </div>
            {results.map((patient) => (
              <button
                key={patient.drchrono_patient_id}
                onClick={() => { setSelectedPatient(patient); setActiveTab('meds') }}
                className="w-full text-left px-4 py-3 flex items-start gap-3 border-b border-[#1a3d3d]/30 hover:bg-white/5 transition-colors"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#1a3d3d] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-teal-400">
                    {(patient.first_name?.[0] || '').toUpperCase()}{(patient.last_name?.[0] || '').toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {patient.first_name} {patient.last_name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-teal-500/10 text-teal-400 rounded font-semibold">
                      Local
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                    {patient.date_of_birth && <span>📅 {formatDOB(patient.date_of_birth)}</span>}
                    {patient.phone && <span>📞 {patient.phone}</span>}
                    {patient.email && <span>✉️ {patient.email}</span>}
                  </div>
                  {patient.address && (
                    <div className="text-xs text-gray-600 mt-0.5 truncate">📍 {patient.address}</div>
                  )}
                  {/* Quick stats */}
                  <div className="flex gap-2 mt-1">
                    {patient.medications.length > 0 && (
                      <span className="text-[10px] text-gray-600">
                        💊 {patient.medications.filter(m => m.status === 'active').length} active meds
                      </span>
                    )}
                    {patient.allergies.length > 0 && (
                      <span className="text-[10px] text-orange-400/60">
                        ⚠️ {patient.allergies.length} allergies
                      </span>
                    )}
                    {patient.problems.length > 0 && (
                      <span className="text-[10px] text-purple-400/60">
                        📋 {patient.problems.length} problems
                      </span>
                    )}
                  </div>
                </div>

                {/* Chart ID */}
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] text-gray-600 font-mono">#{patient.drchrono_patient_id}</div>{/* legacy ID */}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
