import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET /api/panels/allergies?patient_id=xxx
export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })

  try {
    // Local allergies
    const { data: local, error: localErr } = await db
      .from('patient_allergies')
      .select('*')
      .eq('patient_id', patient_id)
      .order('created_at', { ascending: false })

    // DrChrono allergies (by drchrono_patient_id if available)
    const { data: patientRow } = await db.from('patients').select('drchrono_patient_id').eq('id', patient_id).single()
    let drchrono: any[] = []
    if (patientRow?.drchrono_patient_id) {
      const { data } = await db
        .from('drchrono_allergies')
        .select('*')
        .eq('drchrono_patient_id', patientRow.drchrono_patient_id)
        .order('onset_date', { ascending: false })
      drchrono = data || []
    }

    return NextResponse.json({
      data: local || [],
      drchrono_data: drchrono,
      total: (local?.length || 0) + drchrono.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/panels/allergies — create new allergy
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patient_id, allergen, reaction, severity, status, onset_date, notes } = body
    if (!patient_id || !allergen) return NextResponse.json({ error: 'patient_id and allergen required' }, { status: 400 })

    const { data, error } = await db.from('patient_allergies').insert({
      patient_id, allergen, reaction: reaction || null, severity: severity || 'mild',
      status: status || 'active', onset_date: onset_date || null, notes: notes || null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT /api/panels/allergies — update allergy
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data, error } = await db.from('patient_allergies').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/panels/allergies?id=xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await db.from('patient_allergies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
