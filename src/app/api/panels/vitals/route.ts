import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })

  try {
    const { data, error } = await db
      .from('vitals')
      .select('*')
      .eq('patient_id', patient_id)
      .order('recorded_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patient_id, appointment_id, systolic, diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation, weight, height, bmi, pain_level, notes } = body
    if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })

    const { data, error } = await db.from('vitals').insert({
      patient_id, appointment_id: appointment_id || null,
      systolic: systolic || null, diastolic: diastolic || null,
      heart_rate: heart_rate || null, temperature: temperature || null,
      respiratory_rate: respiratory_rate || null, oxygen_saturation: oxygen_saturation || null,
      weight: weight || null, height: height || null, bmi: bmi || null,
      pain_level: pain_level || null, notes: notes || null,
      recorded_at: new Date().toISOString(),
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
    const { data, error } = await db.from('vitals').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('vitals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
