// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getLocalDB, getDeviceId, nowISO, generateId } from '@/lib/local-db'
import { getSyncEngine } from '@/lib/sync-engine'
import type { MedicationRecord, CreateMedicationInput } from '@/types/medication'

interface UseMedicationsReturn {
  medications: MedicationRecord[]
  loading: boolean
  error: string | null
  isStale: boolean
  isOffline: boolean
  add: (input: CreateMedicationInput) => Promise<{ data?: MedicationRecord; error?: string }>
  update: (id: string, updates: Partial<MedicationRecord>) => Promise<{ data?: MedicationRecord; error?: string }>
  discontinue: (id: string, reason?: string) => Promise<{ data?: MedicationRecord; error?: string }>
  remove: (id: string) => Promise<{ success?: boolean; error?: string }>
  refresh: () => Promise<void>
}

export function useMedications(patientId: string | null): UseMedicationsReturn {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const lastFetchRef = useRef<number>(0)

  // Live query from Dexie — auto-updates when IndexedDB changes
  const cachedMeds = useLiveQuery(
    async () => {
      if (!patientId) return []
      try {
        const db = getLocalDB()
        return await db.medications.where('patient_id').equals(patientId).toArray()
      } catch {
        return []
      }
    },
    [patientId],
    []
  )

  // Fetch from server in background
  const fetchFromServer = useCallback(async () => {
    if (!patientId) return
    try {
      const res = await fetch(`/api/medications?patient_id=${patientId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const serverMeds: MedicationRecord[] = json.data || []

      // Upsert into Dexie cache
      const db = getLocalDB()
      const deviceId = getDeviceId()
      const records = serverMeds.map(m => ({
        ...m,
        is_active: m.status === 'active' || m.status === 'on_hold',
        source: 'server',
        _synced: 1,
        _device_id: deviceId,
      }))
      await db.medications.bulkPut(records)

      setIsStale(false)
      setIsOffline(false)
      setError(null)
      lastFetchRef.current = Date.now()
    } catch (err: any) {
      console.log('[useMedications] Server fetch failed, serving cached data:', err.message)
      setIsOffline(true)
      if (lastFetchRef.current > 0) {
        setIsStale(true)
      }
    }
  }, [patientId])

  // Initial load: read from Dexie immediately, fetch server in background
  useEffect(() => {
    if (!patientId) {
      setLoading(false)
      return
    }
    setLoading(true)
    // Small delay to let Dexie live query populate first
    const timer = setTimeout(() => {
      fetchFromServer().finally(() => setLoading(false))
    }, 100)
    return () => clearTimeout(timer)
  }, [patientId, fetchFromServer])

  // Convert cached Dexie records to MedicationRecord shape
  const medications: MedicationRecord[] = (cachedMeds || []).map((m: any) => ({
    id: m.id,
    patient_id: m.patient_id,
    medication_name: m.medication_name,
    dosage: m.dosage || null,
    frequency: m.frequency || null,
    route: m.route || null,
    prescriber: m.prescriber || null,
    start_date: m.start_date || null,
    end_date: m.end_date || null,
    status: m.status || (m.is_active ? 'active' : 'discontinued'),
    is_prn: m.is_prn || false,
    prn_reason: m.prn_reason || null,
    side_effects: m.side_effects || null,
    adherence_score: m.adherence_score ?? null,
    notes: m.notes || null,
    is_deleted: m.is_deleted || false,
    created_at: m.created_at || nowISO(),
    updated_at: m.updated_at || null,
  })).filter((m: MedicationRecord) => !m.is_deleted)

  const add = useCallback(async (input: CreateMedicationInput) => {
    try {
      // Optimistic: write to Dexie first
      const id = generateId()
      const record = {
        id,
        patient_id: input.patient_id,
        medication_name: input.medication_name,
        dosage: input.dosage || null,
        frequency: input.frequency || null,
        route: input.route || 'oral',
        prescriber: input.prescriber || null,
        start_date: input.start_date || null,
        end_date: input.end_date || null,
        status: input.status || 'active',
        is_prn: input.is_prn || false,
        prn_reason: input.prn_reason || null,
        side_effects: input.side_effects || null,
        adherence_score: input.adherence_score ?? null,
        notes: input.notes || null,
        is_deleted: false,
        is_active: true,
        source: 'local',
        created_at: nowISO(),
        updated_at: null,
        _synced: 0,
        _device_id: getDeviceId(),
      }
      const db = getLocalDB()
      await db.medications.put(record)

      // Server call
      try {
        const res = await fetch('/api/medications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const json = await res.json()
        if (res.ok && json.data) {
          // Update Dexie with server-assigned ID
          await db.medications.delete(id)
          await db.medications.put({ ...json.data, is_active: true, source: 'server', _synced: 1, _device_id: getDeviceId() })
          return { data: json.data }
        }
      } catch {
        // Enqueue for sync
        getSyncEngine().enqueue('medications', id, 'create', record)
      }

      return { data: record as unknown as MedicationRecord }
    } catch (err: any) {
      return { error: err.message }
    }
  }, [])

  const update = useCallback(async (id: string, updates: Partial<MedicationRecord>) => {
    try {
      const db = getLocalDB()
      await db.medications.update(id, { ...updates, _synced: 0, updated_at: nowISO() })

      try {
        const res = await fetch(`/api/medications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        const json = await res.json()
        if (res.ok && json.data) {
          await db.medications.put({ ...json.data, is_active: json.data.status === 'active', source: 'server', _synced: 1, _device_id: getDeviceId() })
          return { data: json.data }
        }
      } catch {
        getSyncEngine().enqueue('medications', id, 'update', updates)
      }

      return { data: updates as MedicationRecord }
    } catch (err: any) {
      return { error: err.message }
    }
  }, [])

  const discontinue = useCallback(async (id: string, reason?: string) => {
    return update(id, { status: 'discontinued', end_date: nowISO(), notes: reason || undefined } as any)
  }, [update])

  const remove = useCallback(async (id: string) => {
    try {
      const db = getLocalDB()
      await db.medications.update(id, { is_deleted: true, is_active: false, _synced: 0 } as any)

      try {
        const res = await fetch(`/api/medications/${id}`, { method: 'DELETE' })
        if (res.ok) {
          await db.medications.delete(id)
          return { success: true }
        }
      } catch {
        getSyncEngine().enqueue('medications', id, 'delete', { id })
      }

      return { success: true }
    } catch (err: any) {
      return { error: err.message }
    }
  }, [])

  return {
    medications,
    loading,
    error,
    isStale,
    isOffline,
    add,
    update,
    discontinue,
    remove,
    refresh: fetchFromServer,
  }
}
