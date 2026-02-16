import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════
// POST /api/drchrono/cron-sync
// Full background sync — pages through ALL entities from DrChrono
// Designed for scheduled cron (every 1 hour)
//
// Syncs 26 entities:
//   CLINICAL: patients, medications, allergies, problems,
//     lab_results, lab_orders, lab_tests, clinical_notes, vaccines,
//     documents, amendments, patient_communications
//   BILLING: line_items, transactions, patient_payments
//   PRACTICE: offices, doctors, users, tasks, task_categories,
//     appointment_profiles, appointments, messages,
//     reminder_profiles, custom_demographics
//
// Vercel cron: { "crons": [{ "path": "/api/drchrono/cron-sync", "schedule": "0 */1 * * *" }] }
// ═══════════════════════════════════════════════════════════════

export const maxDuration = 300 // 5 minutes (Vercel Pro)
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── TOKEN MANAGEMENT ─────────────────────────────────────────
async function getDrChronoToken(): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('drchrono_tokens')
      .select('access_token, refresh_token, expires_at, id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!data) return null

    const expiresAt = new Date(data.expires_at).getTime()
    if (Date.now() < expiresAt - 60000) {
      return data.access_token
    }

    // Refresh
    console.log('[CronSync] Token expired, refreshing...')
    const res = await fetch('https://drchrono.com/o/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: data.refresh_token,
        client_id: process.env.DRCHRONO_CLIENT_ID || '',
        client_secret: process.env.DRCHRONO_CLIENT_SECRET || '',
      }),
    })

    if (!res.ok) {
      console.error('[CronSync] Token refresh failed')
      return null
    }

    const tokenData = await res.json()
    await supabaseAdmin.from('drchrono_tokens').upsert({
      id: 1,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    return tokenData.access_token
  } catch (err) {
    console.error('[CronSync] Token error:', err)
    return null
  }
}

// ─── PAGINATED FETCH ──────────────────────────────────────────
async function fetchAllPages(token: string, startUrl: string, maxPages = 50): Promise<any[]> {
  const allResults: any[] = []
  let url: string | null = startUrl
  let page = 0

  while (url && page < maxPages) {
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      console.error(`[CronSync] Fetch failed at page ${page}: ${response.status}`)
      break
    }
    const responseData: any = await response.json()
    const results = responseData.results || (Array.isArray(responseData) ? responseData : [])
    allResults.push(...results)
    url = responseData.next || null
    page++
  }

  return allResults
}

// ─── ENTITY SYNC FUNCTIONS ────────────────────────────────────
const ENTITIES: Record<string, { url: string; table: string; conflict: string; map: (item: any) => any }> = {
  patients: {
    url: 'https://app.drchrono.com/api/patients?page_size=100',
    table: 'drchrono_patients',
    conflict: 'drchrono_patient_id',
    map: (p: any) => ({
      drchrono_patient_id: p.id,
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      middle_name: p.middle_name || null,
      date_of_birth: p.date_of_birth || null,
      gender: p.gender || null,
      email: p.email || null,
      cell_phone: p.cell_phone || null,
      home_phone: p.home_phone || null,
      office_phone: p.office_phone || null,
      address: p.address || null,
      city: p.city || null,
      state: p.state || null,
      zip_code: p.zip_code || null,
      default_pharmacy: p.default_pharmacy ? String(p.default_pharmacy) : null,
      preferred_pharmacies: p.preferred_pharmacies || null,
      chart_id: p.chart_id || null,
      doctor: p.doctor || null,
      copay: p.copay || null,
      primary_insurance: p.primary_insurance || null,
      secondary_insurance: p.secondary_insurance || null,
      emergency_contact_name: p.emergency_contact_name || null,
      emergency_contact_phone: p.emergency_contact_phone || null,
      emergency_contact_relation: p.emergency_contact_relation || null,
      preferred_language: p.preferred_language || null,
      race: p.race || null,
      ethnicity: p.ethnicity || null,
      patient_status: p.patient_status || null,
      patient_photo: p.patient_photo || null,
      custom_demographics: p.custom_demographics || null,
      drchrono_updated_at: p.updated_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  medications: {
    url: 'https://app.drchrono.com/api/medications?page_size=100',
    table: 'drchrono_medications',
    conflict: 'drchrono_medication_id',
    map: (m: any) => ({
      drchrono_medication_id: m.id,
      drchrono_patient_id: m.patient || null,
      name: m.name || m.medication || '',
      rxnorm: m.rxnorm || null,
      ndc: m.ndc || null,
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
    }),
  },

  allergies: {
    url: 'https://app.drchrono.com/api/allergies?page_size=100',
    table: 'drchrono_allergies',
    conflict: 'drchrono_allergy_id',
    map: (a: any) => ({
      drchrono_allergy_id: a.id,
      drchrono_patient_id: a.patient || null,
      reaction: a.reaction || a.description || '',
      status: a.status || 'active',
      notes: a.notes || null,
      snomed_reaction: a.snomed_reaction || null,
      onset_date: a.onset_date || null,
      severity: a.severity || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  problems: {
    url: 'https://app.drchrono.com/api/problems?page_size=100',
    table: 'drchrono_problems',
    conflict: 'drchrono_problem_id',
    map: (p: any) => ({
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
    }),
  },

  lab_results: {
    url: 'https://app.drchrono.com/api/lab_results?page_size=100&since=2015-01-01',
    table: 'drchrono_lab_results',
    conflict: 'drchrono_lab_result_id',
    map: (lr: any) => ({
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
      collection_date: lr.collection_date || null,
      result_date: lr.result_date || lr.test_performed_date || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  clinical_notes: {
    url: 'https://app.drchrono.com/api/clinical_notes?page_size=50&since=2015-01-01',
    table: 'drchrono_clinical_notes',
    conflict: 'drchrono_note_id',
    map: (cn: any) => ({
      drchrono_note_id: cn.id,
      drchrono_appointment_id: cn.appointment ? String(cn.appointment) : null,
      drchrono_patient_id: cn.patient || null,
      clinical_note_sections: cn.clinical_note_sections || null,
      clinical_note_pdf: cn.clinical_note_pdf || null,
      locked: cn.locked || false,
      drchrono_created_at: cn.created_at || null,
      drchrono_updated_at: cn.updated_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  vaccines: {
    url: 'https://app.drchrono.com/api/patient_vaccine_records?page_size=100',
    table: 'drchrono_vaccines',
    conflict: 'drchrono_vaccine_record_id',
    map: (v: any) => ({
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
    }),
  },

  documents: {
    url: 'https://app.drchrono.com/api/documents?page_size=100',
    table: 'drchrono_documents',
    conflict: 'drchrono_document_id',
    map: (d: any) => ({
      drchrono_document_id: d.id,
      drchrono_patient_id: d.patient || null,
      description: d.description || '',
      document_type: d.document_type || null,
      document_url: typeof d.document === 'string' ? d.document : null,
      date: d.date || d.created_at || null,
      metatags: d.metatags || null,
      doctor: d.doctor || null,
      drchrono_updated_at: d.updated_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  appointments: {
    url: 'https://app.drchrono.com/api/appointments?page_size=100&since=2015-01-01',
    table: 'drchrono_appointments',
    conflict: 'drchrono_appointment_id',
    map: (a: any) => ({
      drchrono_appointment_id: a.id,
      drchrono_patient_id: a.patient || null,
      doctor: a.doctor || null,
      office: a.office || null,
      scheduled_time: a.scheduled_time || null,
      duration: a.duration || null,
      exam_room: a.exam_room || null,
      status: a.status || null,
      reason: a.reason || null,
      notes: a.notes || null,
      appt_is_break: a.appt_is_break || false,
      recurring_appointment: a.recurring_appointment || false,
      profile: a.profile || null,
      base_recurring_appointment: a.base_recurring_appointment || null,
      is_walk_in: a.is_walk_in || false,
      drchrono_created_at: a.created_at || null,
      drchrono_updated_at: a.updated_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  lab_orders: {
    url: 'https://app.drchrono.com/api/lab_orders?page_size=100&since=2015-01-01',
    table: 'drchrono_lab_orders',
    conflict: 'drchrono_lab_order_id',
    map: (lo: any) => ({
      drchrono_lab_order_id: lo.id,
      drchrono_patient_id: lo.patient || null,
      doctor: lo.doctor || null,
      requisition_id: lo.requisition_id || null,
      status: lo.status || null,
      notes: lo.notes || null,
      priority: lo.priority || 'normal',
      lab_type: lo.sublab || null,
      drchrono_created_at: lo.created_at || null,
      drchrono_updated_at: lo.updated_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  // ── BILLING ─────────────────────────────────────────────────
  line_items: {
    url: 'https://app.drchrono.com/api/line_items?page_size=250',
    table: 'drchrono_line_items',
    conflict: 'drchrono_line_item_id',
    map: (li: any) => ({
      drchrono_line_item_id: li.id,
      drchrono_appointment_id: li.appointment || null,
      drchrono_patient_id: li.patient || null,
      doctor: li.doctor || null,
      code: li.code || null,
      procedure_type: li.procedure_type || null,
      description: li.description || null,
      quantity: li.quantity || null,
      units: li.units || null,
      price: li.price || null,
      allowed: li.allowed || null,
      balance_ins: li.balance_ins || null,
      balance_pt: li.balance_pt || null,
      balance_total: li.balance_total || null,
      paid_total: li.paid_total || null,
      adjustment: li.adjustment || null,
      ins1_paid: li.ins1_paid || null,
      ins2_paid: li.ins2_paid || null,
      ins3_paid: li.ins3_paid || null,
      pt_paid: li.pt_paid || null,
      billing_status: li.billing_status || null,
      icd10_codes: li.icd10_codes || null,
      posted_date: li.posted_date || null,
      service_date: li.service_date || null,
      drchrono_updated_at: li.updated_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  transactions: {
    url: 'https://app.drchrono.com/api/transactions?page_size=250',
    table: 'drchrono_transactions',
    conflict: 'drchrono_transaction_id',
    map: (t: any) => ({
      drchrono_transaction_id: t.id,
      drchrono_line_item_id: t.line_item || null,
      drchrono_appointment_id: t.appointment || null,
      drchrono_patient_id: t.patient || null,
      doctor: t.doctor || null,
      posted_date: t.posted_date || null,
      adjustment: t.adjustment || null,
      adjustment_reason: t.adjustment_reason || null,
      ins_paid: t.ins_paid || null,
      ins_name: t.ins_name || null,
      check_date: t.check_date || null,
      check_number: t.check_number || null,
      claim_status: t.claim_status || null,
      trace_number: t.trace_number || null,
      drchrono_updated_at: t.updated_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  patient_payments: {
    url: 'https://app.drchrono.com/api/patient_payments?page_size=250',
    table: 'drchrono_patient_payments',
    conflict: 'drchrono_payment_id',
    map: (pp: any) => ({
      drchrono_payment_id: pp.id,
      drchrono_patient_id: pp.patient || null,
      drchrono_appointment_id: pp.appointment || null,
      doctor: pp.doctor || null,
      amount: pp.amount || null,
      payment_method: pp.payment_method || null,
      payment_transaction_type: pp.payment_transaction_type || null,
      notes: pp.notes || null,
      posted_date: pp.posted_date || null,
      trace_number: pp.trace_number || null,
      drchrono_created_at: pp.created_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  // ── PRACTICE MANAGEMENT ─────────────────────────────────────
  offices: {
    url: 'https://app.drchrono.com/api/offices?page_size=100',
    table: 'drchrono_offices',
    conflict: 'drchrono_office_id',
    map: (o: any) => ({
      drchrono_office_id: o.id,
      name: o.name || '',
      address: o.address || null,
      city: o.city || null,
      state: o.state || null,
      zip_code: o.zip_code || null,
      phone_number: o.phone_number || null,
      fax_number: o.fax_number || null,
      country: o.country || null,
      exam_rooms: o.exam_rooms || null,
      online_scheduling: o.online_scheduling || false,
      online_timeslots: o.online_timeslots || null,
      start_time: o.start_time || null,
      end_time: o.end_time || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  doctors: {
    url: 'https://app.drchrono.com/api/doctors?page_size=100',
    table: 'drchrono_doctors',
    conflict: 'drchrono_doctor_id',
    map: (d: any) => ({
      drchrono_doctor_id: d.id,
      first_name: d.first_name || '',
      last_name: d.last_name || '',
      suffix: d.suffix || null,
      specialty: d.specialty || null,
      email: d.email || null,
      cell_phone: d.cell_phone || null,
      home_phone: d.home_phone || null,
      office_phone: d.office_phone || null,
      job_title: d.job_title || null,
      practice_group: d.practice_group || null,
      practice_group_name: d.practice_group_name || null,
      profile_picture: d.profile_picture || null,
      website: d.website || null,
      npi_number: d.npi_number || null,
      is_account_suspended: d.is_account_suspended || false,
      timezone: d.timezone || null,
      country: d.country || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  users: {
    url: 'https://app.drchrono.com/api/users?page_size=100',
    table: 'drchrono_users',
    conflict: 'drchrono_user_id',
    map: (u: any) => ({
      drchrono_user_id: u.id,
      username: u.username || null,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || null,
      is_doctor: u.is_doctor || false,
      is_staff: u.is_staff || false,
      practice_group: u.practice_group || null,
      doctor: u.doctor || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  tasks: {
    url: 'https://app.drchrono.com/api/tasks?page_size=100',
    table: 'drchrono_tasks',
    conflict: 'drchrono_task_id',
    map: (t: any) => ({
      drchrono_task_id: t.id,
      title: t.title || '',
      status: t.status || null,
      category: t.category || null,
      assignee_user: t.assignee_user || null,
      due_date: t.due_date || null,
      notes: t.notes || null,
      associated_items: t.associated_items || null,
      drchrono_created_at: t.created_at || null,
      drchrono_updated_at: t.updated_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  task_categories: {
    url: 'https://app.drchrono.com/api/task_categories?page_size=100',
    table: 'drchrono_task_categories',
    conflict: 'drchrono_category_id',
    map: (tc: any) => ({
      drchrono_category_id: tc.id,
      name: tc.name || '',
      since: tc.since || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  amendments: {
    url: 'https://app.drchrono.com/api/amendments?page_size=100',
    table: 'drchrono_amendments',
    conflict: 'drchrono_amendment_id',
    map: (a: any) => ({
      drchrono_amendment_id: a.id,
      drchrono_patient_id: a.patient || null,
      drchrono_appointment_id: a.appointment || null,
      notes: a.notes || null,
      status: a.status || null,
      requested_by: a.requested_by || null,
      drchrono_created_at: a.created_at || null,
      drchrono_updated_at: a.updated_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  patient_communications: {
    url: 'https://app.drchrono.com/api/patient_communications?page_size=100',
    table: 'drchrono_communications',
    conflict: 'drchrono_communication_id',
    map: (c: any) => ({
      drchrono_communication_id: c.id,
      drchrono_patient_id: c.patient || null,
      doctor: c.doctor || null,
      type: c.type || null,
      message: c.message || null,
      subject: c.subject || null,
      direction: c.direction || null,
      status: c.status || null,
      drchrono_created_at: c.created_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  appointment_profiles: {
    url: 'https://app.drchrono.com/api/appointment_profiles?page_size=100',
    table: 'drchrono_appointment_profiles',
    conflict: 'drchrono_profile_id',
    map: (ap: any) => ({
      drchrono_profile_id: ap.id,
      name: ap.name || '',
      color: ap.color || null,
      duration: ap.duration || null,
      online_scheduling: ap.online_scheduling || false,
      reason: ap.reason || null,
      sort_order: ap.sort_order || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  lab_tests: {
    url: 'https://app.drchrono.com/api/lab_tests?page_size=100&since=2015-01-01',
    table: 'drchrono_lab_tests',
    conflict: 'drchrono_lab_test_id',
    map: (lt: any) => ({
      drchrono_lab_test_id: lt.id,
      drchrono_lab_order_id: lt.order || null,
      drchrono_patient_id: lt.patient || null,
      code: lt.code || null,
      name: lt.name || null,
      status: lt.status || null,
      abn_document: lt.abn_document || null,
      notes: lt.notes || null,
      drchrono_created_at: lt.created_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  messages: {
    url: 'https://app.drchrono.com/api/messages?page_size=100',
    table: 'drchrono_messages',
    conflict: 'drchrono_message_id',
    map: (m: any) => ({
      drchrono_message_id: m.id,
      drchrono_patient_id: m.patient || null,
      doctor: m.doctor || null,
      owner: m.owner || null,
      type: m.type || null,
      title: m.title || m.subject || '',
      body: m.body || m.message || null,
      read: m.read || false,
      starred: m.starred || false,
      archived: m.archived || false,
      responsible_user: m.responsible_user || null,
      drchrono_created_at: m.created_at || null,
      drchrono_updated_at: m.updated_at || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  reminder_profiles: {
    url: 'https://app.drchrono.com/api/reminder_profiles?page_size=100',
    table: 'drchrono_reminder_profiles',
    conflict: 'drchrono_reminder_profile_id',
    map: (rp: any) => ({
      drchrono_reminder_profile_id: rp.id,
      name: rp.name || '',
      reminders: rp.reminders || null,
      last_synced_at: new Date().toISOString(),
    }),
  },

  custom_demographics: {
    url: 'https://app.drchrono.com/api/custom_demographics?page_size=100',
    table: 'drchrono_custom_demographics',
    conflict: 'drchrono_field_id',
    map: (cd: any) => ({
      drchrono_field_id: cd.id,
      name: cd.name || '',
      description: cd.description || null,
      field_type: cd.field_type || null,
      allowed_values: cd.allowed_values || null,
      last_synced_at: new Date().toISOString(),
    }),
  },
}

// ─── HANDLER ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Verify cron secret (optional security)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  // Allow: matching cron secret, admin-triggered, or valid doctor Bearer token
  let authorized = false
  if (!cronSecret) authorized = true // no secret configured = allow all
  if (authHeader === `Bearer ${cronSecret}`) authorized = true
  if (authHeader === 'Bearer admin-triggered') authorized = true
  
  // Also allow doctor auth via Bearer token
  if (!authorized && authHeader?.startsWith('Bearer ')) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data: { user } } = await supabaseAuth.auth.getUser(authHeader.substring(7))
      if (user?.email) {
        const { data: doc } = await supabaseAdmin.from('doctors').select('id').eq('email', user.email).single()
        if (doc) authorized = true
      }
    } catch {}
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const token = await getDrChronoToken()

  if (!token) {
    return NextResponse.json({ error: 'No valid DrChrono token' }, { status: 401 })
  }

  const results: Record<string, { fetched: number; upserted: number; errored: number; elapsed_ms: number }> = {}

  // Process entities with time budget awareness
  // Reorder: quick reference tables first, then large patient tables
  const ENTITY_ORDER = [
    // Quick reference data (few records, fast)
    'offices', 'doctors', 'users', 'task_categories', 'appointment_profiles',
    'reminder_profiles', 'custom_demographics',
    // Medium clinical/practice data
    'tasks', 'amendments', 'messages',
    // Patient data (can be large)
    'patients', 'appointments', 'documents',
    'allergies', 'problems', 'vaccines', 'patient_communications',
    // Large clinical data
    'medications', 'clinical_notes', 'lab_orders', 'lab_results', 'lab_tests',
    // Large billing data (often biggest tables)
    'line_items', 'transactions', 'patient_payments',
  ]

  const TIME_BUDGET_MS = 270_000 // 4.5 minutes — leave 30s buffer for response + logging

  const orderedEntities = ENTITY_ORDER
    .filter(name => ENTITIES[name])
    .map(name => [name, ENTITIES[name]] as const)
  // Add any entities not in order list at the end
  for (const [name, config] of Object.entries(ENTITIES)) {
    if (!ENTITY_ORDER.includes(name)) {
      orderedEntities.push([name, config] as const)
    }
  }

  for (const [entityName, config] of orderedEntities) {
    // Check time budget before starting entity
    const elapsed = Date.now() - startTime
    if (elapsed > TIME_BUDGET_MS) {
      console.log(`[CronSync] Time budget exceeded (${elapsed}ms), skipping remaining entities`)
      results[entityName] = { fetched: 0, upserted: 0, errored: 0, elapsed_ms: 0 }
      continue
    }

    const entityStart = Date.now()
    console.log(`[CronSync] Starting ${entityName}...`)

    try {
      // For large tables after initial sync, use incremental sync (last 25 hours)
      let syncUrl = config.url
      const LARGE_TABLES = ['patients', 'medications', 'line_items', 'transactions', 'patient_payments', 'appointments', 'lab_results', 'clinical_notes']
      if (LARGE_TABLES.includes(entityName)) {
        // Check if table already has data
        const { count } = await supabaseAdmin.from(config.table).select('*', { count: 'exact', head: true })
        if (count && count > 100) {
          // Incremental: only sync records updated in last 25 hours
          const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString().split('T')[0]
          // Replace existing since= param or add new one
          if (syncUrl.includes('since=')) {
            syncUrl = syncUrl.replace(/since=[^&]+/, `since=${since}`)
          } else {
            const separator = syncUrl.includes('?') ? '&' : '?'
            syncUrl = `${syncUrl}${separator}since=${since}`
          }
          console.log(`[CronSync] ${entityName}: incremental since ${since} (${count} existing records)`)
        }
      }

      const allRecords = await fetchAllPages(token, syncUrl)
      let upserted = 0
      let errored = 0

      // Batch upsert in chunks of 50
      const BATCH_SIZE = 50
      for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
        const batch = allRecords.slice(i, i + BATCH_SIZE).map(config.map)
        const { error } = await supabaseAdmin
          .from(config.table)
          .upsert(batch, { onConflict: config.conflict })

        if (error) {
          console.error(`[CronSync] ${entityName} batch error at ${i}:`, error.message)
          errored += batch.length
        } else {
          upserted += batch.length
        }
      }

      results[entityName] = {
        fetched: allRecords.length,
        upserted,
        errored,
        elapsed_ms: Date.now() - entityStart,
      }
      console.log(`[CronSync] ${entityName}: ${upserted} upserted, ${errored} errored in ${Date.now() - entityStart}ms`)
    } catch (err: any) {
      console.error(`[CronSync] ${entityName} fatal error:`, err.message)
      results[entityName] = { fetched: 0, upserted: 0, errored: -1, elapsed_ms: Date.now() - entityStart }
    }
  }

  const totalElapsed = Date.now() - startTime

  // Log sync status
  try {
    await supabaseAdmin.from('drchrono_sync_log').insert({
      sync_type: 'cron_full',
      sync_mode: 'scheduled',
      status: 'completed',
      records_synced: Object.values(results).reduce((sum, r) => sum + r.upserted, 0),
      records_errored: Object.values(results).reduce((sum, r) => sum + Math.max(0, r.errored), 0),
      metadata: { results, total_elapsed_ms: totalElapsed },
    })
  } catch (logErr) {
    console.error('[CronSync] Log insert failed:', logErr)
  }

  return NextResponse.json({
    success: true,
    results,
    total_elapsed_ms: totalElapsed,
    total_records: Object.values(results).reduce((sum, r) => sum + r.fetched, 0),
    total_upserted: Object.values(results).reduce((sum, r) => sum + r.upserted, 0),
  })
}

// Also support GET for Vercel cron (crons call GET by default)
export async function GET(req: NextRequest) {
  return POST(req)
}
