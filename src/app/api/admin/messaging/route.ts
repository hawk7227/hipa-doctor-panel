import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: conversations, messages, doctors
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')

  try {
    if (action === 'conversations') {
      const { data, error } = await db
        .from('admin_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })

      if (error) {
        // Table might not exist yet - return empty
        console.log('admin_conversations query error:', error.message)
        return NextResponse.json({ conversations: [] })
      }
      return NextResponse.json({ conversations: data || [] })
    }

    if (action === 'messages') {
      const convId = req.nextUrl.searchParams.get('conversationId')
      if (!convId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

      const { data, error } = await db
        .from('admin_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(200)

      if (error) {
        console.log('admin_messages query error:', error.message)
        return NextResponse.json({ messages: [] })
      }
      return NextResponse.json({ messages: data || [] })
    }

    if (action === 'doctors') {
      const { data } = await db
        .from('doctors')
        .select('id, first_name, last_name, email, specialty, is_approved')
        .eq('is_approved', true)
        .order('first_name')

      return NextResponse.json({ doctors: data || [] })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: send, create_conversation, mark_read, toggle_pin
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'create_conversation') {
      const { doctorId, doctorName, doctorSpecialty } = body

      // Check for existing conversation
      const { data: existing } = await db
        .from('admin_conversations')
        .select('*')
        .eq('doctor_id', doctorId)
        .limit(1)

      if (existing?.length) {
        return NextResponse.json({ conversation: existing[0] })
      }

      const { data, error } = await db.from('admin_conversations').insert({
        doctor_id: doctorId,
        doctor_name: doctorName,
        doctor_specialty: doctorSpecialty || '',
        last_message: null,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        is_pinned: false,
        is_archived: false,
        status: 'active'
      }).select().single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Send notification to doctor
      try {
        await db.from('notifications').insert({
          recipient_id: doctorId,
          recipient_type: 'doctor',
          type: 'admin_message',
          title: 'New message from Admin',
          body: 'Admin started a new conversation with you',
          is_read: false,
          link: '/doctor/staff-hub'
        })
      } catch { /* notifications table may not exist */ }

      return NextResponse.json({ conversation: data })
    }

    if (action === 'send') {
      const { conversationId, content, senderType, senderName } = body

      const { data: msg, error } = await db.from('admin_messages').insert({
        conversation_id: conversationId,
        sender_type: senderType,
        sender_name: senderName,
        content,
        message_type: 'text',
        is_read: false
      }).select().single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Update conversation preview
      await db.from('admin_conversations').update({
        last_message: content.substring(0, 200),
        last_message_at: new Date().toISOString(),
      }).eq('id', conversationId)

      // If admin sends, update unread for doctor side; if doctor sends, update for admin side
      if (senderType === 'admin') {
        // Get doctor_id from conversation
        const { data: conv } = await db.from('admin_conversations').select('doctor_id').eq('id', conversationId).single()
        if (conv) {
          try {
            await db.from('notifications').insert({
              recipient_id: conv.doctor_id,
              recipient_type: 'doctor',
              type: 'admin_message',
              title: 'New message from Admin',
              body: content.substring(0, 100),
              is_read: false,
              link: '/doctor/staff-hub',
              metadata: { conversation_id: conversationId }
            })
          } catch { /* notifications table may not exist */ }
        }
      } else {
        // Doctor sent - increment admin unread
        await db.from('admin_conversations')
          .update({ unread_count: 1 }) // simplified - just mark as having unread
          .eq('id', conversationId)
      }

      return NextResponse.json({ message: msg })
    }

    if (action === 'mark_read') {
      const { conversationId } = body
      await db.from('admin_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'doctor')
      await db.from('admin_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId)
      return NextResponse.json({ success: true })
    }

    if (action === 'toggle_pin') {
      const { conversationId, isPinned } = body
      await db.from('admin_conversations').update({ is_pinned: isPinned }).eq('id', conversationId)
      return NextResponse.json({ success: true })
    }

    if (action === 'mark_doctor_read') {
      const { conversationId } = body
      await db.from('admin_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'admin')
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
