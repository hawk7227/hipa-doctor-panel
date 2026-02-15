import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  const type = req.nextUrl.searchParams.get('type') || 'results'
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    if (type === 'orders') {
      const { data } = await db.from('patient_lab_orders').select('*').eq('patient_id', patient_id).order('ordered_at', { ascending: false })
      return NextResponse.json({ data: data || [], drchrono_data: [] })
    }
    const { data: results } = await db.from('patient_lab_results').select('*').eq('patient_id', patient_id).order('resulted_at', { ascending: false }).limit(100)
    const dcId = await getDrchronoPatientId(patient_id)
    let drchrono: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_lab_results').select('*').eq('drchrono_patient_id', dcId).order('created_at', { ascending: false })
      drchrono = data || []
    }
    console.log(`[lab-results] patient=${patient_id} local=${results?.length||0} dc=${drchrono.length}`)
    return NextResponse.json({ data: results || [], drchrono_data: drchrono })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const table = body._type === 'order' ? 'patient_lab_orders' : 'patient_lab_results'
    delete body._type
    if (!body.patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    const { data, error } = await db.from(table).insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, _type, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const table = _type === 'order' ? 'patient_lab_orders' : 'patient_lab_results'
    const { data, error } = await db.from(table).update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const type = req.nextUrl.searchParams.get('type')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const table = type === 'order' ? 'patient_lab_orders' : 'patient_lab_results'
  const { error } = await db.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
