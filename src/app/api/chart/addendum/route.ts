// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
// import { requireDoctor } from '@/lib/api-auth' // REMOVED — zero auth, service role only
import { createClient } from '@supabase/supabase-js'
import { generateClinicalNotePDF } from '@/lib/generateClinicalNotePDF'
import type { ClinicalNotePDFInput, SOAPNotes } from '@/lib/generateClinicalNotePDF'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 30

export async function POST(req: NextRequest) {
  // Zero auth — uses service role key directly. Behind login page.
  try {

    const body = await req.json()
    const {
      appointmentId,
      text,
      addendumType = 'addendum',
      reason,
      authorName,
      authorRole = 'provider',
    } = body

    // Validation
    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }
    if (!text || text.trim().length < 3) {
      return NextResponse.json({ error: 'Addendum text is required (minimum 3 characters)' }, { status: 400 })
    }
    if (!authorName) {
      return NextResponse.json({ error: 'authorName is required' }, { status: 400 })
    }
    if (!['addendum', 'late_entry', 'correction'].includes(addendumType)) {
      return NextResponse.json({ error: 'addendumType must be addendum, late_entry, or correction' }, { status: 400 })
    }
    if (addendumType === 'correction' && (!reason || reason.trim().length < 5)) {
      return NextResponse.json({ error: 'A reason is required for corrections (minimum 5 characters)' }, { status: 400 })
    }

    // Fetch appointment
    const { data: appointment, error: fetchErr } = await supabaseAdmin
      .from('appointments')
      .select(`
        id, chart_status, chart_signed_at, chart_signed_by, chart_closed_at, chart_closed_by,
        scheduled_time, visit_type, reason,
        soap_notes, doctor_notes,
        patient_name, patient_email, patient_phone, patient_dob,
        patients (
          id, full_name, email, phone, date_of_birth, gender,
          address_line1, city, state, zip_code, chart_id
        ),
        doctors (
          id, full_name, email, credentials, npi_number,
          license_state, license_number
        )
      `)
      .eq('id', appointmentId)
      .single()

    if (fetchErr || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Validate: only closed or amended charts accept addendums
    if (appointment.chart_status !== 'closed' && appointment.chart_status !== 'amended') {
      return NextResponse.json({
        error: `Cannot add addendum. Chart status is "${appointment.chart_status}". Only closed or amended charts accept addendums.`,
        current_status: appointment.chart_status,
      }, { status: 409 })
    }

    const now = new Date().toISOString()

    // Insert the addendum
    const { data: newAddendum, error: insertErr } = await supabaseAdmin
      .from('chart_addendums')
      .insert({
        appointment_id: appointmentId,
        addendum_type: addendumType,
        text: text.trim(),
        reason: reason?.trim() || null,
        created_by: authorName,
        created_by_name: authorName,
        created_by_role: authorRole,
      })
      .select('id, text, addendum_type, reason, created_by_name, created_by_role, created_at')
      .single()

    if (insertErr || !newAddendum) {
      console.error('[Chart/Addendum] Insert error:', insertErr)
      return NextResponse.json({ error: insertErr?.message || 'Failed to insert addendum' }, { status: 500 })
    }

    // Update chart status to amended
    await supabaseAdmin
      .from('appointments')
      .update({ chart_status: 'amended' })
      .eq('id', appointmentId)

    // Audit log
    const actionType = addendumType === 'correction'
      ? 'correction_added'
      : addendumType === 'late_entry'
      ? 'late_entry_added'
      : 'addendum_added'

    await supabaseAdmin.from('chart_audit_log').insert({
      appointment_id: appointmentId,
      action: actionType,
      performed_by_name: authorName,
      performed_by_role: authorRole,
      reason: reason?.trim() || null,
      details: {
        addendum_id: newAddendum.id,
        addendum_type: addendumType,
        text_length: text.trim().length,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
      user_agent: req.headers.get('user-agent') || null,
    })

    // ─── Regenerate PDF with addendum ────────────────────────
    // Fetch ALL addendums for this appointment
    const { data: allAddendums } = await supabaseAdmin
      .from('chart_addendums')
      .select('id, addendum_type, text, reason, created_by_name, created_by_role, cosigned_by_name, cosigned_at, created_at')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true })

    // Build PDF input
    const patient = Array.isArray(appointment.patients) ? appointment.patients[0] : appointment.patients
    const doctor = Array.isArray(appointment.doctors) ? appointment.doctors[0] : appointment.doctors

    let soapNotes: SOAPNotes = {}
    if (appointment.soap_notes) {
      if (typeof appointment.soap_notes === 'string') {
        try { soapNotes = JSON.parse(appointment.soap_notes) } catch { soapNotes = { assessment: appointment.soap_notes } }
      } else {
        soapNotes = appointment.soap_notes as SOAPNotes
      }
    }

    const dateOfService = appointment.scheduled_time
      ? new Date(appointment.scheduled_time).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : ''

    const pdfInput: ClinicalNotePDFInput = {
      practice: {
        name: 'Medazon Health',
        subtitle: 'Virtual Urgent Care — Telehealth Services',
        address: 'Orlando, FL',
        phone: '(555) 123-4567',
        fax: '(555) 123-4568',
        npi: doctor?.npi_number || '',
      },
      patient: {
        full_name: patient?.full_name || appointment.patient_name || 'Unknown',
        date_of_birth: patient?.date_of_birth || appointment.patient_dob || '',
        email: patient?.email || appointment.patient_email || '',
        phone: patient?.phone || appointment.patient_phone || '',
        address: patient ? [patient.address_line1, patient.city, patient.state, patient.zip_code].filter(Boolean).join(', ') : '',
        gender: patient?.gender || undefined,
      },
      provider: {
        full_name: doctor?.full_name || appointment.chart_signed_by || 'Provider',
        credentials: doctor?.credentials || 'MD',
        email: doctor?.email || '',
        npi: doctor?.npi_number || '',
        license_state: doctor?.license_state || 'Florida',
        license_number: doctor?.license_number || '',
      },
      appointment: {
        id: appointmentId,
        date_of_service: dateOfService,
        visit_type: appointment.visit_type || 'Video Consultation',
        signed_at: appointment.chart_signed_at
          ? new Date(appointment.chart_signed_at).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
          : '',
        closed_at: appointment.chart_closed_at
          ? new Date(appointment.chart_closed_at).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
          : '',
      },
      soap: soapNotes,
      addendums: (allAddendums || []).map(a => ({
        ...a,
        addendum_type: a.addendum_type || 'addendum',
        created_by_name: a.created_by_name || 'Provider',
        created_by_role: a.created_by_role || 'provider',
      })),
      doctor_notes: appointment.doctor_notes || undefined,
    }

    // Generate PDF
    const pdfBytes = await generateClinicalNotePDF(pdfInput)

    // Upload
    const fileName = `${appointmentId}/${Date.now()}-clinical-note-amended.pdf`
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('clinical-notes')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

    let pdfUrl = ''
    if (!uploadErr) {
      const { data: signedUrl } = await supabaseAdmin.storage
        .from('clinical-notes')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365)
      pdfUrl = signedUrl?.signedUrl || `clinical-notes/${fileName}`

      // Update the PDF URL on the appointment
      await supabaseAdmin
        .from('appointments')
        .update({ clinical_note_pdf_url: pdfUrl })
        .eq('id', appointmentId)

      // Audit: PDF regenerated
      await supabaseAdmin.from('chart_audit_log').insert({
        appointment_id: appointmentId,
        action: 'pdf_generated',
        performed_by_name: 'System',
        performed_by_role: 'system',
        details: {
          file_name: fileName,
          file_size: pdfBytes.length,
          trigger: 'addendum_added',
          addendum_count: (allAddendums || []).length,
        },
      })
    } else {
      console.error('[Chart/Addendum] PDF upload error (non-fatal):', uploadErr)
    }

    console.log(`[Chart/Addendum] Addendum added to ${appointmentId}. Type: ${addendumType}. PDF regenerated.`)

    return NextResponse.json({
      success: true,
      addendum: newAddendum,
      chart_status: 'amended',
      pdf_url: pdfUrl || null,
      total_addendums: (allAddendums || []).length,
    })
  } catch (err: any) {
    console.error('[Chart/Addendum] Fatal error:', err)
    return NextResponse.json({ error: err.message || 'Failed to add addendum' }, { status: 500 })
  }
}
