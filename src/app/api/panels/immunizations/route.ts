import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const dcId = await getDrchronoPatientId(patient_id)
    let vaccines: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_vaccines').select('*').eq('drchrono_patient_id', dcId).order('administered_date', { ascending: false }).limit(50)
      vaccines = data || []
    }
    return NextResponse.json({ data: vaccines, drchrono_data: [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
