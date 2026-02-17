// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId, authenticateDoctor } from '../_shared'
import { getExportAppointments } from '@/lib/export-fallback'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { data, error } = await db.from('appointments').select('id, status, visit_type, chief_complaint, requested_date_time, chart_status, reason, created_at').eq('patient_id', patient_id).order('requested_date_time', { ascending: false }).limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If no local appointments, try export fallback
    let drchrono: any[] = []
    if (!data || data.length === 0) {
      const dcId = await getDrchronoPatientId(patient_id)
      drchrono = await getExportAppointments(db, dcId, patient_id)
    }

    return NextResponse.json({ data: data || [], drchrono_data: drchrono })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for patient-appointments
// Built: 2026-02-17 | Uses service role key + getDrchronoPatientId
//
// FIX-001: RLS disabled on drchrono_* tables
// FIX-008: Uses email fallback when drchrono_patient_id is NULL
//
// WIRING: Called by usePanelData hook from patient-appointments panel component
// SHARED: Uses _shared.ts for getDrchronoPatientId()
// ═══════════════════════════════════════════════════════════════
