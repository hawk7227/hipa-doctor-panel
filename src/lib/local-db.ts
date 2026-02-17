// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// LOCAL-FIRST DATABASE — Dexie.js wrapper over IndexedDB
//
// Foundation of the offline-first system. Every read comes from
// here first. Every write goes here first, then syncs outward.
// Works with zero internet connectivity.
//
// Install: npm install dexie dexie-react-hooks
// ═══════════════════════════════════════════════════════════════

import Dexie, { type Table } from 'dexie'

// ── Types (mirror Supabase schema) ───────────────────────────

export interface LocalPatient {
  id: string
  user_id?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  date_of_birth?: string | null
  location?: string | null
  timezone?: string | null
  preferred_pharmacy?: string | null
  allergies?: string | null
  current_medications?: string | null
  active_problems?: string | null
  chief_complaint?: string | null
  ros_general?: string | null
  vitals_bp?: string | null
  vitals_hr?: string | null
  vitals_temp?: string | null
  has_drug_allergies?: boolean
  has_recent_surgeries?: boolean
  recent_surgeries_details?: string | null
  has_ongoing_medical_issues?: boolean
  ongoing_medical_issues_details?: string | null
  sms_enabled?: boolean
  email_enabled?: boolean
  call_enabled?: boolean
  drchrono_patient_id?: number | null
  created_at: string
  updated_at: string
  _synced: number       // 0=pending, 1=synced
  _device_id: string
}

export interface LocalAppointment {
  id: string
  doctor_id?: string | null
  patient_id?: string | null
  service_type?: string | null
  status: string
  visit_type?: string | null
  requested_date_time?: string | null
  payment_intent_id?: string | null
  payment_status?: string | null
  patient_first_name?: string | null
  patient_last_name?: string | null
  patient_email?: string | null
  patient_phone?: string | null
  symptoms?: string | null
  chief_complaint?: string | null
  preferred_pharmacy?: string | null
  pharmacy_address?: string | null
  daily_room_name?: string | null
  daily_room_url?: string | null
  chart_locked?: boolean | null
  consent_accepted?: boolean | null
  notes?: string | null
  drchrono_appointment_id?: number | null
  created_at: string
  updated_at: string
  _synced: number
  _device_id: string
}

export interface LocalClinicalNote {
  id: string
  appointment_id: string
  doctor_id?: string | null
  patient_id?: string | null
  subjective?: string | null
  objective?: string | null
  assessment?: string | null
  plan?: string | null
  hpi?: string | null
  ros?: string | null
  physical_exam?: string | null
  diagnosis_codes?: string | null
  prescriptions?: string | null
  follow_up?: string | null
  note_text?: string | null
  created_at: string
  updated_at: string
  _synced: number
  _device_id: string
}

export interface LocalMedication {
  id: string
  patient_id: string
  drchrono_patient_id?: number | null
  medication_name: string
  dosage?: string | null
  frequency?: string | null
  start_date?: string | null
  end_date?: string | null
  prescriber?: string | null
  is_active: boolean
  source: string
  drchrono_medication_id?: number | null
  _synced: number
  _device_id: string
}

export interface LocalAllergy {
  id: string
  patient_id: string
  drchrono_patient_id?: number | null
  allergy_name: string
  reaction?: string | null
  severity?: string | null
  source: string
  drchrono_allergy_id?: number | null
  _synced: number
  _device_id: string
}

export interface LocalMessage {
  id: string
  appointment_id: string
  sender_id: string
  sender_type: string // 'doctor' | 'user'
  message_text: string
  message_type: string // 'text' | 'system'
  is_read: boolean
  read_at?: string | null
  created_at: string
  updated_at: string
  _synced: number
  _device_id: string
}

export interface LocalDocument {
  id: string
  appointment_id: string
  message_id?: string | null
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  uploaded_by: string
  uploaded_by_type: string
  created_at: string
  _synced: number
  _device_id: string
}

export interface SyncQueueItem {
  id?: number
  table: string
  record_id: string
  action: 'create' | 'update' | 'delete'
  data: string          // JSON stringified
  device_id: string
  created_at: string
  synced: number        // 0=pending, 1=synced, -1=failed
  attempts: number
  last_error?: string | null
}

export interface SyncMeta {
  key: string
  value: string
  updated_at: string
}

// ── Database Class ───────────────────────────────────────────

class MedazonLocalDB extends Dexie {
  patients!: Table<LocalPatient, string>
  appointments!: Table<LocalAppointment, string>
  clinicalNotes!: Table<LocalClinicalNote, string>
  medications!: Table<LocalMedication, string>
  allergies!: Table<LocalAllergy, string>
  messages!: Table<LocalMessage, string>
  documents!: Table<LocalDocument, string>
  syncQueue!: Table<SyncQueueItem, number>
  syncMeta!: Table<SyncMeta, string>

  constructor() {
    super('medazon_local')

    this.version(1).stores({
      patients: 'id, email, phone, last_name, drchrono_patient_id, updated_at, _synced',
      appointments: 'id, patient_id, doctor_id, status, visit_type, requested_date_time, updated_at, _synced',
      clinicalNotes: 'id, appointment_id, doctor_id, patient_id, updated_at, _synced',
      medications: 'id, patient_id, drchrono_patient_id, is_active, _synced',
      allergies: 'id, patient_id, drchrono_patient_id, _synced',
      messages: 'id, appointment_id, created_at, _synced',
      documents: 'id, appointment_id, _synced',
      syncQueue: '++id, table, record_id, synced, created_at',
      syncMeta: 'key',
    })
  }
}

// ── Singleton ────────────────────────────────────────────────

let _db: MedazonLocalDB | null = null

export function getLocalDB(): MedazonLocalDB {
  if (typeof window === 'undefined') {
    throw new Error('LocalDB is browser-only')
  }
  if (!_db) {
    _db = new MedazonLocalDB()
  }
  return _db
}

// ── Device ID (persistent across sessions) ───────────────────

let _deviceId: string | null = null

export function getDeviceId(): string {
  if (_deviceId) return _deviceId
  if (typeof window !== 'undefined') {
    _deviceId = localStorage.getItem('medazon_device_id')
    if (!_deviceId) {
      _deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem('medazon_device_id', _deviceId)
    }
  } else {
    _deviceId = 'server'
  }
  return _deviceId
}

// ── Helpers ──────────────────────────────────────────────────

export function nowISO(): string {
  return new Date().toISOString()
}

export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export type { MedazonLocalDB }
