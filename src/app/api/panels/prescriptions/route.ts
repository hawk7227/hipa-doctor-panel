import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId } from '../_shared'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { data: local } = await db.from('patient_prescriptions').select('*').eq('patient_id', patient_id).order('created_at', { ascending: false }).limit(50)
    const dcId = await getDrchronoPatientId(patient_id)
    let drchrono: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_medications').select('*').eq('drchrono_patient_id', dcId).order('date_prescribed', { ascending: false }).limit(50)
      drchrono = data || []
    }
    console.log(`[prescriptions] patient=${patient_id} local=${local?.length||0} dc=${drchrono.length} dcId=${dcId}`)
    return NextResponse.json({ data: local || [], drchrono_data: drchrono })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const { patient_id, appointment_id, medication_name, dosage, frequency, quantity, refills, pharmacy, notes, status } = await req.json()
    if (!patient_id || !medication_name) return NextResponse.json({ error: 'patient_id and medication_name required' }, { status: 400 })
    const { data, error } = await db.from('patient_prescriptions').insert({ patient_id, appointment_id: appointment_id||null, medication_name, dosage: dosage||null, frequency: frequency||null, quantity: quantity||null, refills: refills||0, pharmacy: pharmacy||null, notes: notes||null, status: status||'pending' }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data, error } = await db.from('patient_prescriptions').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('patient_prescriptions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
