// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId, resolvePatientIds, authenticateDoctor } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { uuid: resolvedUuid, dcId } = await resolvePatientIds(patient_id)
    const { data: patient } = await db.from('patients').select('preferred_pharmacy, preferred_pharmacy_phone').eq('id', resolvedUuid || patient_id).single()
    const pharmacy = patient?.preferred_pharmacy ? [{
      id: patient_id,
      name: patient.preferred_pharmacy,
      phone: patient.preferred_pharmacy_phone,
      is_preferred: true,
    }] : []

    let drchrono: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_patients').select('default_pharmacy').eq('drchrono_patient_id', dcId).single()
      if (data?.default_pharmacy) drchrono = [{ pharmacy: data.default_pharmacy }]
    }
    return NextResponse.json({ data: pharmacy, drchrono_data: drchrono })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { patient_id, name, phone } = await req.json()
    if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    const { uuid: resolvedUuid, dcId } = await resolvePatientIds(patient_id)
    const { data, error } = await db.from('patients').update({
      preferred_pharmacy: name || null,
      preferred_pharmacy_phone: phone || null,
    }).eq('id', resolvedUuid || patient_id).select('preferred_pharmacy, preferred_pharmacy_phone').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for pharmacy
// Built: 2026-02-17 | Uses service role key + getDrchronoPatientId, resolvePatientIds
//
// FIX-001: RLS disabled on drchrono_* tables
// FIX-008: Uses email fallback when drchrono_patient_id is NULL
//
// WIRING: Called by usePanelData hook from pharmacy panel component
// SHARED: Uses _shared.ts for getDrchronoPatientId, resolvePatientIds()
// ═══════════════════════════════════════════════════════════════
