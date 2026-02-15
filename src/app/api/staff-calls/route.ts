import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST: Create or manage staff calls
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, doctorId, staffId } = body

    if (!doctorId || !staffId) return NextResponse.json({ error: 'doctorId and staffId required' }, { status: 400 })

    // Initiate a call
    if (action === 'initiate') {
      const { calleeId, callType } = body
      if (!calleeId || !callType) return NextResponse.json({ error: 'calleeId and callType required' }, { status: 400 })

      // Create Daily.co room for video calls
      let dailyRoomUrl = null
      if (callType === 'video' && process.env.DAILY_API_KEY) {
        try {
          const roomRes = await fetch('https://api.daily.co/v1/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
            body: JSON.stringify({
              name: `staff-${Date.now()}`,
              properties: { exp: Math.floor(Date.now() / 1000) + 3600, max_participants: 2, enable_chat: true }
            })
          })
          const room = await roomRes.json()
          dailyRoomUrl = room.url
        } catch (e) {
          console.error('Daily.co room creation failed:', e)
        }
      }

      const { data: call, error } = await supabaseAdmin
        .from('staff_call_log')
        .insert({
          doctor_id: doctorId,
          caller_id: staffId,
          callee_id: calleeId,
          call_type: callType,
          status: 'ringing',
          daily_room_url: dailyRoomUrl
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Notify callee
      const { data: caller } = await supabaseAdmin
        .from('practice_staff')
        .select('first_name, last_name')
        .eq('id', staffId)
        .single()

      await supabaseAdmin.from('staff_notifications').insert({
        doctor_id: doctorId,
        recipient_id: calleeId,
        type: 'call_incoming',
        title: `Incoming ${callType} call`,
        body: `${caller?.first_name || ''} ${caller?.last_name || ''} is calling you`,
        link: dailyRoomUrl || `/doctor/staff-hub?call=${call.id}`,
        reference_type: 'call',
        reference_id: call.id
      })

      return NextResponse.json({ call })
    }

    // Update call status (answer, decline, end)
    if (action === 'update_status') {
      const { callId, status: newStatus } = body
      if (!callId || !newStatus) return NextResponse.json({ error: 'callId and status required' }, { status: 400 })

      const updates: any = { status: newStatus }
      if (newStatus === 'connected') updates.connected_at = new Date().toISOString()
      if (newStatus === 'ended' || newStatus === 'missed' || newStatus === 'declined') {
        updates.ended_at = new Date().toISOString()
        // Calculate duration
        const { data: call } = await supabaseAdmin.from('staff_call_log').select('connected_at').eq('id', callId).single()
        if (call?.connected_at) {
          updates.duration_seconds = Math.round((Date.now() - new Date(call.connected_at).getTime()) / 1000)
        }
      }

      const { data: call, error } = await supabaseAdmin
        .from('staff_call_log')
        .update(updates)
        .eq('id', callId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // If missed, notify caller
      if (newStatus === 'missed') {
        await supabaseAdmin.from('staff_notifications').insert({
          doctor_id: doctorId,
          recipient_id: call.caller_id,
          type: 'call_missed',
          title: 'Missed call',
          body: 'Your call was not answered',
          reference_type: 'call',
          reference_id: callId
        })
      }

      return NextResponse.json({ call })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
