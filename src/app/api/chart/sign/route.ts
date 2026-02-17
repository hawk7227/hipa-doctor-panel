// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
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
    const { appointmentId, providerName, providerRole } = body

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }
    if (!providerName) {
      return NextResponse.json({ error: 'providerName is required' }, { status: 400 })
    }

    // Fetch current appointment
    const { data: appointment, error: fetchErr } = await supabaseAdmin
      .from('appointments')
      .select('id, chart_status, is_locked')
      .eq('id', appointmentId)
      .single()

    if (fetchErr || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Validate state transition: only draft → signed
    if (appointment.chart_status !== 'draft') {
      return NextResponse.json({
        error: `Cannot sign chart. Current status is "${appointment.chart_status}". Only draft charts can be signed.`,
        current_status: appointment.chart_status,
      }, { status: 409 })
    }

    const now = new Date().toISOString()

    // Update appointment
    const { error: updateErr } = await supabaseAdmin
      .from('appointments')
      .update({
        chart_status: 'signed',
        chart_signed_at: now,
        chart_signed_by: providerName,
        is_locked: true,
        chart_locked: true,
      })
      .eq('id', appointmentId)

    if (updateErr) {
      console.error('[Chart/Sign] Update error:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Audit log entry
    await supabaseAdmin.from('chart_audit_log').insert({
      appointment_id: appointmentId,
      action: 'signed',
      performed_by_name: providerName,
      performed_by_role: providerRole || 'provider',
      details: { signed_at: now },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
      user_agent: req.headers.get('user-agent') || null,
    })

    return NextResponse.json({
      success: true,
      chart_status: 'signed',
      signed_at: now,
      signed_by: providerName,
    })
  } catch (err: any) {
    console.error('[Chart/Sign] Fatal error:', err)
    return NextResponse.json({ error: err.message || 'Failed to sign chart' }, { status: 500 })
  }
}
