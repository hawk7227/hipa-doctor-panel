import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId, authenticateDoctor } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  const type = req.nextUrl.searchParams.get('type') || 'claims'
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    if (type === 'payments') {
      const { data } = await db.from('billing_payments').select('*').eq('patient_id', patient_id).order('payment_date', { ascending: false })
      return NextResponse.json({ data: data || [], drchrono_data: [] })
    }
    if (type === 'insurance') {
      const { data } = await db.from('patient_insurance').select('*').eq('patient_id', patient_id).order('insurance_type')
      return NextResponse.json({ data: data || [], drchrono_data: [] })
    }
    if (type === 'superbills') {
      const { data } = await db.from('superbills').select('*').eq('patient_id', patient_id).order('service_date', { ascending: false })
      return NextResponse.json({ data: data || [], drchrono_data: [] })
    }
    // Default: claims
    const { data: claims } = await db.from('billing_claims').select('*').eq('patient_id', patient_id).order('created_at', { ascending: false })
    const dcId = await getDrchronoPatientId(patient_id)
    let drchrono: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_line_items').select('*').eq('drchrono_patient_id', dcId).order('created_at', { ascending: false })
      drchrono = data || []
    }
    console.log(`[billing] patient=${patient_id} claims=${claims?.length||0} dc=${drchrono.length}`)
    return NextResponse.json({ data: claims || [], drchrono_data: drchrono })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const table = body._type === 'payment' ? 'billing_payments'
      : body._type === 'insurance' ? 'patient_insurance'
      : body._type === 'superbill' ? 'superbills'
      : 'billing_claims'
    delete body._type
    if (!body.patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    const { data, error } = await db.from(table).insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { id, _type, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const table = _type === 'payment' ? 'billing_payments'
      : _type === 'insurance' ? 'patient_insurance'
      : _type === 'superbill' ? 'superbills'
      : 'billing_claims'
    const { data, error } = await db.from(table).update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get('id')
  const type = req.nextUrl.searchParams.get('type')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const table = type === 'payment' ? 'billing_payments'
    : type === 'insurance' ? 'patient_insurance'
    : type === 'superbill' ? 'superbills'
    : 'billing_claims'
  const { error } = await db.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
