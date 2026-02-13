import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getStoredTokens } from '@/lib/gmail'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function getDoctorId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const sb = createClient(supabaseUrl, supabaseServiceKey)
  const { data: { user } } = await sb.auth.getUser(token)
  return user?.id || null
}

// POST /api/gmail/send
export async function POST(req: NextRequest) {
  try {
    const doctorId = await getDoctorId(req)
    if (!doctorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { to, subject, body, patientId, appointmentId, replyToMessageId, threadId } = await req.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 })
    }

    // Send via Gmail API
    const result = await sendEmail(doctorId, to, subject, body, replyToMessageId, threadId)

    // Log to communication_logs
    try {
      const tokens = await getStoredTokens(doctorId)
      const sb = createClient(supabaseUrl, supabaseServiceKey)
      await sb.from('communication_logs').insert({
        type: 'email',
        direction: 'outbound',
        from_email: tokens?.gmail_address || doctorId,
        to_email: to,
        subject,
        body,
        status: 'sent',
        patient_id: patientId || null,
        appointment_id: appointmentId || null,
        provider_id: doctorId,
        gmail_message_id: result.id,
        gmail_thread_id: result.threadId,
      })
    } catch (logErr) {
      console.error('Failed to log email to communication_logs:', logErr)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({ success: true, messageId: result.id, threadId: result.threadId })
  } catch (err: any) {
    console.error('Gmail send error:', err)
    if (err.message === 'Gmail not connected') {
      return NextResponse.json({ error: 'Gmail not connected', connected: false }, { status: 403 })
    }
    return NextResponse.json({ error: err.message || 'Failed to send email' }, { status: 500 })
  }
}
