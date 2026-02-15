import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { data: patient } = await db.from('patients').select('preferred_pharmacy, id').eq('id', patient_id).single()
    const dcId = await getDrchronoPatientId(patient_id)
    let dcPharmacy: any = null
    if (dcId) {
      const { data } = await db.from('drchrono_patients').select('default_pharmacy, preferred_pharmacy_name').eq('drchrono_patient_id', dcId).single()
      dcPharmacy = data
    }
    const pharmacyData = patient?.preferred_pharmacy || dcPharmacy?.default_pharmacy || dcPharmacy?.preferred_pharmacy_name || null
    return NextResponse.json({ data: pharmacyData ? [{ id: patient_id, pharmacy: pharmacyData, _drchrono: dcPharmacy }] : [], drchrono_data: dcPharmacy ? [dcPharmacy] : [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  try {
    const { patient_id, preferred_pharmacy } = await req.json()
    if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    const { data, error } = await db.from('patients').update({ preferred_pharmacy }).eq('id', patient_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
