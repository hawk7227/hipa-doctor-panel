// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {

    const body = await req.json()
    const { appointmentId, providerName, providerRole, reason } = body

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }
    if (!providerName) {
      return NextResponse.json({ error: 'providerName is required' }, { status: 400 })
    }
    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: 'A reason is required to unlock a chart (minimum 5 characters)' }, { status: 400 })
    }

    // Fetch current appointment
    const { data: appointment, error: fetchErr } = await supabaseAdmin
      .from('appointments')
      .select('id, chart_status')
      .eq('id', appointmentId)
      .single()

    if (fetchErr || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Validate: only signed → draft (cannot unlock closed or amended)
    if (appointment.chart_status !== 'signed') {
      return NextResponse.json({
        error: `Cannot unlock chart. Current status is "${appointment.chart_status}". Only signed charts can be unlocked. Closed charts require an addendum instead.`,
        current_status: appointment.chart_status,
      }, { status: 409 })
    }

    const now = new Date().toISOString()

    // Update appointment back to draft
    const { error: updateErr } = await supabaseAdmin
      .from('appointments')
      .update({
        chart_status: 'draft',
        chart_signed_at: null,
        chart_signed_by: null,
        is_locked: false,
        chart_locked: false,
      })
      .eq('id', appointmentId)

    if (updateErr) {
      console.error('[Chart/Unlock] Update error:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Audit log — unlock is a sensitive action, always logged with reason
    await supabaseAdmin.from('chart_audit_log').insert({
      appointment_id: appointmentId,
      action: 'unlocked',
      performed_by_name: providerName,
      performed_by_role: providerRole || 'provider',
      reason: reason.trim(),
      details: {
        unlocked_at: now,
        previous_status: 'signed',
        new_status: 'draft',
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
      user_agent: req.headers.get('user-agent') || null,
    })

    console.log(`[Chart/Unlock] Chart ${appointmentId} unlocked by ${providerName}. Reason: ${reason}`)

    return NextResponse.json({
      success: true,
      chart_status: 'draft',
      unlocked_at: now,
      unlocked_by: providerName,
    })
  } catch (err: any) {
    console.error('[Chart/Unlock] Fatal error:', err)
    return NextResponse.json({ error: err.message || 'Failed to unlock chart' }, { status: 500 })
  }
}
