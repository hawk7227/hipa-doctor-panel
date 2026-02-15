import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const dcId = await getDrchronoPatientId(patient_id)
    let items: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_line_items').select('*').eq('drchrono_patient_id', dcId).order('service_date', { ascending: false }).limit(50)
      items = data || []
    }
    return NextResponse.json({ data: items, drchrono_data: [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
