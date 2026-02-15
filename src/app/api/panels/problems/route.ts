import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId } from '../_shared'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const dcId = await getDrchronoPatientId(patient_id)
    let problems: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_problems').select('*').eq('drchrono_patient_id', dcId).order('date_diagnosis', { ascending: false })
      problems = data || []
    }
    console.log(`[problems] patient=${patient_id} dc=${problems.length} dcId=${dcId}`)
    return NextResponse.json({ data: problems, source: 'drchrono' })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const { patient_id, name, icd_code, status, date_diagnosis, notes } = await req.json()
    if (!patient_id || !name) return NextResponse.json({ error: 'patient_id and name required' }, { status: 400 })
    const dcId = await getDrchronoPatientId(patient_id)
    const { data, error } = await db.from('drchrono_problems').insert({ drchrono_patient_id: dcId || 0, name, icd_code: icd_code||null, status: status||'active', date_diagnosis: date_diagnosis||null, notes: notes||null, last_synced_at: new Date().toISOString() }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data, error } = await db.from('drchrono_problems').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('drchrono_problems').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
