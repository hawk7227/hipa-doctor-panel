import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { generateClinicalNotePDF } from '@/lib/generateClinicalNotePDF'
import type { ClinicalNotePDFInput, SOAPNotes } from '@/lib/generateClinicalNotePDF'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 30

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

    // Fetch appointment with patient and doctor data
    const { data: appointment, error: fetchErr } = await supabaseAdmin
      .from('appointments')
      .select(`
        id, chart_status, is_locked, chart_signed_at, chart_signed_by,
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
      console.error('[Chart/Close] Fetch error:', fetchErr)
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Validate: only signed → closed
    if (appointment.chart_status !== 'signed') {
      return NextResponse.json({
        error: `Cannot close chart. Current status is "${appointment.chart_status}". Only signed charts can be closed.`,
        current_status: appointment.chart_status,
      }, { status: 409 })
    }

    const now = new Date().toISOString()

    // Extract patient info (handle both direct fields and joined table)
    const patient = Array.isArray(appointment.patients) ? appointment.patients[0] : appointment.patients
    const doctor = Array.isArray(appointment.doctors) ? appointment.doctors[0] : appointment.doctors

    const patientName = patient?.full_name || appointment.patient_name || 'Unknown Patient'
    const patientEmail = patient?.email || appointment.patient_email || ''
    const patientPhone = patient?.phone || appointment.patient_phone || ''
    const patientDOB = patient?.date_of_birth || appointment.patient_dob || ''
    const patientAddress = patient
      ? [patient.address_line1, patient.city, patient.state, patient.zip_code].filter(Boolean).join(', ')
      : ''

    const providerFullName = doctor?.full_name || providerName || 'Provider'
    const providerCredentials = doctor?.credentials || 'MD'
    const providerEmail = doctor?.email || ''
    const providerNPI = doctor?.npi_number || ''
    const providerLicenseState = doctor?.license_state || 'Florida'
    const providerLicenseNumber = doctor?.license_number || ''

    // Parse SOAP notes
    let soapNotes: SOAPNotes = {}
    if (appointment.soap_notes) {
      if (typeof appointment.soap_notes === 'string') {
        try { soapNotes = JSON.parse(appointment.soap_notes) } catch { soapNotes = { assessment: appointment.soap_notes } }
      } else {
        soapNotes = appointment.soap_notes as SOAPNotes
      }
    }

    // Fetch addendums (if any exist from a previous close/reopen cycle)
    const { data: addendums } = await supabaseAdmin
      .from('chart_addendums')
      .select('id, addendum_type, text, reason, created_by_name, created_by_role, cosigned_by_name, cosigned_at, created_at')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true })

    // Build PDF input
    const dateOfService = appointment.scheduled_time
      ? new Date(appointment.scheduled_time).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const signedAtFormatted = appointment.chart_signed_at
      ? new Date(appointment.chart_signed_at).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
      : now

    const closedAtFormatted = new Date(now).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })

    const pdfInput: ClinicalNotePDFInput = {
      practice: {
        name: 'Medazon Health',
        subtitle: 'Virtual Urgent Care — Telehealth Services',
        address: 'Orlando, FL',
        phone: '(555) 123-4567',
        fax: '(555) 123-4568',
        npi: providerNPI || '1234567890',
      },
      patient: {
        full_name: patientName,
        date_of_birth: patientDOB,
        email: patientEmail,
        phone: patientPhone,
        address: patientAddress,
        gender: patient?.gender || undefined,
        chart_id: patient?.chart_id || undefined,
      },
      provider: {
        full_name: providerFullName,
        credentials: providerCredentials,
        email: providerEmail,
        npi: providerNPI,
        license_state: providerLicenseState,
        license_number: providerLicenseNumber,
      },
      appointment: {
        id: appointmentId,
        date_of_service: dateOfService,
        visit_type: appointment.visit_type || 'Video Consultation',
        signed_at: signedAtFormatted,
        closed_at: closedAtFormatted,
      },
      soap: soapNotes,
      addendums: (addendums || []).map(a => ({
        ...a,
        addendum_type: a.addendum_type || 'addendum',
        created_by_name: a.created_by_name || 'Provider',
        created_by_role: a.created_by_role || 'provider',
      })),
      doctor_notes: appointment.doctor_notes || undefined,
    }

    // Generate PDF
    console.log('[Chart/Close] Generating clinical note PDF...')
    const pdfBytes = await generateClinicalNotePDF(pdfInput)

    // Upload to Supabase Storage
    const fileName = `${appointmentId}/${Date.now()}-clinical-note.pdf`
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('clinical-notes')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.error('[Chart/Close] PDF upload error:', uploadErr)
      return NextResponse.json({ error: `PDF upload failed: ${uploadErr.message}` }, { status: 500 })
    }

    // Get signed URL (valid for 1 year)
    const { data: signedUrl } = await supabaseAdmin.storage
      .from('clinical-notes')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365)

    const pdfUrl = signedUrl?.signedUrl || `clinical-notes/${fileName}`

    // Update appointment to closed
    const { error: updateErr } = await supabaseAdmin
      .from('appointments')
      .update({
        chart_status: 'closed',
        chart_closed_at: now,
        chart_closed_by: providerName,
        clinical_note_pdf_url: pdfUrl,
        is_locked: true,
        chart_locked: true,
      })
      .eq('id', appointmentId)

    if (updateErr) {
      console.error('[Chart/Close] Update error:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Audit log
    await supabaseAdmin.from('chart_audit_log').insert([
      {
        appointment_id: appointmentId,
        action: 'closed',
        performed_by_name: providerName,
        performed_by_role: providerRole || 'provider',
        details: { closed_at: now, pdf_url: pdfUrl },
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
        user_agent: req.headers.get('user-agent') || null,
      },
      {
        appointment_id: appointmentId,
        action: 'pdf_generated',
        performed_by_name: 'System',
        performed_by_role: 'system',
        details: { file_name: fileName, file_size: pdfBytes.length, pdf_url: pdfUrl },
      },
    ])

    console.log(`[Chart/Close] Chart closed. PDF: ${fileName} (${pdfBytes.length} bytes)`)

    return NextResponse.json({
      success: true,
      chart_status: 'closed',
      closed_at: now,
      closed_by: providerName,
      pdf_url: pdfUrl,
      pdf_size: pdfBytes.length,
    })
  } catch (err: any) {
    console.error('[Chart/Close] Fatal error:', err)
    return NextResponse.json({ error: err.message || 'Failed to close chart' }, { status: 500 })
  }
}
