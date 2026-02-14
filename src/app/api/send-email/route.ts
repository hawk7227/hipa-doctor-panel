import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { smtpEmailService } from '@/lib/smtp'

import { requireAuth } from '@/lib/api-auth'
export async function POST(req: NextRequest) {
  try {
   
  const auth = await requireAuth(req)
  if ('error' in auth && auth.error) return auth.error
  const request = req
 const { to, subject, html, text } = await request.json()

    // Validate required fields
    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      )
    }

    // Send email via SMTP
    const emailResult = await smtpEmailService.sendEmail({
      to,
      subject,
      html,
      text
    })

    if (!emailResult.success) {
      console.error('❌ Email sending failed:', emailResult.error)
      return NextResponse.json(
        { error: `Failed to send email: ${emailResult.error}` },
        { status: 500 }
      )
    }

    // Also create a notification in the database for the user
    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', to)
        .single()

      if (!userError && user) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type: 'appointment_confirmed',
            title: subject,
            message: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
            is_read: false
          })

        if (notificationError) {
          console.warn('Could not create notification:', notificationError.message)
        } else {
          console.log('✅ Notification created successfully for user:', user.id)
        }
      }
    } catch (notificationError) {
      console.warn('Notification creation failed:', notificationError)
      // Don't fail the email sending if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully via SMTP',
      messageId: emailResult.messageId,
      emailId: `email_${Date.now()}`
    })

  } catch (error) {
    console.error('Error in send-email API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
