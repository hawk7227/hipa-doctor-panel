import { NextRequest, NextResponse } from 'next/server'
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

    // Fetch from main patients table
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('id', id)
      .single()

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
