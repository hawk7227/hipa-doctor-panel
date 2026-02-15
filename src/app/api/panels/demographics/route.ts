import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
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
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data, error } = await db.from('patients').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
