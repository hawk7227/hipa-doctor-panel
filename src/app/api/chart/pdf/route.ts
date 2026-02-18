// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateClinicalNotePDF } from '@/lib/generateClinicalNotePDF'
import type { ClinicalNotePDFInput, SOAPNotes } from '@/lib/generateClinicalNotePDF'

// ═══════════════════════════════════════════════════════════════
// /api/chart/pdf
//
// GET  ?appointment_id=xxx           → Stream PDF (view in browser)
// GET  ?appointment_id=xxx&download  → Download PDF
// POST { appointmentId, action }     → Generate + email/sms/share
//
// Zero auth — uses service role key. Behind login page.
// ═══════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── HELPER: Build PDF from appointment data ──────────────────
async function buildPDFForAppointment(appointmentId: string): Promise<{
  pdfBytes: Uint8Array
  patientName: string
  patientEmail: string
  patientPhone: string
  pdfInput: ClinicalNotePDFInput
}> {
  const { data: appointment, error: fetchErr } = await supabaseAdmin
    .from('appointments')
    .select(`
      id, chart_status, is_locked, chart_signed_at, chart_signed_by,
      chart_closed_at, chart_closed_by, clinical_note_pdf_url,
      doctor_id, patient_id,
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
    throw new Error('Appointment not found')
  }

  const patient = Array.isArray(appointment.patients) ? appointment.patients[0] : appointment.patients
  const doctor = Array.isArray(appointment.doctors) ? appointment.doctors[0] : appointment.doctors

  const patientName = patient?.full_name || appointment.patient_name || 'Unknown Patient'
  const patientEmail = patient?.email || appointment.patient_email || ''
  const patientPhone = patient?.phone || appointment.patient_phone || ''
  const patientDOB = patient?.date_of_birth || appointment.patient_dob || ''
  const patientAddress = patient
    ? [patient.address_line1, patient.city, patient.state, patient.zip_code].filter(Boolean).join(', ')
    : ''

  const providerFullName = doctor?.full_name || appointment.chart_signed_by || 'Provider'
  const providerCredentials = doctor?.credentials || 'MD'
  const providerEmail = doctor?.email || ''
  const providerNPI = doctor?.npi_number || ''
  const providerLicenseState = doctor?.license_state || 'Florida'
  const providerLicenseNumber = doctor?.license_number || ''

  let soapNotes: SOAPNotes = {}
  if (appointment.soap_notes) {
    if (typeof appointment.soap_notes === 'string') {
      try { soapNotes = JSON.parse(appointment.soap_notes) } catch { soapNotes = { assessment: appointment.soap_notes } }
    } else {
      soapNotes = appointment.soap_notes as SOAPNotes
    }
  }

  const { data: addendums } = await supabaseAdmin
    .from('chart_addendums')
    .select('id, addendum_type, text, reason, created_by_name, created_by_role, cosigned_by_name, cosigned_at, created_at')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true })

  const dateOfService = appointment.scheduled_time
    ? new Date(appointment.scheduled_time).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const signedAtFormatted = appointment.chart_signed_at
    ? new Date(appointment.chart_signed_at).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : ''

  const closedAtFormatted = appointment.chart_closed_at
    ? new Date(appointment.chart_closed_at).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : ''

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

  const pdfBytes = await generateClinicalNotePDF(pdfInput)

  return { pdfBytes, patientName, patientEmail, patientPhone, pdfInput }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/chart/pdf?appointment_id=xxx[&download]
// Returns the PDF for viewing or downloading
// ═══════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const appointmentId = req.nextUrl.searchParams.get('appointment_id')
    const isDownload = req.nextUrl.searchParams.has('download')

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointment_id is required' }, { status: 400 })
    }

    // Check if a stored PDF URL exists
    const { data: appointment } = await supabaseAdmin
      .from('appointments')
      .select('clinical_note_pdf_url, chart_status, patient_name')
      .eq('id', appointmentId)
      .single()

    let pdfBytes: Uint8Array | null = null
    let fileName = `clinical-note-${appointmentId}.pdf`

    // Try to fetch stored PDF from Supabase Storage
    if (appointment?.clinical_note_pdf_url && appointment.clinical_note_pdf_url.includes('clinical-notes/')) {
      const urlParts = appointment.clinical_note_pdf_url.split('clinical-notes/')
      const storagePath = urlParts[urlParts.length - 1]?.split('?')[0]

      if (storagePath) {
        const { data: fileData, error: downloadErr } = await supabaseAdmin.storage
          .from('clinical-notes')
          .download(storagePath)

        if (!downloadErr && fileData) {
          const arrayBuffer = await fileData.arrayBuffer()
          pdfBytes = new Uint8Array(arrayBuffer)
          fileName = `clinical-note-${(appointment.patient_name || appointmentId).replace(/\s+/g, '-')}.pdf`
          console.log(`[Chart/PDF] Serving stored PDF: ${storagePath} (${pdfBytes.length} bytes)`)
        }
      }
    }

    // No stored PDF — generate on-the-fly
    if (!pdfBytes) {
      console.log(`[Chart/PDF] No stored PDF for ${appointmentId}, generating on-the-fly...`)
      const result = await buildPDFForAppointment(appointmentId)
      pdfBytes = result.pdfBytes
      fileName = `clinical-note-${result.patientName.replace(/\s+/g, '-')}.pdf`
    }

    const disposition = isDownload ? 'attachment' : 'inline'
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${fileName}"`,
        'Content-Length': pdfBytes.length.toString(),
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (err: any) {
    console.error('[Chart/PDF] GET error:', err)
    return NextResponse.json({ error: err.message || 'Failed to get PDF' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/chart/pdf
// Actions: generate, email, sms, share (get signed URL)
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { appointmentId, action } = body

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }

    // Generate PDF
    const { pdfBytes, patientName, patientEmail, patientPhone, pdfInput } = await buildPDFForAppointment(appointmentId)

    // Upload to storage
    const storageFileName = `${appointmentId}/${Date.now()}-clinical-note.pdf`
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('clinical-notes')
      .upload(storageFileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.error('[Chart/PDF] Upload error:', uploadErr)
    }

    // Get signed URL (24h for sharing)
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from('clinical-notes')
      .createSignedUrl(storageFileName, 60 * 60 * 24)

    const pdfUrl = signedUrlData?.signedUrl || ''

    // Update appointment with long-lived PDF URL
    const { data: longUrl } = await supabaseAdmin.storage
      .from('clinical-notes')
      .createSignedUrl(storageFileName, 60 * 60 * 24 * 365)

    if (longUrl?.signedUrl) {
      await supabaseAdmin
        .from('appointments')
        .update({ clinical_note_pdf_url: longUrl.signedUrl })
        .eq('id', appointmentId)
    }

    // ── Email action ──
    if (action === 'email' && patientEmail) {
      try {
        await fetch(`${req.nextUrl.origin}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: patientEmail,
            subject: `Clinical Note — ${pdfInput.appointment.date_of_service}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #0d9488;">Medazon Health — Clinical Note</h2>
                <p>Dear ${patientName},</p>
                <p>Your clinical note from your visit on <strong>${pdfInput.appointment.date_of_service}</strong> is ready.</p>
                <p>Provider: <strong>${pdfInput.provider.full_name}, ${pdfInput.provider.credentials}</strong></p>
                <p><a href="${pdfUrl}" style="display: inline-block; padding: 12px 24px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">View Clinical Note (PDF)</a></p>
                <p style="color: #666; font-size: 12px;">This link expires in 24 hours. Contact us if you need a new link.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                <p style="color: #999; font-size: 11px;">Medazon Health — Virtual Urgent Care<br/>This is a confidential medical document.</p>
              </div>
            `,
          }),
        })
        console.log(`[Chart/PDF] Email sent to ${patientEmail}`)
      } catch (emailErr) {
        console.error('[Chart/PDF] Email send error:', emailErr)
      }
    }

    // ── SMS action ──
    if (action === 'sms' && patientPhone) {
      try {
        await fetch(`${req.nextUrl.origin}/api/send-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: patientPhone,
            message: `Medazon Health: Your clinical note from ${pdfInput.appointment.date_of_service} is ready. View here: ${pdfUrl}`,
          }),
        })
        console.log(`[Chart/PDF] SMS sent to ${patientPhone}`)
      } catch (smsErr) {
        console.error('[Chart/PDF] SMS send error:', smsErr)
      }
    }

    // Audit log (non-critical)
    try {
      await supabaseAdmin.from('chart_audit_log').insert({
        appointment_id: appointmentId,
        action: action === 'email' ? 'pdf_emailed' : action === 'sms' ? 'pdf_smsed' : 'pdf_generated',
        performed_by_name: body.providerName || 'System',
        performed_by_role: body.providerRole || 'system',
        details: {
          action: action || 'generate',
          pdf_size: pdfBytes.length,
          pdf_url: pdfUrl,
          sent_to: action === 'email' ? patientEmail : action === 'sms' ? patientPhone : null,
        },
      })
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      pdf_url: pdfUrl,
      pdf_size: pdfBytes.length,
      patient_name: patientName,
      patient_email: patientEmail,
      patient_phone: patientPhone,
      action_result: action || 'generated',
    })
  } catch (err: any) {
    console.error('[Chart/PDF] POST error:', err)
    return NextResponse.json({ error: err.message || 'Failed to process PDF' }, { status: 500 })
  }
}
