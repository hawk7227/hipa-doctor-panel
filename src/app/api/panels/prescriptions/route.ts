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
    const { data: local } = await db.from('prescriptions').select('*').eq('patient_id', resolvedUuid || patient_id).order('created_at', { ascending: false }).limit(50)
    console.log(`[prescriptions] patient=${patient_id} local=${local?.length||0}`)
    return NextResponse.json({ data: local || [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { patient_id, appointment_id, medication_name, dosage, frequency, quantity, refills, pharmacy, notes, status } = await req.json()
    if (!patient_id || !medication_name) return NextResponse.json({ error: 'patient_id and medication_name required' }, { status: 400 })
    const { data, error } = await db.from('prescriptions').insert({ patient_id, appointment_id: appointment_id||null, medication_name, dosage: dosage||null, frequency: frequency||null, quantity: quantity||null, refills: refills||0, pharmacy: pharmacy||null, notes: notes||null, status: status||'pending' }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data, error } = await db.from('prescriptions').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('prescriptions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for prescriptions
// Built: 2026-02-17 | Uses service role key + resolvePatientIds
// Updated: 2026-02-20 | Removed DrChrono integration (drchrono_medications queries, getDrchronoPatientId, export fallback)
//
// WIRING: Called by usePanelData hook from prescriptions panel component
// SHARED: Uses _shared.ts for resolvePatientIds()
// ═══════════════════════════════════════════════════════════════
