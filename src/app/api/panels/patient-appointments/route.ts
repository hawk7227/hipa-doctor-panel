import { NextRequest, NextResponse } from 'next/server'
import { db } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { data, error } = await db.from('appointments').select('id, status, visit_type, chief_complaint, requested_date_time, chart_status, reason, created_at').eq('patient_id', patient_id).order('requested_date_time', { ascending: false }).limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [], drchrono_data: [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
