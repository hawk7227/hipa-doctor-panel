// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.

export interface MedicationRecord {
  id: string
  patient_id: string
  medication_name: string
  dosage: string | null
  frequency: string | null
  route: string | null
  prescriber: string | null
  start_date: string | null
  end_date: string | null
  status: 'active' | 'on_hold' | 'discontinued' | 'completed'
  is_prn: boolean
  prn_reason: string | null
  side_effects: string | null
  adherence_score: number | null
  notes: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string | null
}

export interface MedicationAuditEntry {
  id: string
  medication_id: string
  action: 'create' | 'update' | 'discontinue' | 'delete'
  actor_id: string
  actor_email: string | null
  previous_values: Record<string, unknown> | null
  new_values: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

export interface CreateMedicationInput {
  patient_id: string
  medication_name: string
  dosage?: string
  frequency?: string
  route?: string
  prescriber?: string
  start_date?: string
  end_date?: string
  status?: string
  is_prn?: boolean
  prn_reason?: string
  side_effects?: string
  adherence_score?: number
  notes?: string
}
