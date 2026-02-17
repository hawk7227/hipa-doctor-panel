// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/drchrono/test?entity=appointments
// Tests a single DrChrono API call AND tries to upsert one record
// No auth required - this is a diagnostic endpoint (remove after debugging)
export async function GET(req: NextRequest) {

  const entity = req.nextUrl.searchParams.get('entity') || 'appointments'

  // Get token
  let token: string | null = null
  let tokenInfo: any = {}
  try {
    const { data } = await supabaseAdmin
      .from('drchrono_tokens')
      .select('access_token, expires_at, refresh_token, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
    
    if (!data) return NextResponse.json({ error: 'No token in drchrono_tokens' }, { status: 401 })

    const expiresAt = new Date(data.expires_at).getTime()
    token = data.access_token
    tokenInfo = {
      expired: Date.now() > expiresAt,
      expires_at: data.expires_at,
      updated_at: data.updated_at,
      token_prefix: data.access_token?.substring(0, 10) + '...',
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'Token lookup failed', detail: e.message }, { status: 500 })
  }

  // URLs that need since= param
  const urls: Record<string, string> = {
    appointments: 'https://app.drchrono.com/api/appointments?page_size=10&since=2024-01-01',
    clinical_notes: 'https://app.drchrono.com/api/clinical_notes?page_size=5&since=2024-01-01',
    documents: 'https://app.drchrono.com/api/documents?page_size=10',
    lab_orders: 'https://app.drchrono.com/api/lab_orders?page_size=10&since=2024-01-01',
    lab_results: 'https://app.drchrono.com/api/lab_results?page_size=10&since=2024-01-01',
    patients: 'https://app.drchrono.com/api/patients?page_size=3',
    offices: 'https://app.drchrono.com/api/offices?page_size=10',
    vaccines: 'https://app.drchrono.com/api/patient_vaccine_records?page_size=10',
  }

  const url = urls[entity] || `https://app.drchrono.com/api/${entity}?page_size=10`

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const text = await res.text()
    let parsed: any = null
    try { parsed = JSON.parse(text) } catch {}

    // Check Supabase table
    const tableMap: Record<string, string> = {
      appointments: 'drchrono_appointments', clinical_notes: 'drchrono_clinical_notes',
      documents: 'drchrono_documents', lab_orders: 'drchrono_lab_orders',
      lab_results: 'drchrono_lab_results', patients: 'drchrono_patients',
      vaccines: 'drchrono_vaccines',
    }
    let tableStatus = 'unmapped'
    let tableCount = -1
    if (tableMap[entity]) {
      try {
        const { count, error } = await supabaseAdmin.from(tableMap[entity]).select('*', { count: 'exact', head: true })
        tableStatus = error ? `ERROR: ${error.message}` : 'exists'
        tableCount = count ?? 0
      } catch (e: any) { tableStatus = `EXCEPTION: ${e.message}` }
    }

    // TRY UPSERT: Actually insert the first result to see if it works
    let upsertTest: any = null
    if (parsed?.results?.[0] && tableMap[entity]) {
      const mappings: Record<string, (item: any) => any> = {
        appointments: (a: any) => ({
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
        documents: (d: any) => ({
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
        patients: (p: any) => ({
          drchrono_patient_id: p.id,
          first_name: p.first_name || '',
          last_name: p.last_name || '',
          date_of_birth: p.date_of_birth || null,
          gender: p.gender || null,
          email: p.email || null,
          cell_phone: p.cell_phone || null,
          last_synced_at: new Date().toISOString(),
        }),
      }
      
      const conflictMap: Record<string, string> = {
        appointments: 'drchrono_appointment_id',
        documents: 'drchrono_document_id',
        patients: 'drchrono_patient_id',
      }

      if (mappings[entity]) {
        const mapped = mappings[entity](parsed.results[0])
        const { data: uData, error: uError } = await supabaseAdmin
          .from(tableMap[entity])
          .upsert(mapped, { onConflict: conflictMap[entity] })
          .select()
        
        upsertTest = {
          success: !uError,
          error: uError ? { message: uError.message, code: uError.code, details: uError.details, hint: uError.hint } : null,
          mapped_data: mapped,
          returned_data: uData,
        }
      }
    }

    return NextResponse.json({
      entity,
      token: tokenInfo,
      api: {
        url,
        status: res.status,
        status_text: res.statusText,
        results_count: parsed?.results?.length ?? 'not_array',
        has_next: !!parsed?.next,
        error: res.status >= 400 ? (parsed?.detail || parsed?.error || text.substring(0, 300)) : null,
        sample_keys: parsed?.results?.[0] ? Object.keys(parsed.results[0]) : null,
        sample_first: parsed?.results?.[0] ? JSON.stringify(parsed.results[0]).substring(0, 300) : null,
      },
      upsert_test: upsertTest,
      supabase: {
        table: tableMap[entity] || 'unmapped',
        status: tableStatus,
        count: tableCount,
      },
      raw_preview: !parsed ? text.substring(0, 500) : undefined,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Fetch failed', detail: e.message, url }, { status: 500 })
  }
}
