// ============================================================================
// BUGSY API — Live Session (Daily.co)
// Route: /api/bugsy/admin/reports/[id]/live-session
// POST: Create session, PATCH: Join/End session
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dailyService } from '@/lib/daily';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// POST — Create a live support session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { requested_by } = body; // 'admin' or 'doctor'

    if (!requested_by || !['admin', 'doctor'].includes(requested_by)) {
      return NextResponse.json(
        { success: false, error: 'requested_by must be "admin" or "doctor"' },
        { status: 400 }
      );
    }

    // Get the bug report
    const { data: bugReport, error: fetchError } = await supabaseAdmin
      .from('bug_reports')
      .select('*, doctors:doctor_id ( id, first_name, last_name, email )')
      .eq('id', id)
      .single();

    if (fetchError || !bugReport) {
      console.error('Error fetching bug report:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Bug report not found' },
        { status: 404 }
      );
    }

    // Check if there's already an active session
    if (bugReport.live_session_status === 'active' && bugReport.live_session_room_url) {
      return NextResponse.json({
        success: true,
        room_url: bugReport.live_session_room_url,
        status: 'active',
        message: 'Session already active',
      });
    }

    // Create a Daily.co room for the support session
    const roomName = `bug-support-${id.slice(0, 8)}-${Date.now()}`;

    const room = await dailyService.createRoom({
      name: roomName,
      privacy: 'public',
      properties: {
        enable_screenshare: true,
        enable_chat: true,
        enable_prejoin_ui: true,
        enable_recording: 'cloud',
        start_audio_off: false,
        start_video_off: false,
      },
    });

    // Update the bug report with session info
    const { data: updatedReport, error: updateError } = await supabaseAdmin
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
      .single();

    if (updateError) {
      console.error('Error updating bug report with session info:', updateError);
      // Try to clean up the room
      try { await dailyService.deleteRoom(roomName); } catch {}
      return NextResponse.json(
        { success: false, error: 'Failed to create session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      room_url: room.url,
      room_name: roomName,
      status: 'requested',
      bug_report: updatedReport,
    });

  } catch (error: any) {
    console.error('Live session POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH — Update session status (join, end)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body; // 'join' or 'end'

    if (!action || !['join', 'end'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be "join" or "end"' },
        { status: 400 }
      );
    }

    // Get the bug report
    const { data: bugReport, error: fetchError } = await supabaseAdmin
      .from('bug_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !bugReport) {
      return NextResponse.json(
        { success: false, error: 'Bug report not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (action === 'join') {
      updateData.live_session_status = 'active';
    } else if (action === 'end') {
      updateData.live_session_status = 'completed';

      // Clean up Daily room
      if (bugReport.live_session_room_url) {
        try {
          const roomName = bugReport.live_session_room_url.split('/').pop();
          if (roomName) await dailyService.deleteRoom(roomName);
        } catch (cleanupError) {
          console.error('Error cleaning up Daily room:', cleanupError);
        }
      }
    }

    const { data: updatedReport, error: updateError } = await supabaseAdmin
      .from('bug_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to update session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: updateData.live_session_status,
      bug_report: updatedReport,
    });

  } catch (error: any) {
    console.error('Live session PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

