import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })

  try {
    // Get drchrono_patient_id
    const { data: patientRow } = await db.from('patients').select('drchrono_patient_id').eq('id', patient_id).single()

    let problems: any[] = []
    if (patientRow?.drchrono_patient_id) {
      const { data, error } = await db
        .from('drchrono_problems')
        .select('*')
        .eq('drchrono_patient_id', patientRow.drchrono_patient_id)
        .order('date_diagnosis', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      problems = data || []
    }

    return NextResponse.json({ data: problems, source: 'drchrono' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patient_id, name, icd_code, status, date_diagnosis, notes } = body
    if (!patient_id || !name) return NextResponse.json({ error: 'patient_id and name required' }, { status: 400 })

    const { data: patientRow } = await db.from('patients').select('drchrono_patient_id').eq('id', patient_id).single()

    const { data, error } = await db.from('drchrono_problems').insert({
      drchrono_patient_id: patientRow?.drchrono_patient_id || 0,
      name, icd_code: icd_code || null, status: status || 'active',
      date_diagnosis: date_diagnosis || null, notes: notes || null,
      last_synced_at: new Date().toISOString(),
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
    const { data, error } = await db.from('drchrono_problems').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('drchrono_problems').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
