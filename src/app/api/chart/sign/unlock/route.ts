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

export async function GET(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {

    const appointmentId = req.nextUrl.searchParams.get('appointmentId')
    const action = req.nextUrl.searchParams.get('action') || 'view'  // view | download

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId query parameter is required' }, { status: 400 })
    }

    // Fetch appointment to get PDF URL
    const { data: appointment, error: fetchErr } = await supabaseAdmin
      .from('appointments')
      .select('id, chart_status, clinical_note_pdf_url, chart_closed_at, patient_name')
      .eq('id', appointmentId)
      .single()

    if (fetchErr || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    if (!appointment.clinical_note_pdf_url) {
      return NextResponse.json({
        error: 'No clinical note PDF exists for this appointment. The chart must be closed first.',
        chart_status: appointment.chart_status,
      }, { status: 404 })
    }

    // Audit log: PDF viewed/downloaded
    const auditAction = action === 'download' ? 'pdf_downloaded' : 'pdf_viewed'
    try {
      await supabaseAdmin.from('chart_audit_log').insert({
        appointment_id: appointmentId,
        action: auditAction,
        performed_by_name: req.headers.get('x-user-name') || 'Unknown',
        performed_by_role: req.headers.get('x-user-role') || 'provider',
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
        user_agent: req.headers.get('user-agent') || null,
      })
    } catch { /* non-fatal audit log */ }

    // If the URL is a signed URL, return it directly
    if (appointment.clinical_note_pdf_url.startsWith('http')) {
      return NextResponse.json({
        success: true,
        pdf_url: appointment.clinical_note_pdf_url,
        chart_status: appointment.chart_status,
        closed_at: appointment.chart_closed_at,
        patient_name: appointment.patient_name,
      })
    }

    // If it's a storage path, generate a fresh signed URL
    const storagePath = appointment.clinical_note_pdf_url.replace('clinical-notes/', '')
    const { data: signedUrl, error: signErr } = await supabaseAdmin.storage
      .from('clinical-notes')
      .createSignedUrl(storagePath, 60 * 60) // 1 hour

    if (signErr || !signedUrl) {
      return NextResponse.json({ error: 'Failed to generate PDF download URL' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      pdf_url: signedUrl.signedUrl,
      chart_status: appointment.chart_status,
      closed_at: appointment.chart_closed_at,
      patient_name: appointment.patient_name,
    })
  } catch (err: any) {
    console.error('[Chart/PDF] Fatal error:', err)
    return NextResponse.json({ error: err.message || 'Failed to retrieve PDF' }, { status: 500 })
  }
}
