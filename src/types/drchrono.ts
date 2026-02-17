// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ============================================================================
// DrChrono EHR Integration — TypeScript Types
// Medazon Health · Phase 1A
// Interface names match DB columns exactly per Medazon dev rules.
// ============================================================================

// ─── Sync Log ────────────────────────────────────────────────────────────────

export interface DrchronoSyncLog {
  id: number
  sync_type: string
  sync_mode: 'bulk' | 'incremental' | 'single'
  status: 'started' | 'in_progress' | 'completed' | 'failed'
  records_fetched: number
  records_created: number
  records_updated: number
  records_errored: number
  error_details: Array<{ message: string; record_id?: number }>
  doctor_id: string | null
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  metadata: Record<string, unknown>
}

// ─── Patients ────────────────────────────────────────────────────────────────

export interface DrchronoPatient {
  id: number
  drchrono_patient_id: number
  chart_id: string | null
  medazon_patient_id: string | null

  first_name: string | null
  middle_name: string | null
  last_name: string | null
  nick_name: string | null
  date_of_birth: string | null
  gender: string | null
  social_security_number: string | null
  race: string | null
  ethnicity: string | null
  preferred_language: string | null

  email: string | null
  cell_phone: string | null
  home_phone: string | null
  office_phone: string | null

  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null

  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null

  employer: string | null
  employer_address: string | null
  employer_city: string | null
  employer_state: string | null
  employer_zip_code: string | null

  default_pharmacy: string | null
  preferred_pharmacies: string[]

  doctor: number | null
  copay: string | null

  primary_insurance: Record<string, unknown> | null
  secondary_insurance: Record<string, unknown> | null
  tertiary_insurance: Record<string, unknown> | null
  auto_accident_insurance: Record<string, unknown> | null
  workers_comp_insurance: Record<string, unknown> | null

  referring_doctor: Record<string, unknown> | null

  responsible_party_name: string | null
  responsible_party_relation: string | null
  responsible_party_phone: string | null
  responsible_party_email: string | null

  patient_flags: Array<Record<string, unknown>>
  custom_demographics: Array<Record<string, unknown>>

  patient_status: string
  disable_sms_messages: boolean
  date_of_first_appointment: string | null
  date_of_last_appointment: string | null
  patient_photo: string | null
  patient_photo_date: string | null

  drchrono_updated_at: string | null
  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Medications ─────────────────────────────────────────────────────────────

export interface DrchronoMedication {
  id: number
  drchrono_medication_id: number
  drchrono_patient_id: number

  name: string
  rxnorm: string | null
  ndc: string | null
  daw: boolean

  dosage_quantity: string | null
  dosage_unit: string | null
  route: string | null
  frequency: string | null
  sig: string | null

  quantity: string | null
  number_refills: number
  prn: boolean
  order_status: string | null
  status: string | null

  date_prescribed: string | null
  date_started_taking: string | null
  date_stopped_taking: string | null

  pharmacy_note: string | null

  doctor: number | null
  appointment: number | null

  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Allergies ───────────────────────────────────────────────────────────────

export interface DrchronoAllergy {
  id: number
  drchrono_allergy_id: number
  drchrono_patient_id: number

  reaction: string
  status: string
  notes: string | null
  snomed_reaction: string | null

  onset_date: string | null
  severity: string | null

  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Problems ────────────────────────────────────────────────────────────────

export interface DrchronoProblem {
  id: number
  drchrono_problem_id: number
  drchrono_patient_id: number

  name: string
  icd_code: string | null
  icd_version: string
  snomed_ct_code: string | null
  status: string
  date_diagnosis: string | null
  date_changed: string | null
  date_onset: string | null
  notes: string | null

  doctor: number | null

  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Appointments ────────────────────────────────────────────────────────────

export interface DrchronoAppointment {
  id: number
  drchrono_appointment_id: number
  drchrono_patient_id: number

  scheduled_time: string | null
  duration: number | null
  status: string | null
  exam_room: number | null
  reason: string | null
  notes: string | null
  office: number | null

  vitals: Record<string, unknown>
  clinical_note_id: number | null

  billing_status: string | null
  billing_note: string | null
  primary_insurer_name: string | null
  primary_insurance_id_number: string | null

  doctor: number | null
  profile: string | null

  is_walk_in: boolean
  allow_overlapping: boolean

  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Clinical Notes ──────────────────────────────────────────────────────────

export interface DrchronoClinicalNote {
  id: number
  drchrono_clinical_note_id: number
  drchrono_patient_id: number
  drchrono_appointment_id: number | null

  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null

  history_of_present_illness: string | null
  review_of_systems: string | null
  physical_exam: string | null
  assessment_plan: string | null

  locked: boolean
  pdf_url: string | null
  doctor: number | null

  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Lab Orders ──────────────────────────────────────────────────────────────

export interface DrchronoLabOrder {
  id: number
  drchrono_lab_order_id: number
  drchrono_patient_id: number

  requisition_id: string | null
  status: string | null
  priority: string
  notes: string | null
  icd_codes: string[]
  vendor: string | null
  order_date: string | null

  doctor: number | null
  appointment: number | null

  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Lab Results ─────────────────────────────────────────────────────────────

export interface DrchronoLabResult {
  id: number
  drchrono_lab_result_id: number
  drchrono_lab_order_id: number | null
  drchrono_patient_id: number

  test_name: string
  value: string | null
  unit: string | null
  normal_range: string | null
  abnormal_flag: string | null
  status: string | null
  observation_date: string | null
  notes: string | null
  document_url: string | null
  loinc_code: string | null

  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Prescription Messages ───────────────────────────────────────────────────

export interface DrchronoPrescriptionMessage {
  id: number
  drchrono_prescription_msg_id: number
  drchrono_patient_id: number

  message_type: string | null
  status: string | null
  medication_name: string | null
  pharmacy_name: string | null
  pharmacy_ncpdp: string | null
  notes: string | null

  doctor: number | null
  sent_at: string | null

  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Vaccines ────────────────────────────────────────────────────────────────

export interface DrchronoVaccine {
  id: number
  drchrono_vaccine_id: number
  drchrono_patient_id: number

  name: string
  cvx_code: string | null
  administered_date: string | null
  administered_by: string | null
  route: string | null
  site: string | null
  dose_quantity: string | null
  dose_unit: string | null
  lot_number: string | null
  manufacturer: string | null
  expiration_date: string | null
  notes: string | null
  status: string

  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Documents ───────────────────────────────────────────────────────────────

export interface DrchronoDocument {
  id: number
  drchrono_document_id: number
  drchrono_patient_id: number

  description: string | null
  document_type: string | null
  document_url: string | null
  date: string | null
  metatags: Record<string, unknown>

  doctor: number | null

  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Procedures ──────────────────────────────────────────────────────────────

export interface DrchronoProcedure {
  id: number
  drchrono_procedure_id: number
  drchrono_patient_id: number

  procedure_code: string | null
  procedure_type: string | null
  description: string | null
  date_performed: string | null
  status: string | null
  notes: string | null
  snomed_ct_code: string | null

  doctor: number | null
  appointment: number | null

  last_synced_at: string
  created_at: string
  updated_at: string
}

// ─── Bulk Sync Types ─────────────────────────────────────────────────────────

export type SyncEntityType =
  | 'patients'
  | 'medications'
  | 'allergies'
  | 'problems'
  | 'appointments'
  | 'clinical_notes'
  | 'lab_orders'
  | 'lab_results'
  | 'prescription_messages'
  | 'vaccines'
  | 'documents'
  | 'procedures'

export interface BulkSyncRequest {
  entities?: SyncEntityType[]
  doctor_id?: string
  since?: string  // ISO date — only sync records updated after this
}

export interface BulkSyncResponse {
  sync_log_id: number
  status: 'completed' | 'failed' | 'partial'
  results: Record<SyncEntityType, {
    fetched: number
    created: number
    updated: number
    errored: number
  }>
  duration_ms: number
  errors: Array<{ entity: string; message: string; record_id?: number }>
}
