// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId, resolvePatientIds, authenticateDoctor } from '../_shared'
import { getExportAllergies } from '@/lib/export-fallback'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    const { uuid: resolvedUuid, dcId } = await resolvePatientIds(patient_id)
  try {
    const { data: local } = await db.from('patient_allergies').select('*').eq('patient_id', resolvedUuid || patient_id).order('created_at', { ascending: false })
    let drchrono: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_allergies').select('*').eq('drchrono_patient_id', dcId).order('onset_date', { ascending: false })
      drchrono = data || []
    }
    if (drchrono.length === 0) {
      drchrono = await getExportAllergies(db, dcId, patient_id)
    }
    console.log(`[allergies] patient=${patient_id} local=${local?.length||0} dc=${drchrono.length} dcId=${dcId}`)
    return NextResponse.json({ data: local || [], drchrono_data: drchrono })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { patient_id, allergen, reaction, severity, status, onset_date, notes } = await req.json()
    if (!patient_id || !allergen) return NextResponse.json({ error: 'patient_id and allergen required' }, { status: 400 })
    const { data, error } = await db.from('patient_allergies').insert({ patient_id, allergen, reaction: reaction||null, severity: severity||'mild', status: status||'active', onset_date: onset_date||null, notes: notes||null }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data, error } = await db.from('patient_allergies').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('patient_allergies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for allergies
// Built: 2026-02-17 | Uses service role key + getDrchronoPatientId, resolvePatientIds
//
// FIX-001: RLS disabled on drchrono_* tables
// FIX-008: Uses email fallback when drchrono_patient_id is NULL
//
// WIRING: Called by usePanelData hook from allergies panel component
// SHARED: Uses _shared.ts for getDrchronoPatientId, resolvePatientIds()
// ═══════════════════════════════════════════════════════════════
