// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
import { NextRequest, NextResponse } from 'next/server'
import { authenticateDoctor, db } from '@/app/api/panels/_shared'
import type { CreateMedicationInput } from '@/types/medication'

export const runtime = 'nodejs'
export const maxDuration = 3

// GET /api/medications?patient_id=<uuid>
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateDoctor(req)
    if (auth instanceof NextResponse) return auth

    const patientId = req.nextUrl.searchParams.get('patient_id')
    if (!patientId) {
      return NextResponse.json({ error: 'patient_id is required' }, { status: 400 })
    }

    const { data, error } = await db
      .from('patient_medications')
      .select('*')
      .eq('patient_id', patientId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[medications GET] DB error:', error.message)
      return NextResponse.json({ error: 'Failed to fetch medications' }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err: any) {
    console.error('[medications GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/medications — Create medication + audit log
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateDoctor(req)
    if (auth instanceof NextResponse) return auth

    const body: CreateMedicationInput = await req.json()

    // Validate required fields
    if (!body.patient_id || !body.medication_name?.trim()) {
      return NextResponse.json({ error: 'patient_id and medication_name are required' }, { status: 400 })
    }

    const record = {
      patient_id: body.patient_id,
      medication_name: body.medication_name.trim(),
      dosage: body.dosage || null,
      frequency: body.frequency || null,
      route: body.route || 'oral',
      prescriber: body.prescriber || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      status: body.status || 'active',
      is_prn: body.is_prn || false,
      prn_reason: body.prn_reason || null,
      side_effects: body.side_effects || null,
      adherence_score: body.adherence_score ?? null,
      notes: body.notes || null,
      is_deleted: false,
    }

    const { data, error } = await db
      .from('patient_medications')
      .insert(record)
      .select()
      .single()

    if (error) {
      console.error('[medications POST] DB error:', error.message)
      return NextResponse.json({ error: 'Failed to create medication' }, { status: 500 })
    }

    // Audit log
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null
    await db.from('medication_audit_log').insert({
      medication_id: data.id,
      action: 'create',
      actor_id: auth.doctorId,
      actor_email: auth.email,
      previous_values: null,
      new_values: record,
      ip_address: ip,
    })

    console.log('[medications POST] Created medication', data.id, 'for patient', body.patient_id)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error('[medications POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
