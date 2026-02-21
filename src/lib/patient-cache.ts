// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// Patient Data Cache — IndexedDB Browser-side Storage
// Provides offline fallback when Supabase is unavailable
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'medazon_patient_cache'
const DB_VERSION = 1

const STORES = {
  patients: 'patients',
  medications: 'medications',
  allergies: 'allergies',
  problems: 'problems',
  appointments: 'appointments',
  documents: 'documents',
  meta: 'meta', // stores last sync time, doctor info, etc.
} as const

type StoreName = typeof STORES[keyof typeof STORES]

// ── Open/Init DB ─────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Patients — indexed by id
      if (!db.objectStoreNames.contains(STORES.patients)) {
        const store = db.createObjectStore(STORES.patients, { keyPath: 'id' })
        store.createIndex('last_name', 'last_name', { unique: false })
        store.createIndex('email', 'email', { unique: false })
        store.createIndex('name_search', ['last_name', 'first_name'], { unique: false })
      }

      // Medications — indexed by id
      if (!db.objectStoreNames.contains(STORES.medications)) {
        const store = db.createObjectStore(STORES.medications, { keyPath: 'id' })
        store.createIndex('patient', 'patient_id', { unique: false })
      }

      // Allergies
      if (!db.objectStoreNames.contains(STORES.allergies)) {
        const store = db.createObjectStore(STORES.allergies, { keyPath: 'id' })
        store.createIndex('patient', 'patient_id', { unique: false })
      }

      // Problems
      if (!db.objectStoreNames.contains(STORES.problems)) {
        const store = db.createObjectStore(STORES.problems, { keyPath: 'id' })
        store.createIndex('patient', 'patient_id', { unique: false })
      }

      // Appointments
      if (!db.objectStoreNames.contains(STORES.appointments)) {
        const store = db.createObjectStore(STORES.appointments, { keyPath: 'id' })
        store.createIndex('patient', 'patient_id', { unique: false })
        store.createIndex('scheduled_time', 'scheduled_time', { unique: false })
      }

      // Documents
      if (!db.objectStoreNames.contains(STORES.documents)) {
        const store = db.createObjectStore(STORES.documents, { keyPath: 'id' })
        store.createIndex('patient', 'patient_id', { unique: false })
      }

      // Meta (cache timestamps, doctor info)
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ── Generic CRUD ─────────────────────────────────────────────

async function putMany(storeName: StoreName, records: any[]): Promise<number> {
  if (!records.length) return 0
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    let count = 0
    for (const record of records) {
      const req = store.put(record)
      req.onsuccess = () => { count++ }
    }
    tx.oncomplete = () => { db.close(); resolve(count) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

async function getAll(storeName: StoreName): Promise<any[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => { db.close(); resolve(req.result) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

async function getByIndex(storeName: StoreName, indexName: string, value: any): Promise<any[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const index = store.index(indexName)
    const req = index.getAll(value)
    req.onsuccess = () => { db.close(); resolve(req.result) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

async function getByKey(storeName: StoreName, key: any): Promise<any | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => { db.close(); resolve(req.result || null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

async function getCount(storeName: StoreName): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.count()
    req.onsuccess = () => { db.close(); resolve(req.result) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.clear()
    req.onsuccess = () => { db.close(); resolve() }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

// ── Meta helpers ─────────────────────────────────────────────

async function setMeta(key: string, value: any): Promise<void> {
  await putMany(STORES.meta, [{ key, value, updated_at: new Date().toISOString() }])
}

async function getMeta(key: string): Promise<any> {
  const record = await getByKey(STORES.meta, key)
  return record?.value ?? null
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — Used by components
// ═══════════════════════════════════════════════════════════════

export const PatientCache = {
  // ── Sync from Supabase to IndexedDB ──────────────────────
  async syncFromSupabase(supabase: any, doctorId?: string): Promise<{
    patients: number; medications: number; allergies: number;
    problems: number; appointments: number; documents: number;
    elapsed_ms: number;
  }> {
    const start = Date.now()
    const results = { patients: 0, medications: 0, allergies: 0, problems: 0, appointments: 0, documents: 0, elapsed_ms: 0 }

    try {
      // Fetch all patient data from Supabase tables
      const [pRes, mRes, aRes, prRes, apRes, dRes] = await Promise.all([
        supabase.from('patients').select('*').limit(10000),
        supabase.from('patient_medications').select('*').limit(50000),
        supabase.from('patient_allergies').select('*').limit(10000),
        supabase.from('patient_problems').select('*').limit(10000),
        supabase.from('appointments').select('*').limit(50000),
        supabase.from('patient_documents').select('*').limit(50000),
      ])

      if (pRes.data?.length) results.patients = await putMany(STORES.patients, pRes.data)
      if (mRes.data?.length) results.medications = await putMany(STORES.medications, mRes.data)
      if (aRes.data?.length) results.allergies = await putMany(STORES.allergies, aRes.data)
      if (prRes.data?.length) results.problems = await putMany(STORES.problems, prRes.data)
      if (apRes.data?.length) results.appointments = await putMany(STORES.appointments, apRes.data)
      if (dRes.data?.length) results.documents = await putMany(STORES.documents, dRes.data)

      await setMeta('last_cache_sync', {
        timestamp: new Date().toISOString(),
        counts: results,
        doctor_id: doctorId,
      })

      results.elapsed_ms = Date.now() - start
      console.log(`[PatientCache] Synced to IndexedDB in ${results.elapsed_ms}ms:`, results)
    } catch (err) {
      console.error('[PatientCache] Sync error:', err)
    }

    return results
  },

  // ── Patient Queries (offline-capable) ────────────────────

  async searchPatients(query: string): Promise<any[]> {
    const all = await getAll(STORES.patients)
    const q = query.toLowerCase()
    return all.filter((p: any) =>
      p.first_name?.toLowerCase().includes(q) ||
      p.last_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.cell_phone?.includes(q) ||
      p.chart_id?.toLowerCase().includes(q) ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
    ).slice(0, 50)
  },

  async getPatient(patientId: string): Promise<any | null> {
    return getByKey(STORES.patients, patientId)
  },

  async getPatientMedications(patientId: string): Promise<any[]> {
    return getByIndex(STORES.medications, 'patient', patientId)
  },

  async getPatientAllergies(patientId: string): Promise<any[]> {
    return getByIndex(STORES.allergies, 'patient', patientId)
  },

  async getPatientProblems(patientId: string): Promise<any[]> {
    return getByIndex(STORES.problems, 'patient', patientId)
  },

  async getPatientAppointments(patientId: string): Promise<any[]> {
    return getByIndex(STORES.appointments, 'patient', patientId)
  },

  async getPatientDocuments(patientId: string): Promise<any[]> {
    return getByIndex(STORES.documents, 'patient', patientId)
  },

  async getAllPatients(): Promise<any[]> {
    return getAll(STORES.patients)
  },

  async getAllAppointments(): Promise<any[]> {
    return getAll(STORES.appointments)
  },

  // ── Cache Status ─────────────────────────────────────────

  async getCacheStatus(): Promise<{
    available: boolean;
    lastSync: string | null;
    counts: Record<string, number>;
  }> {
    try {
      const meta = await getMeta('last_cache_sync')
      const counts: Record<string, number> = {}
      for (const store of Object.values(STORES)) {
        if (store === 'meta') continue
        try { counts[store] = await getCount(store) } catch { counts[store] = 0 }
      }
      return {
        available: true,
        lastSync: meta?.timestamp || null,
        counts,
      }
    } catch {
      return { available: false, lastSync: null, counts: {} }
    }
  },

  // ── Clear Cache ──────────────────────────────────────────

  async clearAll(): Promise<void> {
    for (const store of Object.values(STORES)) {
      try { await clearStore(store) } catch {}
    }
  },
}

export default PatientCache
