import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Fetch conversations + messages
export async function GET(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const doctorId = searchParams.get('doctorId')
    const staffId = searchParams.get('staffId')

    if (!doctorId) return NextResponse.json({ error: 'doctorId required' }, { status: 400 })

    // List conversations for a staff member
    if (action === 'conversations') {
      if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 })

      const { data: participations } = await supabaseAdmin
        .from('staff_conversation_participants')
        .select('conversation_id, last_read_at, is_muted')
        .eq('staff_id', staffId)

      if (!participations?.length) return NextResponse.json({ conversations: [] })

      const convIds = participations.map(p => p.conversation_id)
      const { data: conversations } = await supabaseAdmin
        .from('staff_conversations')
        .select(`
          id, type, name, description, patient_id, is_archived,
          last_message_at, last_message_preview, created_at,
          staff_conversation_participants(staff_id, role, last_read_at,
            practice_staff(id, first_name, last_name, role, email, active))
        `)
        .in('id', convIds)
        .eq('doctor_id', doctorId)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      // Merge read state
      const merged = (conversations || []).map(c => {
        const myPart = participations.find(p => p.conversation_id === c.id)
        return { ...c, my_last_read_at: myPart?.last_read_at, is_muted: myPart?.is_muted }
      })

      return NextResponse.json({ conversations: merged })
    }

    // Fetch messages for a conversation
    if (action === 'messages') {
      const conversationId = searchParams.get('conversationId')
      if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

      const limit = parseInt(searchParams.get('limit') || '50')
      const before = searchParams.get('before') // cursor pagination

      let query = supabaseAdmin
        .from('staff_messages')
        .select(`
          id, conversation_id, content, message_type, reply_to_id,
          metadata, is_edited, is_deleted, created_at,
          sender:practice_staff!staff_messages_sender_id_fkey(id, first_name, last_name, role, email)
        `)
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (before) query = query.lt('created_at', before)

      const { data: messages, error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ messages: (messages || []).reverse() })
    }

    // Unread counts per conversation
    if (action === 'unread') {
      if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 })

      const { data: participations } = await supabaseAdmin
        .from('staff_conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('staff_id', staffId)

      const counts: Record<string, number> = {}
      for (const p of participations || []) {
        const { count } = await supabaseAdmin
          .from('staff_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', p.conversation_id)
          .eq('is_deleted', false)
          .gt('created_at', p.last_read_at || '1970-01-01')
          .neq('sender_id', staffId)

        counts[p.conversation_id] = count || 0
      }

      return NextResponse.json({ unreadCounts: counts })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: Create conversation, send message, mark read
export async function POST(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const { action, doctorId, staffId } = body

    if (!doctorId || !staffId) return NextResponse.json({ error: 'doctorId and staffId required' }, { status: 400 })

    // Create conversation
    if (action === 'create_conversation') {
      const { type, name, description, participantIds, patientId } = body
      if (!type || !participantIds?.length) return NextResponse.json({ error: 'type and participantIds required' }, { status: 400 })

      // For direct messages, check if conversation already exists
      if (type === 'direct' && participantIds.length === 1) {
        const otherId = participantIds[0]
        const { data: existing } = await supabaseAdmin
          .from('staff_conversations')
          .select(`id, staff_conversation_participants(staff_id)`)
          .eq('doctor_id', doctorId)
          .eq('type', 'direct')
          .eq('is_archived', false)

        const found = (existing || []).find(c => {
          const pIds = (c.staff_conversation_participants as any[]).map((p: any) => p.staff_id)
          return pIds.includes(staffId) && pIds.includes(otherId) && pIds.length === 2
        })

        if (found) return NextResponse.json({ conversation: found, existing: true })
      }

      const { data: conv, error: convErr } = await supabaseAdmin
        .from('staff_conversations')
        .insert({ doctor_id: doctorId, type, name, description, patient_id: patientId, created_by: staffId })
        .select()
        .single()

      if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })

      // Add all participants including creator
      const allParticipants = [...new Set([staffId, ...participantIds])]
      await supabaseAdmin.from('staff_conversation_participants').insert(
        allParticipants.map(id => ({
          conversation_id: conv.id,
          staff_id: id,
          role: id === staffId ? 'admin' : 'member'
        }))
      )

      // System message
      await supabaseAdmin.from('staff_messages').insert({
        conversation_id: conv.id,
        sender_id: staffId,
        content: type === 'direct' ? 'Conversation started' : `Created ${type}: ${name || 'Unnamed'}`,
        message_type: 'system'
      })

      return NextResponse.json({ conversation: conv })
    }

    // Send message
    if (action === 'send_message') {
      const { conversationId, content, messageType, replyToId, metadata } = body
      if (!conversationId || !content) return NextResponse.json({ error: 'conversationId and content required' }, { status: 400 })

      const { data: msg, error } = await supabaseAdmin
        .from('staff_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: staffId,
          content,
          message_type: messageType || 'text',
          reply_to_id: replyToId,
          metadata: metadata || {}
        })
        .select(`
          id, conversation_id, content, message_type, reply_to_id,
          metadata, is_edited, is_deleted, created_at,
          sender:practice_staff!staff_messages_sender_id_fkey(id, first_name, last_name, role, email)
        `)
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Update conversation last_message
      await supabaseAdmin.from('staff_conversations').update({
        last_message_at: msg.created_at,
        last_message_preview: content.substring(0, 100)
      }).eq('id', conversationId)

      // Create notifications for other participants
      const { data: participants } = await supabaseAdmin
        .from('staff_conversation_participants')
        .select('staff_id')
        .eq('conversation_id', conversationId)
        .neq('staff_id', staffId)

      if (participants?.length) {
        const { data: sender } = await supabaseAdmin
          .from('practice_staff')
          .select('first_name, last_name')
          .eq('id', staffId)
          .single()

        const senderName = `${sender?.first_name || ''} ${sender?.last_name || ''}`.trim()

        await supabaseAdmin.from('staff_notifications').insert(
          participants.map(p => ({
            doctor_id: doctorId,
            recipient_id: p.staff_id,
            type: 'message',
            title: `New message from ${senderName}`,
            body: content.substring(0, 200),
            link: `/doctor/staff-hub?conv=${conversationId}`,
            reference_type: 'message',
            reference_id: msg.id
          }))
        )
      }

      return NextResponse.json({ message: msg })
    }

    // Mark conversation as read
    if (action === 'mark_read') {
      const { conversationId } = body
      if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

      await supabaseAdmin
        .from('staff_conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('staff_id', staffId)

      // Mark related notifications as read
      await supabaseAdmin
        .from('staff_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('recipient_id', staffId)
        .eq('type', 'message')
        .eq('reference_type', 'message')

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
