import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })

  try {
    // Local prescriptions
    const { data: local } = await db
      .from('prescriptions')
      .select('*')
      .eq('patient_id', patient_id)
      .order('created_at', { ascending: false })
      .limit(50)

    // DrChrono medications as Rx history
    const { data: patientRow } = await db.from('patients').select('drchrono_patient_id').eq('id', patient_id).single()
    let drchrono: any[] = []
    if (patientRow?.drchrono_patient_id) {
      const { data } = await db
        .from('drchrono_medications')
        .select('*')
        .eq('drchrono_patient_id', patientRow.drchrono_patient_id)
        .order('date_prescribed', { ascending: false })
        .limit(50)
      drchrono = data || []
    }

    return NextResponse.json({ data: local || [], drchrono_data: drchrono })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patient_id, appointment_id, medication_name, dosage, frequency, quantity, refills, pharmacy, notes, status } = body
    if (!patient_id || !medication_name) return NextResponse.json({ error: 'patient_id and medication_name required' }, { status: 400 })

    const { data, error } = await db.from('prescriptions').insert({
      patient_id, appointment_id: appointment_id || null,
      medication_name, dosage: dosage || null, frequency: frequency || null,
      quantity: quantity || null, refills: refills || 0,
      pharmacy: pharmacy || null, notes: notes || null,
      status: status || 'pending',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data, error } = await db.from('prescriptions').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('prescriptions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
