// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { db, resolvePatientIds, authenticateDoctor } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { uuid: resolvedUuid } = await resolvePatientIds(patient_id)
    const { data, error } = await db.from('appointments').select('id, status, visit_type, chief_complaint, requested_date_time, chart_status, reason, created_at').eq('patient_id', resolvedUuid || patient_id).order('requested_date_time', { ascending: false }).limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for patient-appointments
// Built: 2026-02-17 | Uses service role key + resolvePatientIds
// Updated: 2026-02-20 | Removed DrChrono integration (getDrchronoPatientId, export fallback)
//
// WIRING: Called by usePanelData hook from patient-appointments panel component
// SHARED: Uses _shared.ts for resolvePatientIds()
// ═══════════════════════════════════════════════════════════════
