// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// OFFLINE STORE — React hooks for local-first data access
//
// Read:  IndexedDB → instant render → server pull updates in bg
// Write: IndexedDB + queue → push when online
//
// Usage:
//   const { data, loading } = useLocalPatients({ search: 'Smith' })
//   const { data: appt } = useLocalAppointment(id)
//   await writeLocal('patients', patientData)
//
// Install: npm install dexie dexie-react-hooks
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getLocalDB, getDeviceId, nowISO, generateId } from './local-db'
import type {
  LocalPatient, LocalAppointment, LocalClinicalNote,
  LocalMedication, LocalAllergy, LocalMessage
} from './local-db'
import { getSyncEngine } from './sync-engine'
import type { SyncStatus } from './sync-engine'

// ── Initialize Sync (call once in app root) ──────────────────

export function useInitSync() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || typeof window === 'undefined') return
    initialized.current = true

    const engine = getSyncEngine()
    engine.init()

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[SW] Registered:', reg.scope)
      }).catch((err) => {
        console.warn('[SW] Registration failed:', err.message)
      })
    }

    return () => { engine.destroy() }
  }, [])
}

// ── Sync Status ──────────────────────────────────────────────

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [pendingCount, setPendingCount] = useState(0)
  const [detail, setDetail] = useState('')

  useEffect(() => {
    const engine = getSyncEngine()
    setStatus(engine.status)

    const unsub = engine.subscribe((s, d) => {
      setStatus(s)
      if (d) setDetail(d)
    })

    const interval = setInterval(async () => {
      setPendingCount(await engine.getPendingCount())
    }, 5000)

    return () => { unsub(); clearInterval(interval) }
  }, [])

  return { status, pendingCount, detail, isOnline: status !== 'offline' }
}

// ── Generic Write/Delete ─────────────────────────────────────

export async function writeLocal(
  table: string,
  data: Record<string, any>,
  action: 'create' | 'update' = 'update'
): Promise<string> {
  const id = data.id || generateId()
  const record = {
    ...data,
    id,
    created_at: data.created_at || nowISO(),
    updated_at: nowISO(),
  }
  await getSyncEngine().enqueue(table, id, action, record)
  return id
}

export async function deleteLocal(table: string, recordId: string): Promise<void> {
  await getSyncEngine().enqueue(table, recordId, 'delete', { id: recordId })
}

// ── Patient Hooks ────────────────────────────────────────────

export function useLocalPatients(opts?: { search?: string; limit?: number }) {
  const db = typeof window !== 'undefined' ? getLocalDB() : null

  const data = useLiveQuery(async () => {
    if (!db) return []
    let all = await db.patients.orderBy('last_name').toArray()

    if (opts?.search) {
      const q = opts.search.toLowerCase()
      all = all.filter(p =>
        p.first_name?.toLowerCase().includes(q) ||
        p.last_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.includes(q)
      )
    }

    return opts?.limit ? all.slice(0, opts.limit) : all
  }, [opts?.search, opts?.limit])

  return { data: data || [], loading: data === undefined, count: data?.length || 0 }
}

export function useLocalPatient(id: string | null) {
  const db = typeof window !== 'undefined' ? getLocalDB() : null

  const data = useLiveQuery(async () => {
    if (!db || !id) return null
    return db.patients.get(id)
  }, [id])

  return { data: data ?? null, loading: data === undefined }
}

// ── Appointment Hooks ────────────────────────────────────────

export function useLocalAppointments(opts?: {
  status?: string | string[]
  doctorId?: string
  patientId?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
}) {
  const db = typeof window !== 'undefined' ? getLocalDB() : null

  const data = useLiveQuery(async () => {
    if (!db) return []
    let results = await db.appointments.toArray()

    if (opts?.status) {
      const s = Array.isArray(opts.status) ? opts.status : [opts.status]
      results = results.filter(a => s.includes(a.status))
    }
    if (opts?.doctorId) results = results.filter(a => a.doctor_id === opts.doctorId)
    if (opts?.patientId) results = results.filter(a => a.patient_id === opts.patientId)
    if (opts?.dateFrom) results = results.filter(a => (a.requested_date_time || '') >= opts.dateFrom!)
    if (opts?.dateTo) results = results.filter(a => (a.requested_date_time || '') <= opts.dateTo!)

    results.sort((a, b) => (b.requested_date_time || '').localeCompare(a.requested_date_time || ''))

    return opts?.limit ? results.slice(0, opts.limit) : results
  }, [opts?.status, opts?.doctorId, opts?.patientId, opts?.dateFrom, opts?.dateTo, opts?.limit])

  return { data: data || [], loading: data === undefined, count: data?.length || 0 }
}

export function useLocalAppointment(id: string | null) {
  const db = typeof window !== 'undefined' ? getLocalDB() : null

  const data = useLiveQuery(async () => {
    if (!db || !id) return null
    return db.appointments.get(id)
  }, [id])

  return { data: data ?? null, loading: data === undefined }
}

// ── Clinical Note Hooks ──────────────────────────────────────

export function useLocalClinicalNote(appointmentId: string | null) {
  const db = typeof window !== 'undefined' ? getLocalDB() : null

  const data = useLiveQuery(async () => {
    if (!db || !appointmentId) return null
    return db.clinicalNotes.where('appointment_id').equals(appointmentId).first()
  }, [appointmentId])

  return { data: data ?? null, loading: data === undefined }
}

export function useLocalClinicalNotes(patientId: string | null) {
  const db = typeof window !== 'undefined' ? getLocalDB() : null

  const data = useLiveQuery(async () => {
    if (!db || !patientId) return []
    return db.clinicalNotes.where('patient_id').equals(patientId).reverse().sortBy('created_at')
  }, [patientId])

  return { data: data || [], loading: data === undefined }
}

// ── Medication Hooks ─────────────────────────────────────────

export function useLocalMedications(patientId: string | null, activeOnly = false) {
  const db = typeof window !== 'undefined' ? getLocalDB() : null

  const data = useLiveQuery(async () => {
    if (!db || !patientId) return []
    let meds = await db.medications.where('patient_id').equals(patientId).toArray()
    if (activeOnly) meds = meds.filter(m => m.is_active)
    return meds
  }, [patientId, activeOnly])

  return { data: data || [], loading: data === undefined }
}

// ── Allergy Hooks ────────────────────────────────────────────

export function useLocalAllergies(patientId: string | null) {
  const db = typeof window !== 'undefined' ? getLocalDB() : null

  const data = useLiveQuery(async () => {
    if (!db || !patientId) return []
    return db.allergies.where('patient_id').equals(patientId).toArray()
  }, [patientId])

  return { data: data || [], loading: data === undefined }
}

// ── Message Hooks ────────────────────────────────────────────

export function useLocalMessages(appointmentId: string | null) {
  const db = typeof window !== 'undefined' ? getLocalDB() : null

  const data = useLiveQuery(async () => {
    if (!db || !appointmentId) return []
    return db.messages.where('appointment_id').equals(appointmentId).sortBy('created_at')
  }, [appointmentId])

  return { data: data || [], loading: data === undefined }
}

// ── Manual Sync Trigger ──────────────────────────────────────

export function useManualSync() {
  const [syncing, setSyncing] = useState(false)

  const sync = useCallback(async () => {
    setSyncing(true)
    const engine = getSyncEngine()
    try {
      await engine.flush()
      await engine.pullAll()
    } finally {
      setSyncing(false)
    }
  }, [])

  const bootstrap = useCallback(async () => {
    setSyncing(true)
    try {
      await getSyncEngine().bootstrap()
    } finally {
      setSyncing(false)
    }
  }, [])

  const retryFailed = useCallback(async () => {
    await getSyncEngine().retryFailed()
  }, [])

  return { sync, bootstrap, syncing, retryFailed }
}

// ── DB Stats ─────────────────────────────────────────────────

export function useLocalDBStats() {
  const db = typeof window !== 'undefined' ? getLocalDB() : null

  const data = useLiveQuery(async () => {
    if (!db) return null
    const [patients, appointments, notes, meds, allergies, messages, pending, failed] = await Promise.all([
      db.patients.count(),
      db.appointments.count(),
      db.clinicalNotes.count(),
      db.medications.count(),
      db.allergies.count(),
      db.messages.count(),
      db.syncQueue.where('synced').equals(0).count(),
      db.syncQueue.where('synced').equals(-1).count(),
    ])
    return { patients, appointments, notes, meds, allergies, messages, pending, failed }
  }, [])

  return data || { patients: 0, appointments: 0, notes: 0, meds: 0, allergies: 0, messages: 0, pending: 0, failed: 0 }
}
