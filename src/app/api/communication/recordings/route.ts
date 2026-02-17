// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { twilioService } from '@/lib/twilio'
import { zoomService, ZoomRecordingFile } from '@/lib/zoom'
import { AxiosError } from 'axios'

/**
 * API endpoint to fetch recording links
 * GET /api/communication/recordings?callSid={callSid} - For Twilio call recordings
 * GET /api/communication/recordings?meetingId={meetingId} - For Zoom meeting recordings
 */
export async function GET(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  try {
    // Get call SID or meeting ID from query params
    const { searchParams } = new URL(request.url)
    const callSid = searchParams.get('callSid')
    const meetingId = searchParams.get('meetingId')

    if (!callSid && !meetingId) {
      return NextResponse.json({
        success: false,
        error: 'Either callSid or meetingId is required'
      }, { status: 400 })
    }

    // Authenticate user
    const cookieStore = await cookies()
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          }
        }
      }
    )

    let user = null
    if (accessToken) {
      const { data } = await supabaseClient.auth.getUser(accessToken)
      user = data?.user
    } else {
      const { data } = await supabaseClient.auth.getUser()
      user = data?.user
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Get doctor data
    const { data: doctor } = await supabase
      .from('doctors')
      .select('id')
      .eq('email', user.email!)
      .single()

    if (!doctor) {
      return NextResponse.json({
        success: false,
        error: 'Doctor not found'
      }, { status: 404 })
    }

    // Handle Twilio call recordings
    if (callSid) {
      // Verify the call belongs to this doctor
      const { data: callRecord } = await supabase
        .from('communication_history')
        .select('id, twilio_sid, recording_url')
        .eq('twilio_sid', callSid)
        .eq('doctor_id', doctor.id)
        .single()

      if (!callRecord) {
        return NextResponse.json({
          success: false,
          error: 'Call not found or access denied'
        }, { status: 404 })
      }

      // If recording URL already exists in database, return it
      if (callRecord.recording_url) {
        console.log('✅ Recording URL already cached in database')
        return NextResponse.json({
          success: true,
          recordingUrl: callRecord.recording_url,
          cached: true,
          callSid: callSid
        })
      }

      // Fetch recordings from Twilio
      console.log('📹 Fetching recordings from Twilio for call:', callSid)
      const result = await twilioService.getCallRecordings(callSid)

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error || 'Failed to fetch recordings',
          callSid: callSid
        }, { status: 404 })
      }

      // Update database with recording URL
      if (result.recordingUrl) {
        const { error: updateError } = await supabase
          .from('communication_history')
          .update({
            recording_url: result.recordingUrl,
            duration: result.duration || null
          })
          .eq('twilio_sid', callSid)
          .eq('doctor_id', doctor.id)

        if (updateError) {
          console.error('❌ Error updating recording URL:', updateError)
          // Still return the recording URL even if DB update fails
        } else {
          console.log('✅ Recording URL saved to database')
        }
      }

      return NextResponse.json({
        success: true,
        recordingUrl: result.recordingUrl,
        recordingSid: result.recordingSid,
        duration: result.duration,
        status: result.status,
        dateCreated: result.dateCreated,
        cached: false,
        callSid: callSid
      })
    }

    // Handle Zoom meeting recordings
    if (meetingId) {
      // Verify the meeting belongs to this doctor
      const { data: meetingRecord } = await supabase
        .from('communication_history')
        .select('id, meeting_id, recording_url, duration')
        .eq('meeting_id', meetingId)
        .eq('doctor_id', doctor.id)
        .single()

      if (!meetingRecord) {
        return NextResponse.json({
          success: false,
          error: 'Meeting not found or access denied'
        }, { status: 404 })
      }

      // If recording URL already exists in database, return it
      if (meetingRecord.recording_url) {
        console.log('✅ Zoom recording URL already cached in database')
        return NextResponse.json({
          success: true,
          recordingUrl: meetingRecord.recording_url,
          cached: true,
          meetingId: meetingId,
          duration: meetingRecord.duration
        })
      }

      // Fetch recordings from Zoom
      console.log('📹 Fetching recordings from Zoom for meeting:', meetingId)
      try {
        const recordingsData = await zoomService.getMeetingRecordings(meetingId)
        
        // Zoom returns an array of recording files
        // Find the best recording (preferably MP4 video, then audio)
        let recordingUrl: string | null = null
        let recordingDuration: number | null = null
        
        if (recordingsData.recording_files && recordingsData.recording_files.length > 0) {
          // Sort: prefer video (MP4), then audio (M4A)
          const sortedRecordings = recordingsData.recording_files.sort((a: ZoomRecordingFile, b: ZoomRecordingFile) => {
            const aIsVideo = a.file_type === 'MP4'
            const bIsVideo = b.file_type === 'MP4'
            if (aIsVideo && !bIsVideo) return -1
            if (!aIsVideo && bIsVideo) return 1
            return 0
          })
          
          const bestRecording = sortedRecordings[0]
          
          // Get download URL - need to get the download token first for some recordings
          if (bestRecording.download_url) {
            recordingUrl = bestRecording.download_url
          } else if (bestRecording.play_url) {
            recordingUrl = bestRecording.play_url
          }
          
          // Duration is on the recordings response level, not on individual files
          recordingDuration = recordingsData.duration || null
        }

        if (!recordingUrl) {
          return NextResponse.json({
            success: false,
            error: 'No recording files found for this meeting. Recording may still be processing.',
            meetingId: meetingId
          }, { status: 404 })
        }

        // Update database with recording URL
        const { error: updateError } = await supabase
          .from('communication_history')
          .update({
            recording_url: recordingUrl,
            duration: recordingDuration
          })
          .eq('meeting_id', meetingId)
          .eq('doctor_id', doctor.id)

        if (updateError) {
          console.error('❌ Error updating Zoom recording URL:', updateError)
          // Still return the recording URL even if DB update fails
        } else {
          console.log('✅ Zoom recording URL saved to database')
        }

        return NextResponse.json({
          success: true,
          recordingUrl: recordingUrl,
          duration: recordingDuration,
          meetingId: meetingId,
          cached: false,
          recordingCount: recordingsData.recording_files?.length || 0
        })
      } catch (zoomErr: unknown) {
        const zoomError = zoomErr as AxiosError<{ code?: number | string; message?: string; [key: string]: unknown }>
        console.error('❌ Error fetching Zoom recordings:', {
          message: zoomError.message,
          code: zoomError.response?.data?.code,
          status: zoomError.response?.status
        })
        
        // Handle specific error cases with appropriate status codes
        let statusCode = 500
        let errorMessage = zoomError.message || 'Failed to fetch Zoom recordings'
        
        // Error 3301: Recording does not exist
        if (zoomError.response?.data?.code === 3301 || zoomError.message?.includes('Recording is not available')) {
          statusCode = 404
          errorMessage = 'Recording is not available yet. This could mean:\n' +
            '1. The meeting has not ended yet\n' +
            '2. Recording is still being processed (can take 5-30 minutes after meeting ends)\n' +
            '3. Recording was not enabled for this meeting\n\n' +
            'Please wait a few minutes and try again.'
        }
        // Meeting still in progress
        else if (zoomError.message?.includes('still in progress')) {
          statusCode = 400
          errorMessage = zoomError.message
        }
        // Authentication errors
        else if (zoomError.response?.status === 401 || zoomError.response?.status === 403) {
          statusCode = zoomError.response.status
          errorMessage = 'Authentication failed. Please check your Zoom API credentials.'
        }
        
        return NextResponse.json({
          success: false,
          error: errorMessage,
          meetingId: meetingId,
          code: zoomError.response?.data?.code,
          details: zoomError.response?.data || {}
        }, { status: statusCode })
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid request'
    }, { status: 400 })
  } catch (err: unknown) {
    const error = err as Error
    console.error('❌ Error in recordings API:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch recordings'
    }, { status: 500 })
  }
}

