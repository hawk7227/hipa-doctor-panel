// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════
// GET /api/patients/[id]
// Fetch patient by UUID with full profile data
// Merges local patients table with drchrono_patients if available
// ═══════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = performance.now()

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Patient ID required', data: null }, { status: 400 })
    }

    // Detect if id is UUID or drchrono_patient_id (integer)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    let patient: any = null
    let patientError: any = null

    if (isUuid) {
      // Standard UUID lookup
      const result = await supabaseAdmin.from('patients').select('*').eq('id', id).single()
      patient = result.data
      patientError = result.error
    } else {
      // Try as drchrono_patient_id (integer)
      const asInt = parseInt(id, 10)
      if (!isNaN(asInt) && asInt > 0) {
        const result = await supabaseAdmin.from('patients').select('*').eq('drchrono_patient_id', asInt).limit(1).maybeSingle()
        patient = result.data
        patientError = result.error
      }
    }

    if (patientError || !patient) {
      return NextResponse.json(
        { error: patientError?.message || 'Patient not found', data: null },
        { status: 404 }
      )
    }

    // Try to merge DrChrono data if we have a drchrono_patient_id
    let drchronoData: any = null
    if (patient.drchrono_patient_id) {
      const { data } = await supabaseAdmin
        .from('drchrono_patients')
        .select('*')
        .eq('drchrono_patient_id', patient.drchrono_patient_id)
        .single()
      drchronoData = data
    } else if (patient.drchrono_chart_id) {
      const { data } = await supabaseAdmin
        .from('drchrono_patients')
        .select('*')
        .eq('chart_id', patient.drchrono_chart_id)
        .single()
      drchronoData = data
    }

    // Fetch recent appointments for this patient
    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select('id, status, visit_type, chief_complaint, requested_date_time, chart_status')
      .eq('patient_id', id)
      .order('requested_date_time', { ascending: false })
      .limit(20)

    // Build enriched patient object
    const enrichedPatient = {
      ...patient,
      // Fill in any gaps from DrChrono data
      address: patient.location || (drchronoData ? [drchronoData.address, drchronoData.city, drchronoData.state, drchronoData.zip_code].filter(Boolean).join(', ') : null),
      preferred_pharmacy: patient.preferred_pharmacy || drchronoData?.default_pharmacy || null,
      gender: patient.gender || drchronoData?.gender || null,
      race: drchronoData?.race || null,
      ethnicity: drchronoData?.ethnicity || null,
      preferred_language: patient.preferred_language || drchronoData?.preferred_language || null,
      emergency_contact_name: patient.emergency_contact_name || drchronoData?.emergency_contact_name || null,
      emergency_contact_phone: patient.emergency_contact_phone || drchronoData?.emergency_contact_phone || null,
      emergency_contact_relation: drchronoData?.emergency_contact_relation || null,
      primary_insurance: drchronoData?.primary_insurance || null,
      secondary_insurance: drchronoData?.secondary_insurance || null,
      employer: drchronoData?.employer || null,
      chart_id: drchronoData?.chart_id || patient.drchrono_chart_id || null,
      // Appointments summary
      appointments: appointments || [],
      appointments_count: appointments?.length || 0,
      // Metadata
      drchrono_synced: !!drchronoData,
      drchrono_last_synced: drchronoData?.last_synced_at || null,
    }

    const elapsed = Math.round(performance.now() - startTime)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] patients/${id}: ${elapsed}ms`)
    }

    return NextResponse.json({ data: enrichedPatient })
  } catch (err: any) {
    console.error('[API] patients/[id] error:', err)
    return NextResponse.json({ error: err.message, data: null }, { status: 500 })
  }
}
