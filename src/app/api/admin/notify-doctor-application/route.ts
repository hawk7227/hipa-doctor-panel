// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, name, email, interest_type, reference_number, doctor_id } = body

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@medazonhealth.com'
    const resendApiKey = process.env.RESEND_API_KEY || ''

    // If no Resend key, log and return success (non-blocking)
    if (!resendApiKey) {
      console.log('=== ADMIN NOTIFICATION (no email service configured) ===')
      console.log('Type:', type)
      console.log('Name:', name)
      console.log('Email:', email)
      console.log('Interest:', interest_type)
      console.log('Reference:', reference_number)
      console.log('Doctor ID:', doctor_id)
      console.log('========================================================')
      return NextResponse.json({ success: true, method: 'console' })
    }

    // Send via Resend
    const subject = type === 'inquiry'
      ? `New Inquiry: ${name} - ${interest_type || 'General'} (${reference_number})`
      : `New Doctor Application: ${name}`

    const htmlBody = type === 'inquiry'
      ? `
        <h2>New Inquiry Received</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Type:</strong> ${interest_type || 'General'}</p>
        <p><strong>Reference:</strong> ${reference_number}</p>
        <p>Review this inquiry in the <a href="https://doctor.medazonhealth.com/admin/dashboard">Admin Dashboard</a></p>
      `
      : `
        <h2>New Doctor Application</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Doctor ID:</strong> ${doctor_id || 'N/A'}</p>
        <p>Review and approve in the <a href="https://doctor.medazonhealth.com/admin/dashboard">Admin Dashboard</a></p>
      `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Medazon Health <notifications@medazonhealth.com>',
        to: [adminEmail],
        subject,
        html: htmlBody,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.log('Resend API error:', errText)
      return NextResponse.json({ success: true, method: 'fallback-logged' })
    }

    return NextResponse.json({ success: true, method: 'email' })
  } catch (err) {
    console.log('Notification error:', err)
    // Non-blocking — still return success
    return NextResponse.json({ success: true, method: 'error-logged' })
  }
}
