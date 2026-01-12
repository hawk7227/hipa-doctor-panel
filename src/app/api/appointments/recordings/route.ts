import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { zoomService, ZoomRecordingFile } from '@/lib/zoom'

export async function GET(request: NextRequest) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📹 STEP 1: Get appointment recordings API called')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  try {
    const { searchParams } = new URL(request.url)
    const appointmentId = searchParams.get('appointmentId')
    
    console.log('📋 STEP 2: Parsing request parameters')
    console.log('   └─ Appointment ID:', appointmentId)
    
    if (!appointmentId) {
      console.error('❌ STEP 2 FAILED: Missing appointment ID')
      return NextResponse.json(
        { error: 'Appointment ID is required' },
        { status: 400 }
      )
    }
    
    console.log('✅ STEP 2 COMPLETE: Request parameters parsed successfully')
    
    console.log('📋 STEP 3: Fetching appointment from database')
    console.log('   └─ Querying appointments table for ID:', appointmentId)
    
    // Get appointment details - check for both zoom_meeting_id and calendly_event_uuid
    // Try to select transcription column, but handle gracefully if it doesn't exist yet
    let appointment: any = null
    let appointmentError: any = null
    
    try {
      const result = await supabase
        .from('appointments')
        .select('id, zoom_meeting_id, calendly_event_uuid, recording_url, transcription')
        .eq('id', appointmentId)
        .single()
      
      appointment = result.data
      appointmentError = result.error
    } catch (err: any) {
      // If transcription column doesn't exist, try without it
      if (err.message && err.message.includes('transcription')) {
        console.log('⚠️ Transcription column not found, fetching without it (will add column later)')
        const result = await supabase
          .from('appointments')
          .select('id, zoom_meeting_id, calendly_event_uuid, recording_url')
          .eq('id', appointmentId)
          .single()
        
        appointment = result.data
        appointmentError = result.error
        // Set transcription to null if column doesn't exist
        if (appointment) {
          appointment.transcription = null
        }
      } else {
        appointmentError = err
      }
    }
    
    if (appointmentError) {
      console.error('❌ STEP 3 FAILED: Database error fetching appointment')
      console.error('   └─ Error:', appointmentError.message)
      return NextResponse.json(
        { error: `Database error: ${appointmentError.message}` },
        { status: 500 }
      )
    }
    
    if (!appointment) {
      console.error('❌ STEP 3 FAILED: Appointment not found')
      console.error('   └─ Appointment ID:', appointmentId)
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }
    
    // Determine which meeting ID to use (prefer zoom_meeting_id for new appointments)
    const meetingId = appointment.zoom_meeting_id || appointment.calendly_event_uuid
    
    console.log('✅ STEP 3 COMPLETE: Appointment found in database')
    console.log('   └─ Appointment ID:', appointment.id)
    console.log('   └─ Has zoom_meeting_id:', !!appointment.zoom_meeting_id, appointment.zoom_meeting_id || 'N/A')
    console.log('   └─ Has calendly_event_uuid:', !!appointment.calendly_event_uuid, appointment.calendly_event_uuid || 'N/A')
    console.log('   └─ Selected Meeting ID:', meetingId || 'NONE')
    console.log('   └─ Has recording_url:', !!appointment.recording_url)
    console.log('   └─ Has transcription:', !!appointment.transcription)
    
    console.log('📋 STEP 4: Checking if recording/transcription already cached')
    if (appointment.recording_url && appointment.transcription) {
      console.log('✅ STEP 4 COMPLETE: Recording and transcription already exist in database (cached)')
      console.log('   └─ Returning cached data')
      return NextResponse.json({
        success: true,
        recordingUrl: appointment.recording_url,
        transcription: appointment.transcription,
        cached: true
      })
    }
    console.log('   └─ No cached data found, proceeding to fetch from Zoom')
    
    console.log('📋 STEP 5: Validating meeting ID')
    if (!meetingId) {
      console.log('⚠️ STEP 5 FAILED: No Zoom meeting ID found')
      console.log('   └─ Cannot fetch recordings without meeting ID')
      return NextResponse.json({
        success: true,
        recordingUrl: null,
        message: 'No Zoom meeting found for this appointment'
      })
    }
    console.log('✅ STEP 5 COMPLETE: Meeting ID validated:', meetingId)
    
    console.log('📋 STEP 6: Checking Zoom API credentials')
    if (!process.env.ZOOM_API_KEY || !process.env.ZOOM_API_SECRET || !process.env.ZOOM_ACCOUNT_ID) {
      console.warn('⚠️ STEP 6 FAILED: Zoom API credentials not configured')
      return NextResponse.json({
        success: true,
        recordingUrl: null,
        message: 'Zoom API not configured'
      })
    }
    console.log('✅ STEP 6 COMPLETE: Zoom API credentials configured')
    
    console.log('📋 STEP 7: Fetching recordings from Zoom API')
    console.log('   └─ Meeting ID:', meetingId)
    console.log('   └─ Calling zoomService.getMeetingRecordings()')
    try {
      const recordings = await zoomService.getMeetingRecordings(meetingId)
      console.log('✅ STEP 7 COMPLETE: Successfully retrieved recordings from Zoom API')
      
      console.log('📋 STEP 8: Processing recording files')
      console.log('   └─ Total files received:', recordings.recording_files?.length || 0)
      
      if (recordings.recording_files && recordings.recording_files.length > 0) {
        // Log all recording files for debugging
        console.log('📋 STEP 8.1: Analyzing all recording files')
        recordings.recording_files.forEach((file: ZoomRecordingFile, index: number) => {
          console.log(`   └─ File ${index + 1}:`, {
            id: file.id,
            recording_type: file.recording_type,
            file_type: file.file_type,
            file_extension: file.file_extension,
            file_size: file.file_size,
            status: file.status,
            has_play_url: !!file.play_url,
            has_download_url: !!file.download_url
          })
        })
        
        console.log('📋 STEP 8.2: Finding main recording file')
        // Find the main recording (usually the first one or the one with 'shared_screen_with_speaker_view')
        const mainRecording = recordings.recording_files.find((file: ZoomRecordingFile) => 
          file.recording_type === 'shared_screen_with_speaker_view' || 
          file.recording_type === 'active_speaker'
        ) || recordings.recording_files[0]
        
        const recordingUrl = mainRecording.play_url || mainRecording.download_url
        
        console.log('✅ STEP 8.2 COMPLETE: Main recording identified')
        console.log('   └─ Recording type:', mainRecording.recording_type)
        console.log('   └─ File size:', mainRecording.file_size, 'bytes')
        console.log('   └─ Has play URL:', !!mainRecording.play_url)
        console.log('   └─ Has download URL:', !!mainRecording.download_url)
        console.log('   └─ Recording URL:', recordingUrl?.substring(0, 100) + '...')
        
        console.log('📋 STEP 8.3: Finding transcription files')
        // Find transcription files (TRANSCRIPT or TRANSCRIPT_VTT)
        const transcriptionFiles = recordings.recording_files.filter((file: ZoomRecordingFile) => 
          file.file_type === 'TRANSCRIPT' || 
          file.file_type === 'TRANSCRIPT_VTT' ||
          file.file_extension === 'vtt' ||
          file.file_extension === 'txt'
        )
        
        console.log('✅ STEP 8.3 COMPLETE: Transcription files identified')
        console.log('   └─ Transcription files count:', transcriptionFiles.length)
        console.log('   └─ Total files:', recordings.recording_files.length)
        
        if (transcriptionFiles.length > 0) {
          console.log('📝 STEP 8.3.1: Transcription files details:')
          transcriptionFiles.forEach((f: ZoomRecordingFile, index: number) => {
            console.log(`   └─ Transcription ${index + 1}:`, {
              file_type: f.file_type,
              file_extension: f.file_extension,
              file_size: f.file_size,
              has_download_url: !!f.download_url
            })
          })
        } else {
          const availableTypes = [...new Set(recordings.recording_files.map((f: ZoomRecordingFile) => f.file_type))]
          console.log('⚠️ STEP 8.3.1: No transcription files found')
          console.log('   └─ Available file types:', availableTypes)
        }
        
        console.log('📋 STEP 9: Downloading transcription file')
        console.log('   └─ Transcription files available:', transcriptionFiles.length)
        console.log('   └─ Current transcription in DB:', appointment.transcription ? 'Exists (' + appointment.transcription.length + ' chars)' : 'Empty/Null')
        
        // Download and process transcription if available
        // Always fetch transcription if it's empty/null, even if we have recording URL
        let transcriptionData = null
        const needsTranscription = !appointment.transcription || appointment.transcription.trim() === ''
        
        if (transcriptionFiles.length > 0 && needsTranscription) {
          console.log('   └─ Transcription needed: YES (empty or null)')
          try {
            // Prefer VTT format, then TXT, then any transcription file
            const transcriptionFile = transcriptionFiles.find(f => f.file_extension === 'vtt') ||
                                     transcriptionFiles.find(f => f.file_extension === 'txt') ||
                                     transcriptionFiles[0]
            
            console.log('📋 STEP 9.1: Selected transcription file for download')
            console.log('   └─ File type:', transcriptionFile.file_type)
            console.log('   └─ File extension:', transcriptionFile.file_extension)
            console.log('   └─ File size:', transcriptionFile.file_size, 'bytes')
            console.log('   └─ Download URL:', transcriptionFile.download_url ? 'Available' : 'Missing')
            
            if (transcriptionFile.download_url) {
              console.log('📋 STEP 9.2: Initiating transcription download')
              console.log('   └─ URL:', transcriptionFile.download_url.substring(0, 100) + '...')
              
              // Download transcription content - Zoom download URLs may require authentication
              // Try direct download first, if it fails, we'll log it
              try {
                const transcriptionResponse = await fetch(transcriptionFile.download_url, {
                  method: 'GET',
                  headers: {
                    'Accept': 'text/vtt, text/plain, */*'
                  }
                })
                
                console.log('📋 STEP 9.3: Transcription download response received')
                console.log('   └─ Status:', transcriptionResponse.status)
                console.log('   └─ Status text:', transcriptionResponse.statusText)
                console.log('   └─ Content type:', transcriptionResponse.headers.get('content-type'))
                
                if (transcriptionResponse.ok) {
                  transcriptionData = await transcriptionResponse.text()
                  console.log('✅ STEP 9 COMPLETE: Transcription downloaded successfully')
                  console.log('   └─ Total characters:', transcriptionData.length)
                  console.log('   └─ Total lines:', transcriptionData.split('\n').length)
                  console.log('   └─ Preview (first 300 chars):', transcriptionData.substring(0, 300).replace(/\n/g, ' '))
                  
                  // Log full transcription for debugging (truncated if too long)
                  if (transcriptionData.length < 10000) {
                    console.log('📝 STEP 9.4: Full transcription content:')
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                    console.log(transcriptionData)
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                  } else {
                    console.log('📝 STEP 9.4: Transcription preview (first 500 chars):')
                    console.log(transcriptionData.substring(0, 500))
                    console.log('📝 STEP 9.4: Transcription preview (last 500 chars):')
                    console.log(transcriptionData.substring(transcriptionData.length - 500))
                  }
                } else {
                  console.warn('⚠️ STEP 9 FAILED: Failed to download transcription')
                  console.warn('   └─ Status:', transcriptionResponse.status)
                  console.warn('   └─ Status text:', transcriptionResponse.statusText)
                  console.warn('   └─ URL:', transcriptionFile.download_url.substring(0, 100) + '...')
                }
              } catch (fetchError: any) {
                console.error('❌ STEP 9 FAILED: Error fetching transcription file')
                console.error('   └─ Error:', fetchError.message)
                console.error('   └─ URL:', transcriptionFile.download_url.substring(0, 100) + '...')
              }
            } else {
              console.warn('⚠️ STEP 9 FAILED: Transcription file has no download URL')
            }
          } catch (transcriptionError) {
            console.error('❌ STEP 9 FAILED: Error downloading transcription')
            console.error('   └─ Error:', transcriptionError)
            // Continue without transcription
          }
        } else if (appointment.transcription && appointment.transcription.trim() !== '') {
          transcriptionData = appointment.transcription
          console.log('✅ STEP 9 COMPLETE: Using existing transcription from database')
          console.log('   └─ Transcription length:', transcriptionData.length, 'characters')
        } else {
          if (transcriptionFiles.length === 0) {
            console.log('⚠️ STEP 9 SKIPPED: No transcription files available in Zoom recording')
          } else {
            console.log('⚠️ STEP 9 SKIPPED: Transcription already exists in database')
          }
        }
        
        console.log('📋 STEP 10: Preparing data for database update')
        // Prepare update data
        const updateData: any = {}
        if (recordingUrl && !appointment.recording_url) {
          updateData.recording_url = recordingUrl
          console.log('   └─ Will save recording URL')
        }
        if (transcriptionData && !appointment.transcription) {
          updateData.transcription = transcriptionData
          console.log('   └─ Will save transcription (', transcriptionData.length, 'characters)')
        }
        
        console.log('📋 STEP 11: Saving recording and transcription to database')
        // Save recording URL and transcription to database
        if (Object.keys(updateData).length > 0) {
          console.log('   └─ Update data keys:', Object.keys(updateData))
          
          // Try to update with transcription, but handle gracefully if column doesn't exist
          let updateError: any = null
          try {
            const result = await supabase
              .from('appointments')
              .update(updateData)
              .eq('id', appointmentId)
            
            updateError = result.error
          } catch (err: any) {
            // If transcription column doesn't exist, try updating without it
            if (err.message && err.message.includes('transcription') && updateData.transcription) {
              console.log('⚠️ Transcription column not found, saving without transcription (add column first)')
              const { transcription, ...dataWithoutTranscription } = updateData
              const result = await supabase
                .from('appointments')
                .update(dataWithoutTranscription)
                .eq('id', appointmentId)
              
              updateError = result.error
              console.log('⚠️ NOTE: Please run the SQL migration to add transcription column: add_transcription_column.sql')
            } else {
              updateError = err
            }
          }
          
          if (updateError) {
            console.error('❌ STEP 11 FAILED: Error saving recording/transcription')
            console.error('   └─ Error:', updateError.message)
          } else {
            console.log('✅ STEP 11 COMPLETE: Recording URL and transcription saved to database')
            console.log('   └─ Appointment ID:', appointmentId)
            if (updateData.transcription) {
              console.log('   └─ Transcription saved:', updateData.transcription.length, 'characters')
            }
          }
        } else {
          console.log('⚠️ STEP 11 SKIPPED: No new data to save')
        }
        
        console.log('📋 STEP 12: Preparing response')
        
        return NextResponse.json({
          success: true,
          recordingUrl: recordingUrl || appointment.recording_url,
          transcription: transcriptionData || appointment.transcription || null,
          recordingType: mainRecording.recording_type,
          fileSize: mainRecording.file_size,
          transcriptionFiles: transcriptionFiles.map(f => ({
            file_type: f.file_type,
            file_extension: f.file_extension,
            file_size: f.file_size,
            download_url: f.download_url
          })),
          allRecordings: recordings.recording_files
        })
      } else {
        console.log('⚠️ STEP 8 FAILED: No recordings found for meeting')
        console.log('   └─ Meeting ID:', meetingId)
        console.log('   └─ Recording files array:', recordings.recording_files?.length || 0)
        return NextResponse.json({
          success: true,
          recordingUrl: null,
          message: 'No recordings available yet. Recordings may take a few minutes to process after the meeting ends.'
        })
      }
    } catch (zoomErr: unknown) {
      const zoomError = zoomErr as Error
      console.error('❌ STEP 7 FAILED: Error fetching recordings from Zoom')
      console.error('   └─ Error:', zoomError.message)
      console.error('   └─ Stack:', zoomError.stack)
      return NextResponse.json({
        success: true,
        recordingUrl: null,
        message: 'Meeting has not started yet'
      })
    }
    
  } catch (err: unknown) {
    const error = err as Error
    console.error('❌ FATAL ERROR: Unexpected error in get recordings API')
    console.error('   └─ Error:', error.message)
    console.error('   └─ Stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Get appointment recordings API completed')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}
