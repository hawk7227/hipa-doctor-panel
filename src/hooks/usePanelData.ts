// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════
// usePanelData — Generic EHR panel data hook
//
// All panels use this for data fetching via API routes.
// No direct Supabase calls from client.
// Supports: fetch, create, update, delete, refetch
// ═══════════════════════════════════════════════════════════════

interface UsePanelDataOptions {
  /** Panel API endpoint name (e.g. 'allergies', 'medications') */
  endpoint: string
  /** Patient UUID */
  patientId: string | null
  /** Auto-fetch on mount? (default true) */
  autoFetch?: boolean
}

interface UsePanelDataReturn<T = any> {
  data: T[]
  drchronoData: T[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  create: (record: Partial<T>) => Promise<{ data?: T; error?: string }>
  update: (id: string | number, updates: Partial<T>) => Promise<{ data?: T; error?: string }>
  remove: (id: string | number) => Promise<{ success?: boolean; error?: string }>
  saving: boolean
}

export function usePanelData<T = any>({ endpoint, patientId, autoFetch = true }: UsePanelDataOptions): UsePanelDataReturn<T> {
  const [data, setData] = useState<T[]>([])
  const [drchronoData, setDrchronoData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Map endpoint name to table paths in unified response
  const ENDPOINT_TO_LOCAL: Record<string, string[]> = {
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
    'demographics': ['demographics'],
    'history': ['history'],
    'pharmacy': ['pharmacy'],
    'cohorts': ['alerts'],
    'ai-interactions': ['alerts'],
    'amendments': ['clinical_notes', 'local'],
    'prior-auth': ['insurance'],
    'referrals': ['orders'],
    'tasks': ['alerts'],
    'quality-measures': ['alerts'],
  }
  const ENDPOINT_TO_DC: Record<string, string[]> = {
    'medications': ['medications', 'drchrono'],
    'medication-history': ['medications', 'drchrono'],
    'allergies': ['allergies', 'drchrono'],
    'problems': ['problems', 'drchrono'],
    'clinical-notes': ['clinical_notes', 'drchrono'],
    'documents': ['documents', 'drchrono'],
    'lab-results': ['lab_results', 'drchrono'],
  }
  const ENDPOINT_TO_TABLE: Record<string, string> = {
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

  function getArr(obj: any, path: string[]): any[] {
    let c = obj; for (const k of path) { if (!c) return []; c = c[k] }
    return Array.isArray(c) ? c : (c ? [c] : [])
  }

  const fetchData = useCallback(async () => {
    if (!patientId) { setData([]); setDrchronoData([]); return }
    setLoading(true)
    setError(null)
    try {
      // Use unified endpoint — NO AUTH, loads all data in one call
      const res = await fetch(`/api/patient-data?patient_id=${patientId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `Failed to load ${endpoint}`)
      } else {
        // Extract this panel's slice from the unified response
        const localPath = ENDPOINT_TO_LOCAL[endpoint] || []
        const dcPath = ENDPOINT_TO_DC[endpoint] || []
        const localData = localPath.length > 0 ? getArr(json, localPath) : (json.data || [])
        const dcData = dcPath.length > 0 ? getArr(json, dcPath) : (json.drchrono_data || [])
        setData(localData as T[])
        setDrchronoData(dcData as T[])
      }
    } catch (err: any) {
      setError(err.message || `Network error loading ${endpoint}`)
    } finally {
      setLoading(false)
    }
  }, [endpoint, patientId])

  useEffect(() => {
    if (autoFetch) fetchData()
  }, [fetchData, autoFetch])

  const tableName = ENDPOINT_TO_TABLE[endpoint] || endpoint

  const create = useCallback(async (record: Partial<T>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/patient-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName, record: { ...record, patient_id: patientId } }),
      })
      const json = await res.json()
      if (!res.ok) return { error: json.error || 'Failed to create' }
      setData(prev => [json.data, ...prev])
      return { data: json.data }
    } catch (err: any) {
      return { error: err.message }
    } finally {
      setSaving(false)
    }
  }, [tableName, patientId])

  const update = useCallback(async (id: string | number, updates: Partial<T>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/patient-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName, id: String(id), updates }),
      })
      const json = await res.json()
      if (!res.ok) return { error: json.error || 'Failed to update' }
      setData(prev => prev.map((item: any) => (item.id === id ? json.data : item)))
      return { data: json.data }
    } catch (err: any) {
      return { error: err.message }
    } finally {
      setSaving(false)
    }
  }, [tableName, patientId])

  const remove = useCallback(async (id: string | number) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/patient-data?table=${tableName}&id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) return { error: json.error || 'Failed to delete' }
      setData(prev => prev.filter((item: any) => item.id !== id))
      return { success: true }
    } catch (err: any) {
      return { error: err.message }
    } finally {
      setSaving(false)
    }
  }, [tableName, patientId])

  return { data, drchronoData, loading, error, refetch: fetchData, create, update, remove, saving }
}
