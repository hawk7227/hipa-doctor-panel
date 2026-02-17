// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Search, User, Pill, Calendar, AlertTriangle, Stethoscope, Download, ExternalLink, RefreshCw, ChevronRight, Loader2, Check, Database, Lock, Unlock, Palette, GripHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
// ACCENT COLORS
// ═══════════════════════════════════════════════
const ACCENT_COLORS = [
  { name: 'Purple', value: '#a855f7', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.3)', gradient: 'linear-gradient(180deg, #0B1220 0%, #0D1628 100%)' },
  { name: 'Cyan', value: '#06b6d4', bg: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.3)', gradient: 'linear-gradient(180deg, #091820 0%, #0A1A24 100%)' },
  { name: 'Emerald', value: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', gradient: 'linear-gradient(180deg, #081812 0%, #0A1C16 100%)' },
  { name: 'Rose', value: '#f43f5e', bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.3)', gradient: 'linear-gradient(180deg, #180B10 0%, #1C0D14 100%)' },
  { name: 'Amber', value: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', gradient: 'linear-gradient(180deg, #18140A 0%, #1C180D 100%)' },
  { name: 'Blue', value: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)', gradient: 'linear-gradient(180deg, #0B1020 0%, #0D1428 100%)' },
  { name: 'Indigo', value: '#6366f1', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.3)', gradient: 'linear-gradient(180deg, #0B0E20 0%, #0D1128 100%)' },
  { name: 'Pink', value: '#ec4899', bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.3)', gradient: 'linear-gradient(180deg, #180B14 0%, #1C0D18 100%)' },
]

interface PanelPrefs {
  width: number
  locked: boolean
  accentIndex: number
  posX: number | null
  posY: number | null
}

const DEFAULT_PREFS: PanelPrefs = { width: 620, locked: false, accentIndex: 0, posX: null, posY: null }

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════
export default function DrChronoOverlay({
  isOpen,
  onClose,
  patientName,
  patientId: medazonPatientId,
}: {
  isOpen: boolean
  onClose: () => void
  patientName?: string
  patientId?: string
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

  // Sync states
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState<string>('')

  // Panel preferences — loaded from Supabase then localStorage fallback
  const [prefs, setPrefs] = useState<PanelPrefs>(DEFAULT_PREFS)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PREFS.width)
  const [widthLocked, setWidthLocked] = useState(false)
  const [accentIndex, setAccentIndex] = useState(0)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [panelPos, setPanelPos] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)

  const accent = ACCENT_COLORS[accentIndex] || ACCENT_COLORS[0]

  // Load prefs from Supabase on mount
  useEffect(() => {
    if (!isOpen || prefsLoaded) return
    const loadPrefs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase.from('doctor_preferences').select('preference_value').eq('doctor_id', user.id).eq('preference_key', 'drchrono_panel').single()
          if (data?.preference_value) {
            const p = data.preference_value as PanelPrefs
            setPanelWidth(p.width || 620)
            setWidthLocked(p.locked || false)
            setAccentIndex(p.accentIndex || 0)
            setPanelPos({ x: p.posX ?? null, y: p.posY ?? null })
            setPrefs(p)
          }
        }
      } catch { /* no saved prefs yet */ }
      setPrefsLoaded(true)
    }
    loadPrefs()
  }, [isOpen, prefsLoaded])

  // Save prefs to Supabase
  const savePrefs = async (updates: Partial<PanelPrefs>) => {
    const newPrefs = { ...prefs, ...updates }
    setPrefs(newPrefs)
    // Also save to localStorage as fallback
    try { localStorage.setItem('drchrono-panel-prefs', JSON.stringify(newPrefs)) } catch {}
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('doctor_preferences').upsert({ doctor_id: user.id, preference_key: 'drchrono_panel', preference_value: newPrefs, updated_at: new Date().toISOString() }, { onConflict: 'doctor_id,preference_key' })
      }
    } catch (e) { console.error('[DrChrono Prefs Save]', e) }
  }

  const saveWidth = () => {
    setWidthLocked(true)
    savePrefs({ width: panelWidth, locked: true })
  }

  const unlockWidth = () => {
    setWidthLocked(false)
    savePrefs({ locked: false })
  }

  const changeAccent = (idx: number) => {
    setAccentIndex(idx)
    setShowColorPicker(false)
    savePrefs({ accentIndex: idx })
  }

  const savePosition = () => {
    savePrefs({ posX: panelPos.x, posY: panelPos.y })
  }

  const resetPosition = () => {
    setPanelPos({ x: null, y: null })
    savePrefs({ posX: null, posY: null })
  }

  // Check connection on mount
  useEffect(() => {
    if (isOpen && connected === null) {
      checkConnection()
    }
  }, [isOpen])

  // Auto-search and auto-select if patientName is passed (from appointment)
  useEffect(() => {
    if (isOpen && patientName && connected === true && !selectedPatient) {
      setSearchQuery(patientName)
      const timer = setTimeout(() => {
        searchPatientsByName(patientName, true)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, patientName, connected])

  // Resize handler — disabled when locked
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (widthLocked) return
    e.preventDefault()
    resizeRef.current = { startX: e.clientX, startWidth: panelWidth }
    const onMove = (ev: MouseEvent) => { if (!resizeRef.current) return; const diff = resizeRef.current.startX - ev.clientX; setPanelWidth(Math.max(420, Math.min(window.innerWidth * 0.85, resizeRef.current.startWidth + diff))) }
    const onUp = () => { resizeRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = '' }
    document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [panelWidth, widthLocked])

  // Drag handler — drag from header grip
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const currentX = panelPos.x ?? (window.innerWidth - panelWidth)
    const currentY = panelPos.y ?? 0
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: currentX, startPosY: currentY }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      const newX = Math.max(0, Math.min(window.innerWidth - 200, dragRef.current.startPosX + dx))
      const newY = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startPosY + dy))
      setPanelPos({ x: newX, y: newY })
    }
    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Auto-save position after drag
      savePrefs({ posX: panelPos.x, posY: panelPos.y })
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelPos, panelWidth])

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
  const searchPatientsByName = async (name: string, autoSelect = false): Promise<DrChronoPatient[]> => {
    if (!name.trim()) return []
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
      const patients = data.patients || []
      setSearchResults(patients)
      if (patients.length === 0) setError('No patients found in DrChrono')
      // Auto-select first result when opened from appointment
      if (autoSelect && patients.length > 0) {
        await selectPatient(patients[0])
      }
      return patients
    } catch (e: any) {
      console.error('[DrChrono Search]', e)
      setError(e.message)
      return []
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
    setSearchQuery(`${patient.first_name} ${patient.last_name}`)
    setSearchResults([])
    setSyncStatus('idle')
    setSyncMessage('')
    // Fetch all data for this patient
    const [meds, , probs, allgs] = await Promise.all([
      fetchMedications(patient.id),
      fetchAppointments(patient.id),
      fetchProblems(patient.id),
      fetchAllergies(patient.id),
    ])
    if (medazonPatientId) await syncToSupabase(meds, probs, allgs)
  }

  // ═══ DATA FETCHERS ═══
  const fetchMedications = async (patientId: number): Promise<Medication[]> => {
    try {
      const res = await fetch(`/api/drchrono/medications?patient_id=${patientId}`)
      const data = await res.json()
      const m = data.medications || []; setMedications(m); return m
    } catch (e) { console.error('[DrChrono Meds]', e); return [] }
  }

  const fetchAppointments = async (patientId: number): Promise<Appointment[]> => {
    try {
      const res = await fetch(`/api/drchrono/appointments?patient_id=${patientId}`)
      const data = await res.json()
      const a = data.appointments || []; setAppointments(a); return a
    } catch (e) { console.error('[DrChrono Appts]', e); return [] }
  }

  const fetchProblems = async (patientId: number): Promise<Problem[]> => {
    try {
      const res = await fetch(`/api/drchrono/problems?patient_id=${patientId}`)
      const data = await res.json()
      const p = data.problems || []; setProblems(p); return p
    } catch (e) { console.error('[DrChrono Problems]', e); return [] }
  }

  const fetchAllergies = async (patientId: number): Promise<Allergy[]> => {
    try {
      const res = await fetch(`/api/drchrono/allergies?patient_id=${patientId}`)
      const data = await res.json()
      const a = data.allergies || []; setAllergies(a); return a
    } catch (e) { console.error('[DrChrono Allergies]', e); return [] }
  }

  // ═══ SYNC TO SUPABASE ═══
  const syncToSupabase = async (meds: Medication[], probs: Problem[], allgs: Allergy[]) => {
    if (!medazonPatientId) { setSyncMessage('No Medazon patient ID'); setSyncStatus('error'); return }
    setSyncStatus('syncing'); setSyncMessage('Syncing DrChrono data to Medazon...')
    let synced = 0; let errors = 0
    try {
      for (const a of allgs) {
        const name = a.reaction || 'Unknown'
        const { data: ex } = await supabase.from('patient_allergies').select('id').eq('patient_id', medazonPatientId).eq('allergen_name', name).limit(1)
        if (!ex || ex.length === 0) {
          const { error: e } = await supabase.from('patient_allergies').insert({ patient_id: medazonPatientId, allergen_name: name, reaction: a.notes || '', status: a.status || 'active', recorded_at: new Date().toISOString() })
          if (e) { console.error('[Sync Allergy]', e); errors++ } else synced++
        }
      }
      for (const m of meds) {
        const name = m.name || 'Unknown'
        const { data: ex } = await supabase.from('patient_medications').select('id').eq('patient_id', medazonPatientId).eq('medication_name', name).limit(1)
        if (!ex || ex.length === 0) {
          const ins: any = { patient_id: medazonPatientId, medication_name: name, status: m.status || 'active', recorded_at: new Date().toISOString() }
          if (m.date_started_taking) ins.start_taking_datetime = m.date_started_taking
          if (m.date_stopped_taking) ins.end_taking_datetime = m.date_stopped_taking
          const { error: e } = await supabase.from('patient_medications').insert(ins)
          if (e) { console.error('[Sync Med]', e); errors++ } else synced++
        }
      }
      for (const p of probs) {
        const name = p.name || 'Unknown'
        const { data: ex } = await supabase.from('problems').select('id').eq('patient_id', medazonPatientId).eq('problem_name', name).limit(1)
        if (!ex || ex.length === 0) {
          const { error: e } = await supabase.from('problems').insert({ patient_id: medazonPatientId, problem_name: name, status: p.status || 'active' })
          if (e) { console.error('[Sync Problem]', e); errors++ } else synced++
        }
      }
      if (errors > 0) { setSyncStatus('error'); setSyncMessage(`Synced ${synced}, ${errors} failed`) }
      else if (synced > 0) { setSyncStatus('synced'); setSyncMessage(`${synced} new records synced to Medazon`) }
      else { setSyncStatus('synced'); setSyncMessage('All records already in Medazon') }
    } catch (err: any) { setSyncStatus('error'); setSyncMessage(err.message || 'Sync failed') }
  }

  const handleManualSync = async () => { await syncToSupabase(medications, problems, allergies) }

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
    setSyncStatus('idle')
    setSyncMessage('')
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

      {/* Panel - draggable + resizable */}
      <div className={`fixed z-[201] flex flex-col rounded-lg shadow-2xl ${panelPos.x !== null ? '' : 'top-0 right-0 h-full'}`}
        style={{
          width: `${panelWidth}px`,
          maxWidth: '95vw',
          background: accent.gradient,
          borderLeft: `1px solid ${accent.border}`,
          border: panelPos.x !== null ? `1px solid ${accent.border}` : undefined,
          ...(panelPos.x !== null ? { left: `${panelPos.x}px`, top: `${panelPos.y ?? 0}px`, height: '85vh', borderRadius: '12px' } : { height: '100%' }),
        }}>

        {/* Resize handle — disabled when locked */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 z-[202] group ${widthLocked ? 'cursor-default' : 'cursor-ew-resize'}`} onMouseDown={handleResizeStart}>
          <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors`} style={{ backgroundColor: widthLocked ? `${accent.value}33` : undefined }} />
        </div>

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-4 h-14 border-b flex-shrink-0" style={{ borderColor: `${accent.value}15` }}>
          <div className="flex items-center gap-2">
            {/* Drag handle */}
            <div className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/[0.06] transition-colors" onMouseDown={handleDragStart} title="Drag to move">
              <GripHorizontal className="w-4 h-4 text-[#4A5568]" />
            </div>
            {selectedPatient && (
              <button onClick={backToSearch} className="text-[#7B8CA3] hover:text-white transition-colors text-xs">
                ← Back
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: accent.bg }}>
                <span className="text-sm">🏥</span>
              </div>
              <span className="text-[13px] font-semibold text-[#E8ECF1]">DrChrono EHR</span>
              {connected === true && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              {connected === false && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {connected === false && (
              <button onClick={handleConnect}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-colors" style={{ background: accent.value }}>
                Connect
              </button>
            )}
            {/* Color picker toggle */}
            <div className="relative">
              <button onClick={() => setShowColorPicker(v => !v)} title="Change accent color"
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors">
                <Palette className="w-3.5 h-3.5" style={{ color: accent.value }} />
              </button>
              {showColorPicker && (
                <div className="absolute top-full right-0 mt-1 p-2 rounded-xl border shadow-xl z-[210] flex gap-1.5"
                  style={{ background: '#151D28', borderColor: `${accent.value}30` }}>
                  {ACCENT_COLORS.map((c, i) => (
                    <button key={c.name} onClick={() => changeAccent(i)} title={c.name}
                      className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                      style={{ background: c.value, borderColor: i === accentIndex ? '#fff' : 'transparent' }} />
                  ))}
                </div>
              )}
            </div>
            {/* Reset position */}
            {panelPos.x !== null && (
              <button onClick={resetPosition} title="Reset to default position"
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors">
                <RefreshCw className="w-3.5 h-3.5 text-[#7B8CA3]" />
              </button>
            )}
            {/* Lock/unlock size */}
            <button onClick={widthLocked ? unlockWidth : saveWidth} title={widthLocked ? 'Unlock size (allow resize)' : 'Lock current size'}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: widthLocked ? accent.bg : undefined }}>
              {widthLocked ? <Lock className="w-3.5 h-3.5" style={{ color: accent.value }} /> : <Unlock className="w-3.5 h-3.5 text-[#7B8CA3]" />}
            </button>
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all border ${
                    active ? '' : 'text-[#7B8CA3] hover:text-white hover:bg-white/[0.04] border-transparent'
                  }`} style={active ? { background: `${accent.value}20`, borderColor: `${accent.value}40`, color: accent.value } : {}}>
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="text-[9px] px-1.5 rounded-full" style={active ? { background: `${accent.value}30` } : { background: 'rgba(255,255,255,0.08)', color: '#7B8CA3' }}>
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

        {/* Sync Status */}
        {selectedPatient && syncStatus !== 'idle' && (
          <div className={`px-4 py-2 flex items-center gap-2 text-[11px] border-b border-white/[0.06] ${syncStatus === 'syncing' ? 'bg-blue-500/[0.08] text-blue-300' : syncStatus === 'synced' ? 'bg-emerald-500/[0.08] text-emerald-300' : 'bg-red-500/[0.08] text-red-300'}`}>
            {syncStatus === 'syncing' && <Loader2 className="w-3 h-3 animate-spin" />}
            {syncStatus === 'synced' && <Check className="w-3 h-3" />}
            {syncStatus === 'error' && <AlertTriangle className="w-3 h-3" />}
            <span>{syncMessage}</span>
          </div>
        )}

        {/* ── QUICK SEARCH BAR (when patient is selected) ── */}
        {selectedPatient && (
          <div className="px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4A5568]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && searchQuery.trim()) searchPatientsByName(searchQuery) }}
                  placeholder="Search another patient..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#151D28] border border-[#1E2A3A] text-[11px] text-white placeholder-[#4A5568] focus:outline-none transition-colors"
                  style={{ borderColor: undefined }}
                />
              </div>
              <button onClick={() => searchQuery.trim() && searchPatientsByName(searchQuery)} disabled={loading || !searchQuery.trim()}
                className="px-3 py-1.5 rounded-lg text-white text-[10px] font-semibold disabled:opacity-40 transition-colors" style={{ background: accent.value }}>
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Go'}
              </button>
            </div>
            {/* Quick search results dropdown */}
            {searchResults.length > 0 && activeTab !== 'search' && searchQuery !== (selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : '') && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-[#1E2A3A] bg-[#151D28]">
                {searchResults.map(p => (
                  <button key={p.id} onClick={() => { selectPatient(p); setSearchQuery(`${p.first_name} ${p.last_name}`) }}
                    className="w-full text-left px-3 py-2 text-[11px] text-[#E8ECF1] hover:bg-white/[0.04] transition-colors border-b border-white/[0.03] last:border-0">
                    {p.first_name} {p.last_name} <span className="text-[#4A5568]">· {p.chart_id || 'N/A'}</span>
                  </button>
                ))}
              </div>
            )}
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
                  className="px-4 py-2.5 rounded-xl text-white text-xs font-semibold disabled:opacity-40 transition-colors flex items-center gap-2" style={{ background: accent.value }}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Search
                </button>
              </div>

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map(p => (
                    <button key={p.id} onClick={() => selectPatient(p)}
                      className="w-full text-left p-4 rounded-xl bg-[#151D28] border border-[#1E2A3A] hover:bg-[#1A2332] transition-all group" style={{ ['--hover-border' as any]: `${accent.value}40` }}>
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
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${accent.value}, ${accent.value}88)` }}>
                    <span className="text-lg font-bold text-white">
                      {selectedPatient.first_name?.[0]}{selectedPatient.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">{selectedPatient.first_name} {selectedPatient.last_name}</h3>
                    <p className="text-[11px] text-[#7B8CA3]">Chart ID: {selectedPatient.chart_id} · DrChrono #{selectedPatient.id}</p>
                  </div>
                  {medazonPatientId && <button onClick={handleManualSync} disabled={syncStatus === 'syncing'} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${syncStatus === 'synced' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : syncStatus === 'syncing' ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'bg-white/[0.04] text-[#7B8CA3] border border-[#1E2A3A] hover:text-white hover:border-white/[0.15]'}`}>
                    {syncStatus === 'syncing' ? <Loader2 className="w-3 h-3 animate-spin" /> : syncStatus === 'synced' ? <Check className="w-3 h-3" /> : <Database className="w-3 h-3" />}
                    {syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Syncing...' : 'Sync to Medazon'}
                  </button>}
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
              {medazonPatientId ? 'Data synced to Medazon DB' : 'Live from DrChrono API'} · {widthLocked ? `Size locked (${panelWidth}px)` : 'Drag left edge to resize'}
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


