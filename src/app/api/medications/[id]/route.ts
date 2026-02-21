// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
import { NextRequest, NextResponse } from 'next/server'
import { authenticateDoctor, db } from '@/app/api/panels/_shared'

export const runtime = 'nodejs'
export const maxDuration = 3

// PATCH /api/medications/[id] — Update or discontinue medication + audit log
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateDoctor(req)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Medication ID is required' }, { status: 400 })
    }

    // Fetch previous values for audit
    const { data: existing, error: fetchErr } = await db
      .from('patient_medications')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
    }

    const updates = await req.json()
    const action = updates.status === 'discontinued' ? 'discontinue' : 'update'

    const { data, error } = await db
      .from('patient_medications')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[medications PATCH] DB error:', error.message)
      return NextResponse.json({ error: 'Failed to update medication' }, { status: 500 })
    }

    // Audit log
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null
    await db.from('medication_audit_log').insert({
      medication_id: id,
      action,
      actor_id: auth.doctorId,
      actor_email: auth.email,
      previous_values: existing,
      new_values: updates,
      ip_address: ip,
    })

    console.log(`[medications PATCH] ${action} medication`, id)
    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[medications PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/medications/[id] — Soft delete + audit log
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateDoctor(req)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Medication ID is required' }, { status: 400 })
    }

    // Fetch previous values for audit
    const { data: existing, error: fetchErr } = await db
      .from('patient_medications')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
    }

    const { error } = await db
      .from('patient_medications')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('[medications DELETE] DB error:', error.message)
      return NextResponse.json({ error: 'Failed to delete medication' }, { status: 500 })
    }

    // Audit log
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null
    await db.from('medication_audit_log').insert({
      medication_id: id,
      action: 'delete',
      actor_id: auth.doctorId,
      actor_email: auth.email,
      previous_values: existing,
      new_values: { is_deleted: true },
      ip_address: ip,
    })

    console.log('[medications DELETE] Soft-deleted medication', id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[medications DELETE] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
