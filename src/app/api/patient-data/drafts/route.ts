import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — List drafts for a doctor's patients
export async function GET(req: NextRequest) {
  const doctorId = req.nextUrl.searchParams.get('doctor_id')
  const status = req.nextUrl.searchParams.get('status') || 'pending'
  const patientId = req.nextUrl.searchParams.get('patient_id')

  if (!doctorId) return NextResponse.json({ error: 'doctor_id required' }, { status: 400 })

  try {
    let query = db.from('chart_drafts')
      .select('*, patients(first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (status !== 'all') query = query.eq('status', status)
    if (patientId) query = query.eq('patient_id', patientId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — Create a new draft (from assistant)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patient_id, appointment_id, author_id, author_email, author_name,
      author_role, panel, action, target_table, target_record_id,
      draft_data, original_data, description } = body

    if (!patient_id || !panel || !action || !draft_data) {
      return NextResponse.json({ error: 'patient_id, panel, action, and draft_data required' }, { status: 400 })
    }

    const { data, error } = await db.from('chart_drafts').insert({
      patient_id, appointment_id, author_id, author_email, author_name,
      author_role: author_role || 'assistant', panel, action,
      target_table, target_record_id, draft_data, original_data,
      description, status: 'pending',
    }).select().single()

    if (error) {
      console.error('[drafts] create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[drafts] Created ${action} draft for ${panel} by ${author_name || author_email}`)
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT — Approve or reject a draft
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, reviewed_by, reviewed_by_name, reviewed_at, review_notes } = body

    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

    const updates: any = {
      status,
      reviewed_by,
      reviewed_by_name,
      reviewed_at: reviewed_at || new Date().toISOString(),
      review_notes,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await db.from('chart_drafts').update(updates).eq('id', id).select().single()
    if (error) {
      console.error('[drafts] update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If approved, apply the change
    if (status === 'approved' && data) {
      try {
        await applyDraft(data)
      } catch (applyErr: any) {
        console.error('[drafts] apply error:', applyErr)
        // Don't fail the approval — just log
      }
    }

    console.log(`[drafts] ${status} draft ${id} by ${reviewed_by_name}`)
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Apply an approved draft — insert/update/delete the actual record
async function applyDraft(draft: any) {
  const { action, target_table, target_record_id, draft_data, patient_id } = draft

  if (!target_table) return

  if (action === 'add') {
    const { error } = await db.from(target_table).insert({
      ...draft_data,
      patient_id,
    })
    if (error) throw error
  } else if (action === 'edit' && target_record_id) {
    const { error } = await db.from(target_table)
      .update({ ...draft_data, updated_at: new Date().toISOString() })
      .eq('id', target_record_id)
    if (error) throw error
  } else if (action === 'delete' && target_record_id) {
    const { error } = await db.from(target_table).delete().eq('id', target_record_id)
    if (error) throw error
  }
}
