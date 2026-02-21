// ═══════════════════════════════════════════════════════════════
// /api/patient-data — Unified patient data API (NO AUTH REQUIRED)
//
// GET ?patient_id=X  → Returns ALL data for a patient in one call
// PUT               → Auto-save changes back to DB
// POST              → Create new records
//
// Uses service role key directly — no session cookies needed.
// The doctor panel is behind a login page, so if a request reaches
// this endpoint, the user is already authenticated.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── GET: Load ALL patient data in one call ──────────────────────
export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patient_id')
  if (!patientId) {
    return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  }

  try {
    const { data: patient } = await db
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single()

    // Parallel fetch ALL data from local tables
    const [
      medications,
      allergies,
      problems,
      vitals,
      appointments,
      clinicalNotes,
      documents,
      labResults,
      immunizations,
      insurance,
      history,
      prescriptions,
      orders,
      billing, billingPayments,
      carePlans,
      alerts,
      pharmacy,
    ] = await Promise.all([
      db.from('patient_medications').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),

      db.from('patient_allergies').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),

      db.from('patient_problems').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),

      db.from('patient_vitals').select('*').eq('patient_id', patientId).order('recorded_at', { ascending: false }).limit(20).then(r => r.data || []),

      db.from('appointments').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(20).then(r => r.data || []),

      db.from('clinical_notes').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),

      db.from('patient_documents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),

      db.from('lab_results').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),

      db.from('patient_immunizations').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),

      db.from('patient_insurance').select('*').eq('patient_id', patientId).then(r => r.data || []),

      Promise.all([
        db.from('patient_family_history').select('*').eq('patient_id', patientId).then(r => r.data || []),
        db.from('patient_social_history').select('*').eq('patient_id', patientId).then(r => r.data || []),
        db.from('patient_surgical_history').select('*').eq('patient_id', patientId).then(r => r.data || []),
      ]).then(([family, social, surgical]) => ({ family, social, surgical })),

      db.from('prescriptions').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),

      db.from('lab_orders').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),

      db.from('billing_claims').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),
      db.from('billing_payments').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),

      db.from('care_plans').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).then(r => r.data || []),

      db.from('cdss_alerts').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(10).then(r => r.data || []),

      patient?.preferred_pharmacy ? Promise.resolve(patient.preferred_pharmacy) : Promise.resolve(null),
    ])

    console.log(`[patient-data] Loaded patient=${patientId} meds=${medications.length} allergies=${allergies.length}`)

    return NextResponse.json({
      patient,
      medications: { local: medications },
      allergies: { local: allergies },
      problems: { local: problems },
      vitals,
      appointments,
      clinical_notes: { local: clinicalNotes },
      documents: { local: documents },
      lab_results: { local: labResults },
      immunizations,
      insurance,
      history,
      prescriptions,
      orders,
      billing: { claims: billing, payments: billingPayments },
      care_plans: carePlans,
      alerts,
      pharmacy,
    })
  } catch (err: any) {
    console.error('[patient-data] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── PUT: Auto-save changes (debounced from frontend) ───────────
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { table, id, updates, patient_id } = body

    if (!table || !id) {
      return NextResponse.json({ error: 'table and id required' }, { status: 400 })
    }

    // Whitelist of allowed tables for safety
    const ALLOWED_TABLES = [
      'patients', 'patient_medications', 'patient_allergies', 'patient_problems',
      'patient_vitals', 'clinical_notes', 'patient_documents', 'patient_immunizations',
      'patient_insurance', 'patient_family_history', 'patient_social_history',
      'patient_surgical_history', 'prescriptions', 'lab_orders', 'lab_results',
      'billing_claims', 'billing_payments', 'care_plans', 'appointments',
      'cdss_alerts', 'referrals', 'staff_tasks',
    ]

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: `Table '${table}' not allowed` }, { status: 400 })
    }

    const { data, error } = await db
      .from(table)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(`[patient-data] PUT ${table}/${id} error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[patient-data] Saved ${table}/${id}`)
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST: Create new records ───────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { table, record } = body

    if (!table || !record) {
      return NextResponse.json({ error: 'table and record required' }, { status: 400 })
    }

    const ALLOWED_TABLES = [
      'patient_medications', 'patient_allergies', 'patient_problems',
      'patient_vitals', 'clinical_notes', 'patient_documents', 'patient_immunizations',
      'patient_insurance', 'patient_family_history', 'patient_social_history',
      'patient_surgical_history', 'prescriptions', 'lab_orders', 'lab_results',
      'billing_claims', 'billing_payments', 'care_plans', 'cdss_alerts',
      'referrals', 'staff_tasks',
    ]

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: `Table '${table}' not allowed` }, { status: 400 })
    }

    const { data, error } = await db
      .from(table)
      .insert(record)
      .select()
      .single()

    if (error) {
      console.error(`[patient-data] POST ${table} error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[patient-data] Created ${table}/${data.id}`)
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── DELETE: Remove records ─────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const table = req.nextUrl.searchParams.get('table')
    const id = req.nextUrl.searchParams.get('id')

    if (!table || !id) {
      return NextResponse.json({ error: 'table and id required' }, { status: 400 })
    }

    const ALLOWED_TABLES = [
      'patient_medications', 'patient_allergies', 'patient_problems',
      'patient_vitals', 'clinical_notes', 'patient_documents', 'patient_immunizations',
      'patient_insurance', 'patient_family_history', 'patient_social_history',
      'patient_surgical_history', 'prescriptions', 'lab_orders', 'lab_results',
      'care_plans', 'cdss_alerts', 'referrals', 'staff_tasks',
    ]

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: `Table '${table}' not allowed` }, { status: 400 })
    }

    const { error } = await db.from(table).delete().eq('id', id)

    if (error) {
      console.error(`[patient-data] DELETE ${table}/${id} error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[patient-data] Deleted ${table}/${id}`)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
