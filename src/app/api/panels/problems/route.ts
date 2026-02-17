import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId, authenticateDoctor } from '../_shared'
import { getExportProblems } from '@/lib/export-fallback'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { data: local } = await db.from('patient_problems').select('*').eq('patient_id', patient_id).order('created_at', { ascending: false })
    const dcId = await getDrchronoPatientId(patient_id)
    let drchrono: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_problems').select('*').eq('drchrono_patient_id', dcId).order('date_diagnosis', { ascending: false })
      drchrono = data || []
    }
    if (drchrono.length === 0) {
      drchrono = await getExportProblems(db, dcId, patient_id)
    }
    console.log(`[problems] patient=${patient_id} local=${local?.length||0} dc=${drchrono.length}`)
    return NextResponse.json({ data: local || [], drchrono_data: drchrono })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    if (!body.patient_id || !body.description) return NextResponse.json({ error: 'patient_id and description required' }, { status: 400 })
    const { data, error } = await db.from('patient_problems').insert({
      patient_id: body.patient_id, doctor_id: body.doctor_id, description: body.description,
      icd10_code: body.icd10_code, snomed_code: body.snomed_code,
      status: body.status || 'active', category: body.category || 'problem',
      severity: body.severity, onset_date: body.onset_date, date_diagnosed: body.date_diagnosed,
      is_chronic: body.is_chronic || false, is_principal: body.is_principal || false,
      notes: body.notes, recorded_by: body.recorded_by
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data, error } = await db.from('patient_problems').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('patient_problems').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
