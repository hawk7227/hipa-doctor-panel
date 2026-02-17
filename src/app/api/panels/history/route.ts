// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { db, authenticateDoctor } from '../_shared'
export const dynamic = 'force-dynamic'

function getTable(type: string | null) {
  if (type === 'family') return 'patient_family_history'
  if (type === 'social') return 'patient_social_history'
  if (type === 'surgical') return 'patient_surgical_history'
  return null
}

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  const history_type = req.nextUrl.searchParams.get('type')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    if (history_type) {
      const table = getTable(history_type)
      if (!table) return NextResponse.json({ error: 'Invalid history type. Use: family, social, surgical' }, { status: 400 })
      const { data, error } = await db.from(table).select('*').eq('patient_id', patient_id).order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: data || [], drchrono_data: [] })
    }
    // Return all three types
    const [fam, soc, sur] = await Promise.all([
      db.from('patient_family_history').select('*').eq('patient_id', patient_id).order('created_at', { ascending: false }),
      db.from('patient_social_history').select('*').eq('patient_id', patient_id).order('created_at', { ascending: false }),
      db.from('patient_surgical_history').select('*').eq('patient_id', patient_id).order('created_at', { ascending: false }),
    ])
    return NextResponse.json({ data: { family: fam.data || [], social: soc.data || [], surgical: sur.data || [] }, drchrono_data: [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const { history_type, ...rest } = body
    if (!rest.patient_id || !history_type) return NextResponse.json({ error: 'patient_id, history_type required' }, { status: 400 })
    const table = getTable(history_type)
    if (!table) return NextResponse.json({ error: 'Invalid history type' }, { status: 400 })
    const { data, error } = await db.from(table).insert(rest).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { id, history_type, ...updates } = await req.json()
    if (!id || !history_type) return NextResponse.json({ error: 'id and history_type required' }, { status: 400 })
    const table = getTable(history_type)
    if (!table) return NextResponse.json({ error: 'Invalid history type' }, { status: 400 })
    const { data, error } = await db.from(table).update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get('id')
  const type = req.nextUrl.searchParams.get('type')
  if (!id || !type) return NextResponse.json({ error: 'id and type required' }, { status: 400 })
  const table = getTable(type)
  if (!table) return NextResponse.json({ error: 'Invalid history type' }, { status: 400 })
  const { error } = await db.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for history
// Built: 2026-02-17 | Uses service role key + getDrchronoPatientId
//
// FIX-001: RLS disabled on drchrono_* tables
// FIX-008: Uses email fallback when drchrono_patient_id is NULL
//
// WIRING: Called by usePanelData hook from history panel component
// SHARED: Uses _shared.ts for getDrchronoPatientId()
// ═══════════════════════════════════════════════════════════════
