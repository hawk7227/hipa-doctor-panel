// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { db, resolvePatientIds, authenticateDoctor } from '../_shared'
import { getExportMedications } from '@/lib/export-fallback'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const raw_id = req.nextUrl.searchParams.get('patient_id')
  if (!raw_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { uuid, dcId } = await resolvePatientIds(raw_id)
    const { data: local } = uuid
      ? await db.from('patient_medications').select('*').eq('patient_id', uuid).order('created_at', { ascending: false })
      : { data: [] }
    let drchrono: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_medications').select('*').eq('drchrono_patient_id', dcId).order('date_prescribed', { ascending: false })
      drchrono = data || []
    }
    if (drchrono.length === 0) {
      drchrono = await getExportMedications(db, dcId, uuid || raw_id)
    }
    console.log(`[medications] raw=${raw_id} uuid=${uuid} dcId=${dcId} local=${local?.length||0} dc=${drchrono.length}`)
    return NextResponse.json({ data: local || [], drchrono_data: drchrono })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const { uuid } = await resolvePatientIds(body.patient_id)
    const { name, dosage, frequency, route, status, prescribed_date, notes } = body
    if (!uuid || !name) return NextResponse.json({ error: 'patient_id and name required' }, { status: 400 })
    const { data, error } = await db.from('patient_medications').insert({ patient_id: uuid, name, dosage: dosage||null, frequency: frequency||null, route: route||null, status: status||'active', prescribed_date: prescribed_date||null, notes: notes||null }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data, error } = await db.from('patient_medications').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('patient_medications').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
