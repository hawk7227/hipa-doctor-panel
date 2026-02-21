// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { db, authenticateDoctor } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { data: local } = await db.from('patient_immunizations').select('*').eq('patient_id', patient_id).order('administration_date', { ascending: false })
    console.log(`[immunizations] patient=${patient_id} count=${local?.length||0}`)
    return NextResponse.json({ data: local || [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    if (!body.patient_id || !body.vaccine_name || !body.administration_date) return NextResponse.json({ error: 'patient_id, vaccine_name, administration_date required' }, { status: 400 })
    const { data, error } = await db.from('patient_immunizations').insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data, error } = await db.from('patient_immunizations').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('patient_immunizations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for immunizations
// Built: 2026-02-17 | Uses service role key
// Updated: 2026-02-20 | Removed DrChrono references (getDrchronoPatientId import, drchrono_data from response)
//
// WIRING: Called by usePanelData hook from immunizations panel component
// SHARED: Uses _shared.ts for authenticateDoctor()
// ═══════════════════════════════════════════════════════════════
