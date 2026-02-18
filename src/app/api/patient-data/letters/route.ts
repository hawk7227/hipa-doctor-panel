import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')

  // List templates
  if (action === 'templates') {
    const { data, error } = await db
      .from('letter_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  }

  // List letters
  if (action === 'list') {
    const doctorId = req.nextUrl.searchParams.get('doctor_id')
    const patientId = req.nextUrl.searchParams.get('patient_id')
    let query = db.from('medical_letters').select('*, patients(first_name, last_name)')
      .order('created_at', { ascending: false }).limit(100)
    if (doctorId) query = query.eq('doctor_id', doctorId)
    if (patientId) query = query.eq('patient_id', patientId)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  }

  // Search patients
  if (action === 'search_patients') {
    const q = req.nextUrl.searchParams.get('q') || ''
    if (q.length < 2) return NextResponse.json({ data: [] })
    const { data } = await db.from('patients')
      .select('id, first_name, last_name, email, date_of_birth')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10)
    return NextResponse.json({ data: data || [] })
  }

  // Single letter
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const { data, error } = await db.from('medical_letters').select('*').eq('id', id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  return NextResponse.json({ error: 'action parameter required' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patient_id, doctor_id, letter_type, template_id, subject,
      recipient_name, recipient_organization, body_text, ai_generated,
      status, signed_at, signed_by } = body

    if (!patient_id || !doctor_id || !body_text) {
      return NextResponse.json({ error: 'patient_id, doctor_id, and body_text required' }, { status: 400 })
    }

    const { data, error } = await db.from('medical_letters').insert({
      patient_id, doctor_id, letter_type: letter_type || 'other',
      template_id, subject, recipient_name, recipient_organization,
      body_text, ai_generated: ai_generated || false,
      status: status || 'draft',
      signed_at, signed_by,
    }).select().single()

    if (error) {
      console.error('[letters] create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Increment template usage count
    if (template_id) {
      await db.rpc('increment_template_usage', { template_id_param: template_id }).catch(() => {
        // Non-critical: just log
        db.from('letter_templates').update({ usage_count: db.raw ? undefined : 0 }).eq('id', template_id).catch(() => {})
      })
    }

    console.log(`[letters] Created ${letter_type} for patient=${patient_id}`)
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

    updates.updated_at = new Date().toISOString()
    const { data, error } = await db.from('medical_letters').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  // Soft delete: mark as voided
  const { error } = await db.from('medical_letters').update({
    status: 'voided', voided_at: new Date().toISOString()
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
