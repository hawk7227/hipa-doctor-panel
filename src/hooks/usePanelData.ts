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

  const fetchData = useCallback(async () => {
    if (!patientId) { setData([]); setDrchronoData([]); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/panels/${endpoint}?patient_id=${patientId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `Failed to load ${endpoint}`)
      } else {
        setData(json.data || [])
        setDrchronoData(json.drchrono_data || [])
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

  const create = useCallback(async (record: Partial<T>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/panels/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...record, patient_id: patientId }),
      })
      const json = await res.json()
      if (!res.ok) return { error: json.error || 'Failed to create' }
      // Optimistic: prepend to local data
      setData(prev => [json.data, ...prev])
      return { data: json.data }
    } catch (err: any) {
      return { error: err.message }
    } finally {
      setSaving(false)
    }
  }, [endpoint, patientId])

  const update = useCallback(async (id: string | number, updates: Partial<T>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/panels/${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      const json = await res.json()
      if (!res.ok) return { error: json.error || 'Failed to update' }
      // Optimistic: update in local data
      setData(prev => prev.map((item: any) => (item.id === id ? json.data : item)))
      return { data: json.data }
    } catch (err: any) {
      return { error: err.message }
    } finally {
      setSaving(false)
    }
  }, [endpoint, patientId])

  const remove = useCallback(async (id: string | number) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/panels/${endpoint}?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) return { error: json.error || 'Failed to delete' }
      // Optimistic: remove from local data
      setData(prev => prev.filter((item: any) => item.id !== id))
      return { success: true }
    } catch (err: any) {
      return { error: err.message }
    } finally {
      setSaving(false)
    }
  }, [endpoint, patientId])

  return { data, drchronoData, loading, error, refetch: fetchData, create, update, remove, saving }
}
