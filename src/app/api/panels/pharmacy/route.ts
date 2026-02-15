import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { data: local } = await db.from('patient_pharmacies').select('*').eq('patient_id', patient_id).order('is_preferred', { ascending: false })
    const dcId = await getDrchronoPatientId(patient_id)
    let drchrono: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_patients').select('default_pharmacy').eq('drchrono_patient_id', dcId).single()
      if (data?.default_pharmacy) drchrono = [data.default_pharmacy]
    }
    return NextResponse.json({ data: local || [], drchrono_data: drchrono })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.patient_id || !body.pharmacy_name) return NextResponse.json({ error: 'patient_id and pharmacy_name required' }, { status: 400 })
    if (body.is_preferred) {
      await db.from('patient_pharmacies').update({ is_preferred: false }).eq('patient_id', body.patient_id)
    }
    const { data, error } = await db.from('patient_pharmacies').insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    if (updates.is_preferred && updates.patient_id) {
      await db.from('patient_pharmacies').update({ is_preferred: false }).eq('patient_id', updates.patient_id)
    }
    const { data, error } = await db.from('patient_pharmacies').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('patient_pharmacies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
