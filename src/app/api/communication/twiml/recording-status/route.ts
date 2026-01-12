import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Webhook endpoint to receive Twilio recording status updates
 * Twilio calls this when recording is completed and provides the recording URL
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    // Twilio sends these parameters in the recording status callback
    const callSid = formData.get('CallSid')?.toString()
    const recordingUrl = formData.get('RecordingUrl')?.toString()
    const recordingStatus = formData.get('RecordingStatus')?.toString()
    const recordingSid = formData.get('RecordingSid')?.toString()
    const recordingDuration = formData.get('RecordingDuration')?.toString()

    console.log('📹 Recording status callback received:', {
      callSid,
      recordingSid,
      recordingStatus,
      recordingUrl,
      recordingDuration
    })

    // Only process if recording is completed and we have a URL
    if (recordingStatus === 'completed' && recordingUrl && callSid) {
      // Update the communication_history record with the recording URL
      const { data, error } = await supabase
        .from('communication_history')
        .update({
          recording_url: recordingUrl,
          duration: recordingDuration ? parseInt(recordingDuration) : null
        })
        .eq('twilio_sid', callSid)
        .select()

      if (error) {
        console.error('❌ Error updating recording URL:', error)
        return new NextResponse('Error updating recording', { status: 500 })
      }

      if (data && data.length > 0) {
        console.log('✅ Recording URL saved to communication history:', {
          callSid,
          recordingUrl,
          historyId: data[0].id
        })
      } else {
        console.warn('⚠️ No communication history record found for call:', callSid)
      }
    } else {
      console.log('ℹ️ Recording status:', recordingStatus, 'Not updating database')
    }

    // Always return 200 to acknowledge receipt
    return new NextResponse('OK', { status: 200 })
  } catch (error: any) {
    console.error('❌ Error processing recording status:', error)
    // Still return 200 to prevent Twilio from retrying
    return new NextResponse('Error', { status: 200 })
  }
}

// Also handle GET requests (in case Twilio sends GET)
export async function GET(request: NextRequest) {
  return POST(request)
}






















