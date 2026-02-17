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
    const { data, error } = await db
      .from('patient_vitals')
      .select('*')
      .eq('patient_id', patient_id)
      .order('recorded_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [], drchrono_data: [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const { patient_id, appointment_id, systolic, diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation, weight, height, bmi, pain_level, notes } = body
    if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })

    const { data, error } = await db.from('patient_vitals').insert({
      patient_id, appointment_id: appointment_id || null,
      systolic: systolic || null, diastolic: diastolic || null,
      heart_rate: heart_rate || null, temperature: temperature || null,
      respiratory_rate: respiratory_rate || null, oxygen_saturation: oxygen_saturation || null,
      weight: weight || null, height: height || null, bmi: bmi || null,
      pain_level: pain_level || null, notes: notes || null,
      recorded_at: new Date().toISOString(),
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data, error } = await db.from('patient_vitals').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('patient_vitals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for vitals
// Built: 2026-02-17 | Uses service role key + getDrchronoPatientId, resolvePatientIds
//
// FIX-001: RLS disabled on drchrono_* tables
// FIX-008: Uses email fallback when drchrono_patient_id is NULL
//
// WIRING: Called by usePanelData hook from vitals panel component
// SHARED: Uses _shared.ts for getDrchronoPatientId, resolvePatientIds()
// ═══════════════════════════════════════════════════════════════
