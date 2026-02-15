import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const dcId = await getDrchronoPatientId(patient_id)
    let results: any[] = [], orders: any[] = []
    if (dcId) {
      const { data: r } = await db.from('drchrono_lab_results').select('*').eq('drchrono_patient_id', dcId).order('observation_date', { ascending: false }).limit(50)
      results = r || []
      const { data: o } = await db.from('drchrono_lab_orders').select('*').eq('drchrono_patient_id', dcId).order('created_at', { ascending: false }).limit(50)
      orders = o || []
    }
    return NextResponse.json({ data: results, drchrono_data: orders })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
