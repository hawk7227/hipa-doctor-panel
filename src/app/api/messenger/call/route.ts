// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { dailyService } from '@/lib/daily'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Create or join a call room
export async function POST(request: NextRequest) {
  try {
    const { action, doctorId, doctorName, callType, targetType } = await request.json()

    if (action === 'create') {
      // Create a Daily.co room for this call
      const roomName = `msg-${callType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const room = await dailyService.createRoom({
        name: roomName,
        privacy: 'public',
        properties: {
          enable_screenshare: true,
          enable_chat: true,
          enable_recording: 'cloud',
          start_audio_off: false,
          start_video_off: callType === 'audio',
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
          eject_at_room_exp: true,
        },
      })

      // Store the active call in admin_messages as a system message
      try {
        // Find or create admin conversation
        let { data: conv } = await supabaseAdmin.from('admin_conversations').select('id').eq('doctor_id', doctorId).limit(1).single()
        if (!conv) {
          const { data: newConv } = await supabaseAdmin.from('admin_conversations').insert({ doctor_id: doctorId, doctor_name: doctorName || 'Doctor', status: 'active' }).select().single()
          conv = newConv
        }
        if (conv) {
          // Send call notification as message
          await supabaseAdmin.from('admin_messages').insert({
            conversation_id: conv.id,
            sender_type: 'doctor',
            sender_name: doctorName || 'Doctor',
            content: `📞 ${callType === 'video' ? 'Video' : 'Audio'} call started — Join: ${room.url}`,
            message_type: 'call',
            metadata: { call_type: callType, room_url: room.url, room_name: room.name, status: 'ringing' },
          })
          // Update conversation
          await supabaseAdmin.from('admin_conversations').update({
            last_message: `📞 ${callType === 'video' ? 'Video' : 'Audio'} call`,
            last_message_at: new Date().toISOString(),
            unread_count: 1,
          }).eq('id', conv.id)
        }
      } catch (e) { console.error('Failed to notify admin:', e) }

      return NextResponse.json({ success: true, room_url: room.url, room_name: room.name })
    }

    if (action === 'end') {
      const { roomName: rn } = await request.json()
      if (rn) { try { await dailyService.deleteRoom(rn) } catch {} }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e: any) {
    console.error('Messenger call error:', e)
    return NextResponse.json({ error: e.message || 'Call failed' }, { status: 500 })
  }
}
