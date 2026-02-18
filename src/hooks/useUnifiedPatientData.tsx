'use client'

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'

// ═══════════════════════════════════════════════════════════════
// Unified Patient Data — Load ALL data in ONE call, auto-save
//
// Replaces per-panel API calls. No auth issues. One fetch gets
// everything. Changes auto-save 2 seconds after doctor stops typing.
// ═══════════════════════════════════════════════════════════════

export interface UnifiedPatientData {
  patient: any
  drchrono_patient_id: number | null
  demographics: any
  medications: { local: any[]; drchrono: any[] }
  allergies: { local: any[]; drchrono: any[] }
  problems: { local: any[]; drchrono: any[] }
  vitals: any[]
  appointments: any[]
  clinical_notes: { local: any[]; drchrono: any[] }
  documents: { local: any[]; drchrono: any[] }
  lab_results: { local: any[]; drchrono: any[] }
  immunizations: any[]
  insurance: any[]
  history: { family: any[]; social: any[]; surgical: any[] }
  prescriptions: any[]
  orders: any[]
  billing: { claims: any[]; payments: any[] }
  care_plans: any[]
  alerts: any[]
  pharmacy: any
}

interface UnifiedContextValue {
  data: UnifiedPatientData | null
  loading: boolean
  error: string | null
  patientId: string | null
  refetch: () => Promise<void>
  updateRecord: (table: string, id: string, updates: any) => Promise<void>
  createRecord: (table: string, record: any) => Promise<any>
  deleteRecord: (table: string, id: string) => Promise<void>
  queueSave: (table: string, id: string, updates: any) => void
  saving: boolean
  lastSaved: Date | null
}

const UnifiedPatientDataContext = createContext<UnifiedContextValue | null>(null)

export function useUnifiedPatientData() {
  const ctx = useContext(UnifiedPatientDataContext)
  if (!ctx) throw new Error('useUnifiedPatientData must be inside UnifiedPatientDataProvider')
  return ctx
}

export function UnifiedPatientDataProvider({
  patientId,
  children,
}: {
  patientId: string | null
  children: React.ReactNode
}) {
  const [data, setData] = useState<UnifiedPatientData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({})

  const fetchData = useCallback(async () => {
    if (!patientId) { setData(null); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/patient-data?patient_id=${patientId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to load patient data')
      } else {
        setData(json)
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { fetchData() }, [fetchData])

  const updateRecord = useCallback(async (table: string, id: string, updates: any) => {
    setSaving(true)
    try {
      const res = await fetch('/api/patient-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id, updates, patient_id: patientId }),
      })
      const json = await res.json()
      if (res.ok) {
        setLastSaved(new Date())
        setData(prev => prev ? updateLocalData(prev, table, id, json.data) : prev)
      } else {
        console.error(`[auto-save] ${table}/${id}:`, json.error)
      }
    } catch (err: any) {
      console.error(`[auto-save] ${table}/${id}:`, err)
    } finally {
      setSaving(false)
    }
  }, [patientId])

  const createRecord = useCallback(async (table: string, record: any) => {
    setSaving(true)
    try {
      const res = await fetch('/api/patient-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, record: { ...record, patient_id: patientId } }),
      })
      const json = await res.json()
      if (res.ok) {
        setLastSaved(new Date())
        setData(prev => prev ? addToLocalData(prev, table, json.data) : prev)
        return json.data
      }
      console.error(`[create] ${table}:`, json.error)
      return null
    } catch (err: any) {
      console.error(`[create] ${table}:`, err)
      return null
    } finally {
      setSaving(false)
    }
  }, [patientId])

  const deleteRecord = useCallback(async (table: string, id: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/patient-data?table=${table}&id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setLastSaved(new Date())
        setData(prev => prev ? removeFromLocalData(prev, table, id) : prev)
      }
    } catch (err: any) {
      console.error(`[delete] ${table}/${id}:`, err)
    } finally {
      setSaving(false)
    }
  }, [])

  const queueSave = useCallback((table: string, id: string, updates: any) => {
    const key = `${table}:${id}`
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(() => {
      updateRecord(table, id, updates)
      delete saveTimers.current[key]
    }, 2000)
  }, [updateRecord])

  useEffect(() => {
    return () => { Object.values(saveTimers.current).forEach(clearTimeout) }
  }, [])

  return (
    <UnifiedPatientDataContext.Provider value={{
      data, loading, error, patientId,
      refetch: fetchData, updateRecord, createRecord, deleteRecord, queueSave,
      saving, lastSaved,
    }}>
      {children}
    </UnifiedPatientDataContext.Provider>
  )
}

// ── Table path mapping ──
const TABLE_PATH: Record<string, string[]> = {
  'patient_medications': ['medications', 'local'],
  'patient_allergies': ['allergies', 'local'],
  'patient_problems': ['problems', 'local'],
  'patient_vitals': ['vitals'],
  'clinical_notes': ['clinical_notes', 'local'],
  'patient_documents': ['documents', 'local'],
  'patient_immunizations': ['immunizations'],
  'patient_insurance': ['insurance'],
  'patient_family_history': ['history', 'family'],
  'patient_social_history': ['history', 'social'],
  'patient_surgical_history': ['history', 'surgical'],
  'prescriptions': ['prescriptions'],
  'lab_orders': ['orders'],
  'lab_results': ['lab_results', 'local'],
  'billing_claims': ['billing', 'claims'],
  'billing_payments': ['billing', 'payments'],
  'care_plans': ['care_plans'],
  'cdss_alerts': ['alerts'],
  'appointments': ['appointments'],
}

function getArr(obj: any, path: string[]): any[] {
  let c = obj; for (const k of path) { if (!c) return []; c = c[k] }
  return Array.isArray(c) ? c : []
}

function setArr(obj: any, path: string[], val: any[]): any {
  const r = { ...obj }
  if (path.length === 1) r[path[0]] = val
  else if (path.length === 2) r[path[0]] = { ...r[path[0]], [path[1]]: val }
  return r
}

function updateLocalData(data: UnifiedPatientData, table: string, id: string, updated: any): UnifiedPatientData {
  if (table === 'patients') return { ...data, patient: { ...data.patient, ...updated } }
  const path = TABLE_PATH[table] || [table]
  return setArr(data, path, getArr(data, path).map((i: any) => i.id === id ? { ...i, ...updated } : i)) as UnifiedPatientData
}

function addToLocalData(data: UnifiedPatientData, table: string, record: any): UnifiedPatientData {
  const path = TABLE_PATH[table] || [table]
  return setArr(data, path, [record, ...getArr(data, path)]) as UnifiedPatientData
}

function removeFromLocalData(data: UnifiedPatientData, table: string, id: string): UnifiedPatientData {
  const path = TABLE_PATH[table] || [table]
  return setArr(data, path, getArr(data, path).filter((i: any) => i.id !== id)) as UnifiedPatientData
}

// ── Drop-in replacement for usePanelData ──
// Individual panels call this to get their slice of data
export function usePanelFromUnified(panelType: string) {
  const ctx = useUnifiedPatientData()

  const PANEL_TO_TABLE: Record<string, string> = {
    'medications': 'patient_medications',
    'medication-history': 'patient_medications',
    'allergies': 'patient_allergies',
    'problems': 'patient_problems',
    'vitals': 'patient_vitals',
    'clinical-notes': 'clinical_notes',
    'documents': 'patient_documents',
    'immunizations': 'patient_immunizations',
    'insurance': 'patient_insurance',
    'prescriptions': 'prescriptions',
    'prescription-history': 'prescriptions',
    'orders': 'lab_orders',
    'lab-results': 'lab_results',
    'billing': 'billing_claims',
    'care-plans': 'care_plans',
    'alerts': 'cdss_alerts',
    'appointments': 'appointments',
    'patient-appointments': 'appointments',
  }

  const PANEL_TO_LOCAL: Record<string, string[]> = {
    'medications': ['medications', 'local'],
    'medication-history': ['medications', 'local'],
    'allergies': ['allergies', 'local'],
    'problems': ['problems', 'local'],
    'vitals': ['vitals'],
    'clinical-notes': ['clinical_notes', 'local'],
    'documents': ['documents', 'local'],
    'lab-results': ['lab_results', 'local'],
    'immunizations': ['immunizations'],
    'insurance': ['insurance'],
    'prescriptions': ['prescriptions'],
    'prescription-history': ['prescriptions'],
    'orders': ['orders'],
    'billing': ['billing', 'claims'],
    'care-plans': ['care_plans'],
    'alerts': ['alerts'],
    'appointments': ['appointments'],
    'patient-appointments': ['appointments'],
  }

  const PANEL_TO_DC: Record<string, string[]> = {
    'medications': ['medications', 'drchrono'],
    'medication-history': ['medications', 'drchrono'],
    'allergies': ['allergies', 'drchrono'],
    'problems': ['problems', 'drchrono'],
    'clinical-notes': ['clinical_notes', 'drchrono'],
    'documents': ['documents', 'drchrono'],
    'lab-results': ['lab_results', 'drchrono'],
  }

  const tableName = PANEL_TO_TABLE[panelType] || panelType
  const localPath = PANEL_TO_LOCAL[panelType] || []
  const dcPath = PANEL_TO_DC[panelType] || []

  const localData = ctx.data && localPath.length ? getArr(ctx.data, localPath) : []
  const dcData = ctx.data && dcPath.length ? getArr(ctx.data, dcPath) : []

  return {
    data: localData,
    drchronoData: dcData,
    loading: ctx.loading,
    error: ctx.error,
    refetch: ctx.refetch,
    saving: ctx.saving,
    create: async (record: any) => ctx.createRecord(tableName, record),
    update: async (id: string | number, updates: any) => ctx.updateRecord(tableName, String(id), updates),
    remove: async (id: string | number) => ctx.deleteRecord(tableName, String(id)),
    queueSave: (id: string, updates: any) => ctx.queueSave(tableName, id, updates),
  }
}
