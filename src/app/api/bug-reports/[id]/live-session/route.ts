import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { dailyService } from '@/lib/daily'

// Lazy initialization to avoid build-time errors
let supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return supabaseAdmin
}

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST - Create a live support session
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { requested_by } = body // 'admin' or 'doctor'

    if (!requested_by || !['admin', 'doctor'].includes(requested_by)) {
      return NextResponse.json(
        { error: 'requested_by must be "admin" or "doctor"' },
        { status: 400 }
      )
    }

    // Get the bug report
    const { data: bugReport, error: fetchError } = await getSupabaseAdmin()
      .from('bug_reports')
      .select(`
        *,
        doctors:doctor_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !bugReport) {
      console.error('Error fetching bug report:', fetchError)
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }

    // Check if there's already an active session
    if (bugReport.live_session_status === 'active' && bugReport.live_session_room_url) {
      return NextResponse.json({
        success: true,
        room_url: bugReport.live_session_room_url,
        status: 'active',
        message: 'Session already active',
      })
    }

    // Create a Daily.co room for the support session
    const roomName = `bug-support-${id.slice(0, 8)}-${Date.now()}`
    
    const room = await dailyService.createRoom({
      name: roomName,
      privacy: 'public', // Public so both parties can join without tokens
      properties: {
        enable_screenshare: true,
        enable_chat: true,
        enable_prejoin_ui: true,
        enable_recording: false, // Disable cloud recording (requires paid plan)
        start_audio_off: false,
        start_video_off: false,
      },
    })

    // Update the bug report with session info
    const { data: updatedReport, error: updateError } = await getSupabaseAdmin()
      .from('bug_reports')
      .update({
        live_session_status: 'requested',
        live_session_room_url: room.url,
        live_session_requested_by: requested_by,
        live_session_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating bug report with session info:', updateError)
      // Try to clean up the room
      try {
        await dailyService.deleteRoom(roomName)
      } catch (cleanupError) {
        console.error('Error cleaning up Daily room:', cleanupError)
      }
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      room_url: room.url,
      room_name: roomName,
      status: 'requested',
      bug_report: updatedReport,
    })

  } catch (error: any) {
    console.error('Live session POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update session status (join, end)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { action } = body // 'join' or 'end'

    if (!action || !['join', 'end'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "join" or "end"' },
        { status: 400 }
      )
    }

    // Get the bug report
    const { data: bugReport, error: fetchError } = await getSupabaseAdmin()
      .from('bug_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !bugReport) {
      console.error('Error fetching bug report:', fetchError)
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }

    let updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (action === 'join') {
      updateData.live_session_status = 'active'
    } else if (action === 'end') {
      updateData.live_session_status = 'completed'
      
      // Optionally delete the Daily room to clean up
      if (bugReport.live_session_room_url) {
        try {
          const roomName = bugReport.live_session_room_url.split('/').pop()
          if (roomName) {
            await dailyService.deleteRoom(roomName)
          }
        } catch (cleanupError) {
          console.error('Error cleaning up Daily room:', cleanupError)
          // Don't fail the request if cleanup fails
        }
      }
    }

    const { data: updatedReport, error: updateError } = await getSupabaseAdmin()
      .from('bug_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating session status:', updateError)
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      status: updateData.live_session_status,
      bug_report: updatedReport,
    })

  } catch (error: any) {
    console.error('Live session PATCH error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
