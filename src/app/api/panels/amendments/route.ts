// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { db, authenticateDoctor } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { data, error } = await db.from('chart_addendums').select('*').eq('patient_id', patient_id).order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const { patient_id, doctor_id, appointment_id, clinical_note_id, amendment_type, original_content, amended_content, amendment_reason, requested_by } = body
    if (!patient_id || !amendment_reason) return NextResponse.json({ error: 'patient_id and amendment_reason required' }, { status: 400 })

    const { data, error } = await db.from('chart_addendums').insert({
      patient_id, doctor_id, appointment_id, clinical_note_id, amendment_type: amendment_type || 'correction', original_content, amended_content, amendment_reason, requested_by, status: 'pending',
    }).select().single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const { id, status, reviewed_by, review_notes } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const update: any = { updated_at: new Date().toISOString() }
    if (status) update.status = status
    if (reviewed_by) update.reviewed_by = reviewed_by
    if (review_notes) update.review_notes = review_notes
    if (status === 'accepted' || status === 'denied') update.reviewed_at = new Date().toISOString()

    const { data, error } = await db.from('chart_addendums').update(update).eq('id', id).select().single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for amendments
// Built: 2026-02-17 | Uses service role key + getDrchronoPatientId
//
// FIX-001: RLS disabled on drchrono_* tables
// FIX-008: Uses email fallback when drchrono_patient_id is NULL
//
// WIRING: Called by usePanelData hook from amendments panel component
// SHARED: Uses _shared.ts for getDrchronoPatientId()
// ═══════════════════════════════════════════════════════════════
