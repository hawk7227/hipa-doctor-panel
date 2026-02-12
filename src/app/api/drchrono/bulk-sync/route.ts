import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { drchronoFetchAll } from '@/lib/drchronoPaginate'
import type { SyncEntityType, BulkSyncResponse } from '@/types/drchrono'

// ═══════════════════════════════════════════════════════════════════
// POST /api/drchrono/bulk-sync
// Pulls data from DrChrono API and upserts into local Supabase tables.
// Body: { entities?: string[], doctor_id?: string, since?: string }
// ═══════════════════════════════════════════════════════════════════

const ALL_ENTITIES: SyncEntityType[] = [
  'patients',
  'medications',
  'allergies',
  'problems',
  'appointments',
  'clinical_notes',
  'lab_orders',
  'lab_results',
  'prescription_messages',
  'vaccines',
  'documents',
  'procedures',
]

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await req.json().catch(() => ({}))
    const entities: SyncEntityType[] = body.entities && body.entities.length > 0
      ? body.entities
      : ALL_ENTITIES
    const doctorId: string | undefined = body.doctor_id
    const since: string | undefined = body.since

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabaseAdmin
      .from('drchrono_sync_log')
      .insert({
        sync_type: entities.join(','),
        sync_mode: 'bulk',
        status: 'started',
        doctor_id: doctorId || null,
        metadata: { entities, since: since || null },
      })
      .select('id')
      .single()

    if (logError || !syncLog) {
      console.error('[BulkSync] Failed to create sync log:', logError)
      return NextResponse.json({ error: 'Failed to initialize sync' }, { status: 500 })
    }

    const syncLogId = syncLog.id
    const results: Record<string, { fetched: number; created: number; updated: number; errored: number }> = {}
    const errors: Array<{ entity: string; message: string; record_id?: number }> = []
    let totalFetched = 0
    let totalCreated = 0
    let totalUpdated = 0
    let totalErrored = 0

    // Update status to in_progress
    await supabaseAdmin
      .from('drchrono_sync_log')
      .update({ status: 'in_progress' })
      .eq('id', syncLogId)

    // ─── Sync each entity ────────────────────────────────────────────

    for (const entity of entities) {
      console.log(`[BulkSync] Starting sync for: ${entity}`)
      try {
        const entityResult = await syncEntity(entity, doctorId, since)
        results[entity] = entityResult
        totalFetched += entityResult.fetched
        totalCreated += entityResult.created
        totalUpdated += entityResult.updated
        totalErrored += entityResult.errored
        console.log(`[BulkSync] ${entity}: fetched=${entityResult.fetched} created=${entityResult.created} updated=${entityResult.updated} errored=${entityResult.errored}`)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[BulkSync] ${entity} failed:`, message)
        errors.push({ entity, message })
        results[entity] = { fetched: 0, created: 0, updated: 0, errored: 1 }
        totalErrored++
      }
    }

    // ─── Finalize sync log ───────────────────────────────────────────

    const durationMs = Date.now() - startTime
    const finalStatus = totalErrored > 0 && totalCreated + totalUpdated > 0
      ? 'completed' // partial success still counts as completed
      : totalErrored > 0
        ? 'failed'
        : 'completed'

    await supabaseAdmin
      .from('drchrono_sync_log')
      .update({
        status: finalStatus,
        records_fetched: totalFetched,
        records_created: totalCreated,
        records_updated: totalUpdated,
        records_errored: totalErrored,
        error_details: errors,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      })
      .eq('id', syncLogId)

    const response: BulkSyncResponse = {
      sync_log_id: syncLogId,
      status: finalStatus as BulkSyncResponse['status'],
      results: results as BulkSyncResponse['results'],
      duration_ms: durationMs,
      errors,
    }

    return NextResponse.json(response)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[BulkSync] Top-level error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════
// Entity sync dispatcher
// ═══════════════════════════════════════════════════════════════════

async function syncEntity(
  entity: SyncEntityType,
  doctorId?: string,
  since?: string
): Promise<{ fetched: number; created: number; updated: number; errored: number }> {
  switch (entity) {
    case 'patients':
      return syncPatients(doctorId, since)
    case 'medications':
      return syncPerPatientEntity('medications', 'drchrono_medications', 'drchrono_medication_id', 'id', since)
    case 'allergies':
      return syncPerPatientEntity('allergies', 'drchrono_allergies', 'drchrono_allergy_id', 'id', since)
    case 'problems':
      return syncPerPatientEntity('problems', 'drchrono_problems', 'drchrono_problem_id', 'id', since)
    case 'appointments':
      return syncAppointments(doctorId, since)
    case 'clinical_notes':
      return syncPerPatientEntity('clinical_notes', 'drchrono_clinical_notes', 'drchrono_clinical_note_id', 'id', since)
    case 'lab_orders':
      return syncPerPatientEntity('lab_orders', 'drchrono_lab_orders', 'drchrono_lab_order_id', 'id', since)
    case 'lab_results':
      return syncPerPatientEntity('lab_results', 'drchrono_lab_results', 'drchrono_lab_result_id', 'id', since)
    case 'prescription_messages':
      return syncPerPatientEntity('prescription_messages', 'drchrono_prescription_messages', 'drchrono_prescription_msg_id', 'id', since)
    case 'vaccines':
      return syncPerPatientEntity('patient_vaccine_records', 'drchrono_vaccines', 'drchrono_vaccine_id', 'id', since)
    case 'documents':
      return syncPerPatientEntity('documents', 'drchrono_documents', 'drchrono_document_id', 'id', since)
    case 'procedures':
      return syncPerPatientEntity('procedures', 'drchrono_procedures', 'drchrono_procedure_id', 'id', since)
    default:
      throw new Error(`Unknown entity: ${entity}`)
  }
}

// ═══════════════════════════════════════════════════════════════════
// PATIENTS sync — top-level, fetches all patients for the doctor
// ═══════════════════════════════════════════════════════════════════

async function syncPatients(
  doctorId?: string,
  since?: string
): Promise<{ fetched: number; created: number; updated: number; errored: number }> {
  let endpoint = 'patients?verbose=true'
  if (doctorId) endpoint += `&doctor=${doctorId}`
  if (since) endpoint += `&since=${since}`

  const { records } = await drchronoFetchAll(endpoint)

  let created = 0
  let updated = 0
  let errored = 0

  for (const raw of records) {
    const record = raw as Record<string, unknown>
    try {
      const mapped = mapPatient(record)
      const { error } = await supabaseAdmin
        .from('drchrono_patients')
        .upsert(mapped, { onConflict: 'drchrono_patient_id' })

      if (error) {
        console.error(`[BulkSync] Patient upsert error for ${mapped.drchrono_patient_id}:`, error.message)
        errored++
      } else {
        // Check if it was an insert or update by querying created_at
        // For simplicity, we count all as upserted
        created++
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown'
      console.error('[BulkSync] Patient map error:', message)
      errored++
    }
  }

  return { fetched: records.length, created, updated, errored }
}

// ═══════════════════════════════════════════════════════════════════
// APPOINTMENTS sync — fetches by doctor, not per-patient
// ═══════════════════════════════════════════════════════════════════

async function syncAppointments(
  doctorId?: string,
  since?: string
): Promise<{ fetched: number; created: number; updated: number; errored: number }> {
  let endpoint = 'appointments'
  const params: string[] = []
  if (doctorId) params.push(`doctor=${doctorId}`)
  if (since) params.push(`since=${since}`)
  if (params.length > 0) endpoint += `?${params.join('&')}`

  const { records } = await drchronoFetchAll(endpoint)

  let created = 0
  let errored = 0

  for (const raw of records) {
    const record = raw as Record<string, unknown>
    try {
      const mapped = mapAppointment(record)

      // Ensure patient exists in drchrono_patients before inserting
      if (mapped.drchrono_patient_id) {
        const { data: existingPatient } = await supabaseAdmin
          .from('drchrono_patients')
          .select('drchrono_patient_id')
          .eq('drchrono_patient_id', mapped.drchrono_patient_id)
          .single()

        if (!existingPatient) {
          console.log(`[BulkSync] Skipping appointment ${mapped.drchrono_appointment_id} — patient ${mapped.drchrono_patient_id} not synced yet`)
          errored++
          continue
        }
      }

      const { error } = await supabaseAdmin
        .from('drchrono_appointments')
        .upsert(mapped, { onConflict: 'drchrono_appointment_id' })

      if (error) {
        console.error(`[BulkSync] Appointment upsert error:`, error.message)
        errored++
      } else {
        created++
      }
    } catch (err: unknown) {
      errored++
    }
  }

  return { fetched: records.length, created, updated: 0, errored }
}

// ═══════════════════════════════════════════════════════════════════
// GENERIC per-patient entity sync
// Fetches all records for all synced patients
// ═══════════════════════════════════════════════════════════════════

async function syncPerPatientEntity(
  apiEndpoint: string,
  tableName: string,
  idColumn: string,
  apiIdField: string,
  since?: string
): Promise<{ fetched: number; created: number; updated: number; errored: number }> {
  // Get all synced patient IDs
  const { data: patients, error: pErr } = await supabaseAdmin
    .from('drchrono_patients')
    .select('drchrono_patient_id')

  if (pErr || !patients || patients.length === 0) {
    console.log(`[BulkSync] No patients found for ${apiEndpoint} sync`)
    return { fetched: 0, created: 0, updated: 0, errored: 0 }
  }

  let totalFetched = 0
  let totalCreated = 0
  let totalErrored = 0

  for (const patient of patients) {
    let endpoint = `${apiEndpoint}?patient=${patient.drchrono_patient_id}`
    if (since) endpoint += `&since=${since}`

    try {
      const { records } = await drchronoFetchAll(endpoint)
      totalFetched += records.length

      for (const raw of records) {
        const record = raw as Record<string, unknown>
        try {
          const mapped = mapGenericEntity(record, apiEndpoint, patient.drchrono_patient_id, apiIdField, idColumn)

          if (!mapped) {
            totalErrored++
            continue
          }

          const { error } = await supabaseAdmin
            .from(tableName)
            .upsert(mapped, { onConflict: idColumn })

          if (error) {
            console.error(`[BulkSync] ${tableName} upsert error:`, error.message)
            totalErrored++
          } else {
            totalCreated++
          }
        } catch {
          totalErrored++
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown'
      console.error(`[BulkSync] ${apiEndpoint} fetch error for patient ${patient.drchrono_patient_id}:`, message)
      totalErrored++
    }
  }

  return { fetched: totalFetched, created: totalCreated, updated: 0, errored: totalErrored }
}

// ═══════════════════════════════════════════════════════════════════
// MAPPERS — DrChrono API response → Supabase row
// ═══════════════════════════════════════════════════════════════════

function mapPatient(r: Record<string, unknown>) {
  return {
    drchrono_patient_id: r.id as number,
    chart_id: (r.chart_id as string) || null,
    first_name: (r.first_name as string) || null,
    middle_name: (r.middle_name as string) || null,
    last_name: (r.last_name as string) || null,
    nick_name: (r.nick_name as string) || null,
    date_of_birth: (r.date_of_birth as string) || null,
    gender: (r.gender as string) || null,
    social_security_number: (r.social_security_number as string) || null,
    race: (r.race as string) || null,
    ethnicity: (r.ethnicity as string) || null,
    preferred_language: (r.preferred_language as string) || null,
    email: (r.email as string) || null,
    cell_phone: (r.cell_phone as string) || null,
    home_phone: (r.home_phone as string) || null,
    office_phone: (r.office_phone as string) || null,
    address: (r.address as string) || null,
    city: (r.city as string) || null,
    state: (r.state as string) || null,
    zip_code: (r.zip_code as string) || null,
    emergency_contact_name: (r.emergency_contact_name as string) || null,
    emergency_contact_phone: (r.emergency_contact_phone as string) || null,
    emergency_contact_relation: (r.emergency_contact_relation as string) || null,
    employer: (r.employer as string) || null,
    employer_address: (r.employer_address as string) || null,
    employer_city: (r.employer_city as string) || null,
    employer_state: (r.employer_state as string) || null,
    employer_zip_code: (r.employer_zip_code as string) || null,
    default_pharmacy: (r.default_pharmacy as string) || null,
    preferred_pharmacies: (r.preferred_pharmacies as string[]) || [],
    doctor: (r.doctor as number) || null,
    copay: r.copay != null ? String(r.copay) : null,
    primary_insurance: (r.primary_insurance as Record<string, unknown>) || null,
    secondary_insurance: (r.secondary_insurance as Record<string, unknown>) || null,
    tertiary_insurance: (r.tertiary_insurance as Record<string, unknown>) || null,
    auto_accident_insurance: (r.auto_accident_insurance as Record<string, unknown>) || null,
    workers_comp_insurance: (r.workers_comp_insurance as Record<string, unknown>) || null,
    referring_doctor: (r.referring_doctor as Record<string, unknown>) || null,
    responsible_party_name: (r.responsible_party_name as string) || null,
    responsible_party_relation: (r.responsible_party_relation as string) || null,
    responsible_party_phone: (r.responsible_party_phone as string) || null,
    responsible_party_email: (r.responsible_party_email as string) || null,
    patient_flags: (r.patient_flags as Array<Record<string, unknown>>) || [],
    custom_demographics: (r.custom_demographics as Array<Record<string, unknown>>) || [],
    patient_status: (r.patient_status as string) || 'A',
    disable_sms_messages: (r.disable_sms_messages as boolean) || false,
    date_of_first_appointment: (r.date_of_first_appointment as string) || null,
    date_of_last_appointment: (r.date_of_last_appointment as string) || null,
    patient_photo: (r.patient_photo as string) || null,
    patient_photo_date: (r.patient_photo_date as string) || null,
    drchrono_updated_at: (r.updated_at as string) || null,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function mapAppointment(r: Record<string, unknown>) {
  return {
    drchrono_appointment_id: r.id as number,
    drchrono_patient_id: (r.patient as number) || 0,
    scheduled_time: (r.scheduled_time as string) || null,
    duration: (r.duration as number) || null,
    status: (r.status as string) || null,
    exam_room: (r.exam_room as number) || null,
    reason: (r.reason as string) || null,
    notes: (r.notes as string) || null,
    office: (r.office as number) || null,
    vitals: (r.vitals as Record<string, unknown>) || {},
    clinical_note_id: (r.clinical_note as number) || null,
    billing_status: (r.billing_status as string) || null,
    billing_note: (r.billing_note as string) || null,
    primary_insurer_name: (r.primary_insurer_name as string) || null,
    primary_insurance_id_number: (r.primary_insurance_id_number as string) || null,
    doctor: (r.doctor as number) || null,
    profile: (r.profile as string) || null,
    is_walk_in: (r.is_walk_in as boolean) || false,
    allow_overlapping: (r.allow_overlapping as boolean) || false,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function mapGenericEntity(
  r: Record<string, unknown>,
  apiEndpoint: string,
  patientId: number,
  apiIdField: string,
  dbIdColumn: string
): Record<string, unknown> | null {
  const drchronoId = r[apiIdField] as number
  if (!drchronoId) return null

  const base: Record<string, unknown> = {
    [dbIdColumn]: drchronoId,
    drchrono_patient_id: patientId,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  switch (apiEndpoint) {
    case 'medications':
      return {
        ...base,
        name: (r.name as string) || 'Unknown',
        rxnorm: (r.rxnorm as string) || null,
        ndc: (r.ndc as string) || null,
        daw: (r.daw as boolean) || false,
        dosage_quantity: (r.dosage_quantity as string) || null,
        dosage_unit: (r.dosage_unit as string) || null,
        route: (r.route as string) || null,
        frequency: (r.frequency as string) || null,
        sig: (r.sig as string) || null,
        quantity: (r.quantity as string) || null,
        number_refills: (r.number_refills as number) || 0,
        prn: (r.prn as boolean) || false,
        order_status: (r.order_status as string) || null,
        status: (r.status as string) || null,
        date_prescribed: (r.date_prescribed as string) || null,
        date_started_taking: (r.date_started_taking as string) || null,
        date_stopped_taking: (r.date_stopped_taking as string) || null,
        pharmacy_note: (r.pharmacy_note as string) || null,
        doctor: (r.doctor as number) || null,
        appointment: (r.appointment as number) || null,
      }

    case 'allergies':
      return {
        ...base,
        reaction: (r.reaction as string) || 'Unknown',
        status: (r.status as string) || 'active',
        notes: (r.notes as string) || null,
        snomed_reaction: (r.snomed_reaction as string) || null,
        onset_date: (r.onset_date as string) || null,
        severity: (r.severity as string) || null,
      }

    case 'problems':
      return {
        ...base,
        name: (r.name as string) || 'Unknown',
        icd_code: (r.icd_code as string) || null,
        icd_version: (r.icd_version as string) || '10',
        snomed_ct_code: (r.snomed_ct_code as string) || null,
        status: (r.status as string) || 'active',
        date_diagnosis: (r.date_diagnosis as string) || null,
        date_changed: (r.date_changed as string) || null,
        date_onset: (r.date_onset as string) || null,
        notes: (r.notes as string) || null,
        doctor: (r.doctor as number) || null,
      }

    case 'clinical_notes':
      return {
        ...base,
        drchrono_appointment_id: (r.appointment as number) || null,
        subjective: (r.subjective as string) || null,
        objective: (r.objective as string) || null,
        assessment: (r.assessment as string) || null,
        plan: (r.plan as string) || null,
        history_of_present_illness: (r.history_of_present_illness as string) || null,
        review_of_systems: (r.review_of_systems as string) || null,
        physical_exam: (r.physical_exam as string) || null,
        assessment_plan: (r.assessment_plan as string) || null,
        locked: (r.locked as boolean) || false,
        pdf_url: (r.pdf as string) || null,
        doctor: (r.doctor as number) || null,
      }

    case 'lab_orders':
      return {
        ...base,
        requisition_id: (r.requisition_id as string) || null,
        status: (r.status as string) || null,
        priority: (r.priority as string) || 'normal',
        notes: (r.notes as string) || null,
        icd_codes: (r.icd_codes as string[]) || [],
        vendor: (r.vendor as string) || null,
        order_date: (r.order_date as string) || null,
        doctor: (r.doctor as number) || null,
        appointment: (r.appointment as number) || null,
      }

    case 'lab_results':
      return {
        ...base,
        drchrono_lab_order_id: (r.lab_order as number) || null,
        test_name: (r.test_name as string) || 'Unknown',
        value: (r.value as string) || null,
        unit: (r.unit as string) || null,
        normal_range: (r.normal_range as string) || null,
        abnormal_flag: (r.abnormal_flag as string) || null,
        status: (r.status as string) || null,
        observation_date: (r.observation_date as string) || null,
        notes: (r.notes as string) || null,
        document_url: (r.document as string) || null,
        loinc_code: (r.loinc_code as string) || null,
      }

    case 'prescription_messages':
      return {
        ...base,
        message_type: (r.message_type as string) || null,
        status: (r.status as string) || null,
        medication_name: (r.medication_name as string) || null,
        pharmacy_name: (r.pharmacy_name as string) || null,
        pharmacy_ncpdp: (r.pharmacy_ncpdp as string) || null,
        notes: (r.notes as string) || null,
        doctor: (r.doctor as number) || null,
        sent_at: (r.created_at as string) || null,
      }

    case 'patient_vaccine_records':
      return {
        ...base,
        name: (r.name as string) || 'Unknown',
        cvx_code: (r.cvx_code as string) || null,
        administered_date: (r.administered_date as string) || null,
        administered_by: (r.administered_by as string) || null,
        route: (r.route as string) || null,
        site: (r.site as string) || null,
        dose_quantity: (r.dose_quantity as string) || null,
        dose_unit: (r.dose_unit as string) || null,
        lot_number: (r.lot_number as string) || null,
        manufacturer: (r.manufacturer as string) || null,
        expiration_date: (r.expiration_date as string) || null,
        notes: (r.notes as string) || null,
        status: (r.status as string) || 'completed',
      }

    case 'documents':
      return {
        ...base,
        description: (r.description as string) || null,
        document_type: (r.document_type as string) || null,
        document_url: (r.document as string) || null,
        date: (r.date as string) || null,
        metatags: (r.metatags as Record<string, unknown>) || {},
        doctor: (r.doctor as number) || null,
      }

    case 'procedures':
      return {
        ...base,
        procedure_code: (r.procedure_code as string) || null,
        procedure_type: (r.procedure_type as string) || null,
        description: (r.description as string) || null,
        date_performed: (r.date_performed as string) || null,
        status: (r.status as string) || null,
        notes: (r.notes as string) || null,
        snomed_ct_code: (r.snomed_ct_code as string) || null,
        doctor: (r.doctor as number) || null,
        appointment: (r.appointment as number) || null,
      }

    default:
      return base
  }
}
