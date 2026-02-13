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
            drchrono_id: String(m.id),
            patient_id: m.patient ? String(m.patient) : null,
            name: m.name || m.medication || '',
            rxnorm: m.rxnorm || null,
            dosage_quantity: m.dosage_quantity || null,
            dosage_units: m.dosage_units || null,
            frequency: m.frequency || null,
            route: m.route || null,
            status: m.status || 'active',
            date_prescribed: m.date_prescribed || null,
            date_started_taking: m.date_started_taking || null,
            date_stopped_taking: m.date_stopped_taking || null,
            prescriber: m.doctor ? String(m.doctor) : null,
            notes: m.notes || null,
            raw_data: m,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_id' })

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
            drchrono_id: String(a.id),
            patient_id: a.patient ? String(a.patient) : null,
            description: a.description || '',
            reaction: a.reaction || null,
            status: a.status || 'active',
            onset_date: a.onset_date || null,
            notes: a.notes || null,
            raw_data: a,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_id' })

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
            drchrono_id: String(p.id),
            patient_id: p.patient ? String(p.patient) : null,
            name: p.name || '',
            icd_code: p.icd_code || null,
            date_diagnosis: p.date_diagnosis || null,
            date_changed: p.date_changed || null,
            status: p.status || 'active',
            notes: p.notes || null,
            raw_data: p,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_id' })

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
            drchrono_id: String(lr.id),
            patient_id: lr.patient ? String(lr.patient) : null,
            order_id: lr.order ? String(lr.order) : null,
            lab_abnormal_flag: lr.lab_abnormal_flag || null,
            observation_code: lr.observation_code || null,
            observation_description: lr.observation_description || null,
            value: lr.value || null,
            value_units: lr.value_units || null,
            status: lr.status || null,
            test_performed_date: lr.test_performed_date || null,
            raw_data: lr,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_id' })

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
            drchrono_id: String(cn.id),
            patient_id: cn.patient ? String(cn.patient) : null,
            appointment_id: cn.appointment ? String(cn.appointment) : null,
            doctor_id: cn.doctor ? String(cn.doctor) : null,
            template_name: cn.clinical_note_template_name || null,
            locked: cn.locked || false,
            raw_data: cn,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_id' })

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
            drchrono_id: String(v.id),
            patient_id: v.patient ? String(v.patient) : null,
            vaccine_name: v.name || v.vaccine?.name || '',
            cvx_code: v.cvx_code || null,
            administered_date: v.administered_date || null,
            administered_by: v.administered_by || null,
            notes: v.notes || null,
            raw_data: v,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'drchrono_id' })

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

