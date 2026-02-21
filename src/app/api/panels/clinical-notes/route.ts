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
    const { data: local } = await db.from('clinical_notes').select('*').eq('patient_id', resolvedUuid || patient_id).order('created_at', { ascending: false }).limit(50)
    return NextResponse.json({ data: local || [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const { patient_id, appointment_id, note_type, content, author } = body
    if (!patient_id || !content) return NextResponse.json({ error: 'patient_id and content required' }, { status: 400 })
    const { data, error } = await db.from('clinical_notes').insert({ patient_id, appointment_id: appointment_id||null, note_type: note_type||'progress', content, author: author||null }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('clinical_notes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for clinical-notes
// Built: 2026-02-17 | Uses service role key + resolvePatientIds
// Updated: 2026-02-20 | Removed DrChrono integration (drchrono_clinical_notes queries, getDrchronoPatientId)
//
// WIRING: Called by usePanelData hook from clinical-notes panel component
// SHARED: Uses _shared.ts for resolvePatientIds()
// ═══════════════════════════════════════════════════════════════
