import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════
// POST /api/drchrono/bulk-sync
// Fixed version: Returns quickly, processes one page at a time.
// Call repeatedly with cursor to paginate through all records.
// ═══════════════════════════════════════════════════════════════════

export const maxDuration = 60 // Vercel Pro: 60s, Hobby: 10s

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get a valid DrChrono access token (refresh if needed)
async function getDrChronoToken(): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('drchrono_tokens')
      .select('access_token, refresh_token, expires_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!data) return null

    // Check if token is expired
    const expiresAt = new Date(data.expires_at).getTime()
    const now = Date.now()

    if (now < expiresAt - 60000) {
      // Token still valid (with 1min buffer)
      return data.access_token
    }

    // Token expired — refresh it
    console.log('[BulkSync] Token expired, refreshing...')
    const refreshRes = await fetch('https://drchrono.com/o/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: data.refresh_token,
        client_id: process.env.DRCHRONO_CLIENT_ID || '',
        client_secret: process.env.DRCHRONO_CLIENT_SECRET || '',
      }),
    })

    if (!refreshRes.ok) {
      console.error('[BulkSync] Token refresh failed:', await refreshRes.text())
      return null
    }

    const tokenData = await refreshRes.json()
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    // Save new tokens
    await supabaseAdmin.from('drchrono_tokens').insert({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: newExpiresAt,
    })

    return tokenData.access_token
  } catch (err) {
    console.error('[BulkSync] getDrChronoToken error:', err)
    return null
  }
}

// Fetch one page from DrChrono API
async function fetchDrChronoPage(token: string, url: string): Promise<{ results: any[]; next: string | null }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DrChrono API ${res.status}: ${text}`)
  }
  const data = await res.json()
  return {
    results: data.results || (Array.isArray(data) ? data : []),
    next: data.next || null,
  }
}

// Entity sync handlers — each returns { upserted, errored }
const ENTITY_HANDLERS: Record<string, (token: string, cursor: string | null) => Promise<{
  results: any[]
  next: string | null
  upserted: number
  errored: number
}>> = {
  patients: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/patients?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)

    let upserted = 0
    let errored = 0

    for (const p of results) {
      try {
        const record = {
          drchrono_patient_id: p.id,  // integer, matches table column
          first_name: p.first_name || '',
          middle_name: p.middle_name || null,
          last_name: p.last_name || '',
          nick_name: p.nick_name || null,
          date_of_birth: p.date_of_birth || null,
          gender: p.gender || null,
          social_security_number: p.social_security_number || null,
          race: p.race || null,
          ethnicity: p.ethnicity || null,
          preferred_language: p.preferred_language || null,
          email: p.email || null,
          cell_phone: p.cell_phone || null,
          home_phone: p.home_phone || null,
          office_phone: p.office_phone || null,
          address: p.address || null,
          city: p.city || null,
          state: p.state || null,
          zip_code: p.zip_code || null,
          emergency_contact_name: p.emergency_contact_name || null,
          emergency_contact_phone: p.emergency_contact_phone || null,
          emergency_contact_relation: p.emergency_contact_relation || null,
          employer: p.employer || null,
          employer_address: p.employer_address || null,
          employer_city: p.employer_city || null,
          employer_state: p.employer_state || null,
          employer_zip_code: p.employer_zip_code || null,
          default_pharmacy: p.default_pharmacy ? String(p.default_pharmacy) : null,
          preferred_pharmacies: p.preferred_pharmacies || null,
          doctor: p.doctor || null,
          copay: p.copay || null,
          chart_id: p.chart_id || null,
          primary_insurance: p.primary_insurance || null,
          secondary_insurance: p.secondary_insurance || null,
          referring_doctor: p.referring_doctor || null,
          responsible_party_name: p.responsible_party_name || null,
          responsible_party_relation: p.responsible_party_relation || null,
          responsible_party_phone: p.responsible_party_phone || null,
          responsible_party_email: p.responsible_party_email || null,
          patient_flags: p.patient_flags || null,
          patient_flags_attached: p.patient_flags_attached || null,
          custom_demographics: p.custom_demographics || null,
          patient_status: p.patient_status || null,
          disable_sms_messages: p.disable_sms_messages || false,
          date_of_first_appointment: p.date_of_first_appointment || null,
          date_of_last_appointment: p.date_of_last_appointment || null,
          patient_photo: p.patient_photo || null,
          patient_photo_date: p.patient_photo_date || null,
          drchrono_updated_at: p.updated_at || null,
          last_synced_at: new Date().toISOString(),
        }

        const { error } = await supabaseAdmin
          .from('drchrono_patients')
          .upsert(record, { onConflict: 'drchrono_patient_id' })

        if (error) {
          console.error(`[BulkSync] Patient ${p.id} upsert error:`, error.message)
          errored++
        } else {
          upserted++
        }
      } catch (err: any) {
        console.error(`[BulkSync] Patient ${p.id} error:`, err.message)
        errored++
      }
    }

    return { results, next, upserted, errored }
  },

  medications: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/medications?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)

    let upserted = 0
    let errored = 0

    for (const m of results) {
      try {
        const { error } = await supabaseAdmin
          .from('drchrono_medications')
          .upsert({
            drchrono_medication_id: m.id,
            drchrono_patient_id: m.patient || null,
            name: m.name || m.medication || '',
            rxnorm: m.rxnorm || null,
            ndc: m.ndc || null,
            daw: m.daw || false,
            dosage_quantity: m.dosage_quantity || null,
            dosage_unit: m.dosage_unit || null,
            route: m.route || null,
            frequency: m.frequency || null,
            sig: m.sig || null,
            quantity: m.quantity || null,
            number_refills: m.number_refills || null,
            prn: m.prn || false,
            order_status: m.order_status || null,
            status: m.status || 'active',
            date_prescribed: m.date_prescribed || null,
            date_started_taking: m.date_started_taking || null,
            date_stopped_taking: m.date_stopped_taking || null,
            pharmacy_note: m.pharmacy_note || null,
            doctor: m.doctor || null,
            appointment: m.appointment || null,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_medication_id' })

        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }

    return { results, next, upserted, errored }
  },

  allergies: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/allergies?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)

    let upserted = 0
    let errored = 0

    for (const a of results) {
      try {
        const { error } = await supabaseAdmin
          .from('drchrono_allergies')
          .upsert({
            drchrono_allergy_id: a.id,
            drchrono_patient_id: a.patient || null,
            reaction: a.reaction || a.description || '',
            status: a.status || 'active',
            notes: a.notes || null,
            snomed_reaction: a.snomed_reaction || null,
            onset_date: a.onset_date || null,
            severity: a.severity || null,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_allergy_id' })

        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }

    return { results, next, upserted, errored }
  },

  problems: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/problems?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)

    let upserted = 0
    let errored = 0

    for (const p of results) {
      try {
        const { error } = await supabaseAdmin
          .from('drchrono_problems')
          .upsert({
            drchrono_problem_id: p.id,
            drchrono_patient_id: p.patient || null,
            name: p.name || '',
            icd_code: p.icd_code || null,
            status: p.status || 'active',
            date_diagnosis: p.date_diagnosis || null,
            date_changed: p.date_changed || null,
            notes: p.notes || null,
            snomed_ct_code: p.snomed_ct_code || null,
            doctor: p.doctor || null,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_problem_id' })

        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }

    return { results, next, upserted, errored }
  },

  lab_results: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/lab_results?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)

    let upserted = 0
    let errored = 0

    for (const lr of results) {
      try {
        const { error } = await supabaseAdmin
          .from('drchrono_lab_results')
          .upsert({
            drchrono_lab_result_id: lr.id,
            drchrono_lab_order_id: lr.order || null,
            drchrono_patient_id: lr.patient || null,
            test_code: lr.observation_code || null,
            test_name: lr.observation_description || null,
            value: lr.value || null,
            unit: lr.value_units || null,
            status: lr.status || null,
            abnormal_flag: lr.lab_abnormal_flag || lr.abnormal_flag || null,
            normal_range: lr.normal_range || null,
            normal_range_low: lr.normal_range_low || null,
            normal_range_high: lr.normal_range_high || null,
            collection_date: lr.collection_date || null,
            result_date: lr.result_date || lr.test_performed_date || null,
            internal_notes: lr.internal_notes || null,
            report_notes: lr.report_notes || null,
            specimen_source: lr.specimen_source || null,
            specimen_condition: lr.specimen_condition || null,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_lab_result_id' })

        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }

    return { results, next, upserted, errored }
  },

  clinical_notes: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/clinical_notes?page_size=50'
    const { results, next } = await fetchDrChronoPage(token, url)

    let upserted = 0
    let errored = 0

    for (const cn of results) {
      try {
        const { error } = await supabaseAdmin
          .from('drchrono_clinical_notes')
          .upsert({
            drchrono_note_id: cn.id,
            drchrono_appointment_id: cn.appointment ? String(cn.appointment) : null,
            drchrono_patient_id: cn.patient || null,
            clinical_note_sections: cn.clinical_note_sections || null,
            clinical_note_pdf: cn.clinical_note_pdf || null,
            locked: cn.locked || false,
            drchrono_created_at: cn.created_at || null,
            drchrono_updated_at: cn.updated_at || null,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_note_id' })

        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }

    return { results, next, upserted, errored }
  },

  vaccines: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/patient_vaccine_records?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)

    let upserted = 0
    let errored = 0

    for (const v of results) {
      try {
        const { error } = await supabaseAdmin
          .from('drchrono_vaccines')
          .upsert({
            drchrono_vaccine_record_id: v.id,
            drchrono_patient_id: v.patient || null,
            vaccine_name: v.name || v.vaccine?.name || '',
            cvx_code: v.cvx_code || null,
            administered_date: v.administered_date || null,
            administered_by: v.administered_by || null,
            route: v.route || null,
            site: v.site || null,
            dose_quantity: v.dose_quantity || null,
            dose_unit: v.dose_unit || null,
            lot_number: v.lot_number || null,
            manufacturer: v.manufacturer || null,
            expiration_date: v.expiration_date || null,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_vaccine_record_id' })

        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }

    return { results, next, upserted, errored }
  },

  // ── APPOINTMENTS ──
  appointments: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/appointments?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)
    let upserted = 0, errored = 0
    for (const a of results) {
      try {
        const { error } = await supabaseAdmin.from('drchrono_appointments').upsert({
          drchrono_appointment_id: a.id, drchrono_patient_id: a.patient || null, doctor: a.doctor || null,
          office: a.office || null, scheduled_time: a.scheduled_time || null, duration: a.duration || null,
          exam_room: a.exam_room || null, status: a.status || null, reason: a.reason || null, notes: a.notes || null,
          appt_is_break: a.appt_is_break || false, recurring_appointment: a.recurring_appointment || false,
          profile: a.profile || null, is_walk_in: a.is_walk_in || false,
          drchrono_created_at: a.created_at || null, drchrono_updated_at: a.updated_at || null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_appointment_id' })
        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }
    return { results, next, upserted, errored }
  },

  // ── DOCUMENTS ──
  documents: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/documents?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)
    let upserted = 0, errored = 0
    for (const d of results) {
      try {
        const { error } = await supabaseAdmin.from('drchrono_documents').upsert({
          drchrono_document_id: d.id, drchrono_patient_id: d.patient || null,
          description: d.description || null, document_type: d.document_type || null,
          document_url: d.document || null, date: d.date || null, metatags: d.metatags || null,
          doctor: d.doctor || null, drchrono_updated_at: d.updated_at || null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_document_id' })
        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }
    return { results, next, upserted, errored }
  },

  // ── LAB ORDERS ──
  lab_orders: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/lab_orders?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)
    let upserted = 0, errored = 0
    for (const l of results) {
      try {
        const { error } = await supabaseAdmin.from('drchrono_lab_orders').upsert({
          drchrono_lab_order_id: l.id, drchrono_patient_id: l.patient || null, doctor: l.doctor || null,
          requisition_id: l.requisition_id || null, status: l.status || null, notes: l.notes || null,
          priority: l.priority || 'normal', lab_type: l.type || null,
          drchrono_created_at: l.created_at || null, drchrono_updated_at: l.updated_at || null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_lab_order_id' })
        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }
    return { results, next, upserted, errored }
  },

  // ── OFFICES ──
  offices: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/offices?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)
    let upserted = 0, errored = 0
    for (const o of results) {
      try {
        const { error } = await supabaseAdmin.from('drchrono_offices').upsert({
          drchrono_office_id: o.id, name: o.name || null, address: o.address || null,
          city: o.city || null, state: o.state || null, zip_code: o.zip_code || null,
          phone_number: o.phone_number || null, fax_number: o.fax_number || null,
          online_scheduling: o.online_scheduling || false, online_timezones: o.online_timezones || null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_office_id' })
        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }
    return { results, next, upserted, errored }
  },

  // ── DOCTORS ──
  doctors: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/doctors?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)
    let upserted = 0, errored = 0
    for (const d of results) {
      try {
        const { error } = await supabaseAdmin.from('drchrono_doctors').upsert({
          drchrono_doctor_id: d.id, first_name: d.first_name || null, last_name: d.last_name || null,
          suffix: d.suffix || null, specialty: d.specialty || null, email: d.email || null,
          job_title: d.job_title || null, npi_number: d.npi_number || null,
          practice_group: d.practice_group || null, profile_picture: d.profile_picture || null,
          is_account_suspended: d.is_account_suspended || false,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_doctor_id' })
        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }
    return { results, next, upserted, errored }
  },

  // ── TASKS ──
  tasks: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/tasks?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)
    let upserted = 0, errored = 0
    for (const t of results) {
      try {
        const { error } = await supabaseAdmin.from('drchrono_tasks').upsert({
          drchrono_task_id: t.id, title: t.title || null, body: t.body || null,
          status: t.status || null, category: t.category || null,
          due_date: t.due_date || null, assignee_user: t.assignee_user || null,
          associated_items: t.associated_items || null,
          drchrono_created_at: t.created_at || null, drchrono_updated_at: t.updated_at || null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_task_id' })
        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }
    return { results, next, upserted, errored }
  },

  // ── PATIENT PAYMENTS ──
  patient_payments: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/patient_payments?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)
    let upserted = 0, errored = 0
    for (const p of results) {
      try {
        const { error } = await supabaseAdmin.from('drchrono_patient_payments').upsert({
          drchrono_payment_id: p.id, drchrono_patient_id: p.patient || null,
          amount: p.amount || null, payment_method: p.payment_method || null,
          posted_date: p.posted_date || null, trace_number: p.trace_number || null,
          notes: p.notes || null, appointment: p.appointment || null, doctor: p.doctor || null,
          drchrono_created_at: p.created_at || null, drchrono_updated_at: p.updated_at || null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_payment_id' })
        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }
    return { results, next, upserted, errored }
  },

  // ── LINE ITEMS (Billing) ──
  line_items: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/line_items?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)
    let upserted = 0, errored = 0
    for (const l of results) {
      try {
        const { error } = await supabaseAdmin.from('drchrono_line_items').upsert({
          drchrono_line_item_id: l.id, drchrono_patient_id: l.patient || null,
          appointment: l.appointment || null, doctor: l.doctor || null,
          code: l.code || null, description: l.description || null,
          quantity: l.quantity || null, price: l.price || null,
          procedure_type: l.procedure_type || null, service_date: l.service_date || null,
          drchrono_created_at: l.created_at || null, drchrono_updated_at: l.updated_at || null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_line_item_id' })
        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }
    return { results, next, upserted, errored }
  },

  // ── TRANSACTIONS (Insurance) ──
  transactions: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/transactions?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)
    let upserted = 0, errored = 0
    for (const t of results) {
      try {
        const { error } = await supabaseAdmin.from('drchrono_transactions').upsert({
          drchrono_transaction_id: t.id, drchrono_patient_id: t.patient || null,
          doctor: t.doctor || null, appointment: t.appointment || null,
          line_item: t.line_item || null, posted_date: t.posted_date || null,
          amount: t.amount || null, adjustment_reason: t.adjustment_reason || null,
          ins_name: t.ins_name || null, claim_status: t.claim_status || null,
          drchrono_created_at: t.created_at || null, drchrono_updated_at: t.updated_at || null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_transaction_id' })
        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }
    return { results, next, upserted, errored }
  },

  // ── MESSAGES ──
  messages: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/messages?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)
    let upserted = 0, errored = 0
    for (const m of results) {
      try {
        const { error } = await supabaseAdmin.from('drchrono_messages').upsert({
          drchrono_message_id: m.id, drchrono_patient_id: m.patient || null,
          doctor: m.doctor || null, owner: m.owner || null, type: m.type || null,
          subject: m.subject || null, body: m.body || null, read: m.read || false,
          starred: m.starred || false, archived: m.archived || false,
          drchrono_created_at: m.created_at || null, drchrono_updated_at: m.updated_at || null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_message_id' })
        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }
    return { results, next, upserted, errored }
  },

  // ── APPOINTMENT PROFILES (Templates) ──
  appointment_profiles: async (token, cursor) => {
    const url = cursor || 'https://app.drchrono.com/api/appointment_profiles?page_size=100'
    const { results, next } = await fetchDrChronoPage(token, url)
    let upserted = 0, errored = 0
    for (const p of results) {
      try {
        const { error } = await supabaseAdmin.from('drchrono_appointment_profiles').upsert({
          drchrono_profile_id: p.id, name: p.name || null, color: p.color || null,
          duration: p.duration || null, reason: p.reason || null, online_scheduling: p.online_scheduling || false,
          sort_order: p.sort_order || null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_profile_id' })
        if (error) { errored++ } else { upserted++ }
      } catch { errored++ }
    }
    return { results, next, upserted, errored }
  },
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await req.json().catch(() => ({}))
    const entity: string = body.entity || body.entities?.[0] || 'patients'
    const cursor: string | null = body.cursor || null
    const doctorId: string | undefined = body.doctor_id

    // Validate entity
    const handler = ENTITY_HANDLERS[entity]
    if (!handler) {
      return NextResponse.json({
        error: `Unknown entity: ${entity}`,
        available: Object.keys(ENTITY_HANDLERS),
      }, { status: 400 })
    }

    // Get DrChrono token
    const token = await getDrChronoToken()
    if (!token) {
      return NextResponse.json({ error: 'No valid DrChrono token. Re-authenticate at /api/drchrono/auth' }, { status: 401 })
    }

    // Process ONE page
    const result = await handler(token, cursor)

    const elapsed = Date.now() - startTime

    // Log to sync table (best effort)
    try {
      await supabaseAdmin.from('drchrono_sync_log').insert({
        sync_type: entity,
        sync_mode: 'bulk',
        status: result.next ? 'in_progress' : 'completed',
        doctor_id: doctorId || null,
        records_synced: result.upserted,
        records_errored: result.errored,
        metadata: {
          page_fetched: result.results.length,
          has_more: !!result.next,
          elapsed_ms: elapsed,
        },
      })
    } catch (logErr) {
      console.error('[BulkSync] Sync log insert failed (non-fatal):', logErr)
    }

    return NextResponse.json({
      success: true,
      entity,
      page_records: result.results.length,
      upserted: result.upserted,
      errored: result.errored,
      has_more: !!result.next,
      next_cursor: result.next,
      elapsed_ms: elapsed,
      // If has_more, call again with: { entity, cursor: next_cursor }
    })
  } catch (err: any) {
    console.error('[BulkSync] Fatal error:', err)
    return NextResponse.json({
      error: err.message || 'Bulk sync failed',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    }, { status: 500 })
  }
}

