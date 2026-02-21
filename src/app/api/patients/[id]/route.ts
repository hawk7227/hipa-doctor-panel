// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'
import path from 'path'

// ═══════════════════════════════════════════════════════════════
// GET /api/patients/[id]
// Fetch patient by UUID or numeric ID
//
// Priority:
//   1. Static JSON file (public/data/patient-medications.json) — NO auth needed
//   2. Supabase patients table — fallback
// ═══════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Cache the JSON in memory after first load ──
let cachedPatients: any[] | null = null

async function loadJsonPatients(): Promise<any[]> {
  if (cachedPatients) return cachedPatients
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'patient-medications.json')
    const raw = await readFile(filePath, 'utf8')
    const data = JSON.parse(raw)
    cachedPatients = data.patients || []
    console.log(`[API] patients/[id]: Loaded ${cachedPatients!.length} patients from JSON`)
    return cachedPatients!
  } catch (err) {
    console.error('[API] patients/[id]: JSON file not found, using Supabase only')
    return []
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Patient ID required', data: null }, { status: 400 })
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const isInteger = /^\d+$/.test(id)

    // ── PRIORITY 1: Static JSON lookup (no auth needed) ──
    if (isInteger) {
      const patients = await loadJsonPatients()
      const patientNumId = parseInt(id, 10)
      const jsonPatient = patients.find((p: any) => p.drchrono_patient_id === patientNumId)

      if (jsonPatient) {
        console.log(`[API] patients/${id}: Found in JSON`)
        const enriched = {
          id: `patient-${patientNumId}`,
          first_name: jsonPatient.first_name || '',
          last_name: jsonPatient.last_name || '',
          email: jsonPatient.email || null,
          phone: jsonPatient.phone || null,
          mobile_phone: jsonPatient.phone || null,
          date_of_birth: jsonPatient.date_of_birth || null,
          gender: null,
          location: jsonPatient.address || null,
          address: jsonPatient.address || null,
          preferred_pharmacy: jsonPatient.pharmacy || null,
          preferred_language: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          emergency_contact_relation: null,
          primary_insurance: null,
          secondary_insurance: null,
          employer: null,
          chart_id: String(patientNumId),
          created_at: new Date().toISOString(),
          updated_at: null,
          race: null,
          ethnicity: null,
          medications: jsonPatient.medications || [],
          allergies: jsonPatient.allergies || [],
          problems: jsonPatient.problems || [],
          appointments: (jsonPatient.appointments || []).map((a: any) => ({
            id: a.id || '',
            status: a.status || '',
            visit_type: a.visit_type || '',
            chief_complaint: a.chief_complaint || '',
            requested_date_time: a.date || null,
            chart_status: null,
          })),
          appointments_count: (jsonPatient.appointments || []).length,
          source: 'json',
        }
        return NextResponse.json({ data: enriched })
      }
    }

    // ── PRIORITY 2: Supabase fallback ──
    let patient: any = null
    let patientError: any = null

    if (isUuid) {
      const result = await supabaseAdmin.from('patients').select('*').eq('id', id).single()
      patient = result.data
      patientError = result.error
    } else if (isInteger) {
      // Look up by numeric ID in patients table
      const result = await supabaseAdmin.from('patients').select('*').limit(1).maybeSingle()
      patient = result.data
      patientError = result.error
    }

    if (patientError || !patient) {
      return NextResponse.json(
        { error: patientError?.message || 'Patient not found', data: null },
        { status: 404 }
      )
    }

    // Fetch recent appointments
    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select('id, status, visit_type, chief_complaint, requested_date_time, chart_status')
      .eq('patient_id', patient.id)
      .order('requested_date_time', { ascending: false })
      .limit(20)

    const enrichedPatient = {
      ...patient,
      address: patient.location || null,
      preferred_pharmacy: patient.preferred_pharmacy || null,
      gender: patient.gender || null,
      race: patient.race || null,
      ethnicity: patient.ethnicity || null,
      preferred_language: patient.preferred_language || null,
      emergency_contact_name: patient.emergency_contact_name || null,
      emergency_contact_phone: patient.emergency_contact_phone || null,
      emergency_contact_relation: patient.emergency_contact_relation || null,
      primary_insurance: patient.primary_insurance || null,
      secondary_insurance: patient.secondary_insurance || null,
      employer: patient.employer || null,
      chart_id: patient.chart_id || null,
      appointments: appointments || [],
      appointments_count: appointments?.length || 0,
      source: 'supabase',
    }

    return NextResponse.json({ data: enrichedPatient })
  } catch (err: any) {
    console.error('[API] patients/[id] error:', err)
    return NextResponse.json({ error: err.message, data: null }, { status: 500 })
  }
}
