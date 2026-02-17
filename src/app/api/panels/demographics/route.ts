// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId, authenticateDoctor } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { data: patient } = await db.from('patients').select('*').eq('id', patient_id).single()
    const dcId = await getDrchronoPatientId(patient_id)
    let dcPatient: any = null
    if (dcId) {
      const { data } = await db.from('drchrono_patients').select('*').eq('drchrono_patient_id', dcId).single()
      dcPatient = data
    }
    return NextResponse.json({ data: patient ? [{ ...patient, _drchrono: dcPatient }] : [], drchrono_data: dcPatient ? [dcPatient] : [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data, error } = await db.from('patients').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for demographics
// Built: 2026-02-17 | Uses service role key + getDrchronoPatientId
//
// FIX-001: RLS disabled on drchrono_* tables
// FIX-008: Uses email fallback when drchrono_patient_id is NULL
//
// WIRING: Called by usePanelData hook from demographics panel component
// SHARED: Uses _shared.ts for getDrchronoPatientId()
// ═══════════════════════════════════════════════════════════════
