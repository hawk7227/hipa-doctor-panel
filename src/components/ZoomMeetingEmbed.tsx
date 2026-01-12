'use client'

import { useState, useEffect } from 'react'
import { Video, Play, GripVertical, Clock } from 'lucide-react'

interface ZoomMeetingEmbedProps {
  appointment: {
    id: string
    zoom_meeting_url: string | null
    zoom_meeting_id: string | null
    zoom_meeting_password: string | null
    zoom_start_url: string | null
    requested_date_time: string | null
    calendly_event_uuid?: string | null
    recording_url?: string | null
    transcription?: string | null
  } | null
  currentUser?: {
    email?: string
  } | null
  isCustomizeMode?: boolean
  sectionProps?: any
  sectionId?: string
}

export default function ZoomMeetingEmbed({
  appointment,
  currentUser,
  isCustomizeMode = false,
  sectionProps = {},
  sectionId = 'meeting-info'
}: ZoomMeetingEmbedProps) {
  // Recording state
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [recordingLoading, setRecordingLoading] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<string>('')
  
  // Countdown timer state
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
    isPast: boolean
  } | null>(null)

  // Calculate countdown timer
  useEffect(() => {
    if (!appointment?.requested_date_time) {
      setTimeRemaining(null)
      return
    }

    const updateTimer = () => {
      const meetingTime = new Date(appointment.requested_date_time!)
      const now = new Date()
      const diff = meetingTime.getTime() - now.getTime()
      
      if (diff <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPast: true
        })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeRemaining({
        days,
        hours,
        minutes,
        seconds,
        isPast: false
      })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [appointment?.requested_date_time])

  // Check if meeting has started
  const checkMeetingStatus = () => {
    if (!appointment?.requested_date_time) return false
    
    const meetingTime = new Date(appointment.requested_date_time)
    const now = new Date()
    const timeDiff = meetingTime.getTime() - now.getTime()
    
    // Meeting is active if it's within 5 minutes before or after start time
    return Math.abs(timeDiff) < 5 * 60 * 1000 || now >= meetingTime
  }

  // Handle start meeting - uses start_url for doctors (not join_url)
  const handleStartMeeting = () => {
    // For doctors, always use start_url (not join_url)
    // The start_url allows the doctor to start the meeting as host
    const meetingUrl = appointment?.zoom_start_url
    if (meetingUrl) {
      window.open(meetingUrl, '_blank', 'noopener,noreferrer')
    } else {
      // If start_url is not available, show an error
      alert('Start meeting link is not available. Please ensure the meeting was created properly.')
      console.error('zoom_start_url is missing for appointment:', appointment?.id)
    }
  }

  // Format countdown display
  const formatCountdown = () => {
    if (!timeRemaining) return null
    
    if (timeRemaining.isPast) {
      return 'Meeting has started'
    }

    const parts: string[] = []
    if (timeRemaining.days > 0) {
      parts.push(`${timeRemaining.days}d`)
    }
    if (timeRemaining.hours > 0 || timeRemaining.days > 0) {
      parts.push(`${timeRemaining.hours}h`)
    }
    if (timeRemaining.minutes > 0 || timeRemaining.hours > 0 || timeRemaining.days > 0) {
      parts.push(`${timeRemaining.minutes}m`)
    }
    parts.push(`${timeRemaining.seconds}s`)

    return parts.join(' ')
  }

  // Fetch recording info
  const fetchRecordingInfo = async () => {
    if (!appointment?.id) {
      console.log('⚠️ Cannot fetch recording: No appointment ID')
      return
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('👆 USER ACTION: User clicked "Check again" button to get recording')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 Frontend Step 1: User initiated recording fetch')
    console.log('   └─ Appointment ID:', appointment.id)
    console.log('   └─ Meeting ID:', appointment.zoom_meeting_id || appointment.calendly_event_uuid || 'N/A')
    console.log('   └─ Current recording URL:', appointment.recording_url || 'None')
    console.log('   └─ Current transcription:', appointment.transcription ? 'Exists' : 'None')
    
    setRecordingLoading(true)
    setRecordingStatus('')
    
    try {
      console.log('📋 Frontend Step 2: Calling API endpoint')
      console.log('   └─ URL: /api/appointments/recordings?appointmentId=' + appointment.id)
      
      const response = await fetch(`/api/appointments/recordings?appointmentId=${appointment.id}`)
      
      console.log('📋 Frontend Step 3: API response received')
      console.log('   └─ Status:', response.status)
      console.log('   └─ Status text:', response.statusText)
      
      const data = await response.json()
      
      console.log('📋 Frontend Step 4: Processing API response')
      console.log('   └─ Success:', data.success)
      console.log('   └─ Has recording URL:', !!data.recordingUrl)
      console.log('   └─ Has transcription:', !!data.transcription)
      console.log('   └─ Cached:', data.cached || false)
      
      if (data.success) {
        if (data.recordingUrl) {
          setRecordingUrl(data.recordingUrl)
          setRecordingStatus('Recording available')
          console.log('✅ Frontend Step 4 COMPLETE: Recording URL set')
          console.log('   └─ Recording URL:', data.recordingUrl.substring(0, 100) + '...')
          
          if (data.transcription) {
            console.log('✅ Transcription received:')
            console.log('   └─ Length:', data.transcription.length, 'characters')
            console.log('   └─ Preview:', data.transcription.substring(0, 200).replace(/\n/g, ' '))
          }
        } else {
          // Use the message from API, default to meeting not started message
          const statusMessage = data.message || 'Meeting has not started yet'
          setRecordingStatus(statusMessage)
          setRecordingUrl(null)
          console.log('⚠️ Frontend Step 4: No recording URL in response')
          console.log('   └─ Message:', statusMessage)
        }
      } else {
        // Use the message from API if available, otherwise default message
        const errorMessage = data.message || data.error || 'Meeting has not started yet'
        setRecordingStatus(errorMessage)
        setRecordingUrl(null)
        console.error('❌ Frontend Step 4 FAILED: API returned error')
        console.error('   └─ Error:', data.error)
        console.error('   └─ Message:', errorMessage)
      }
    } catch (err) {
      console.error('❌ Frontend FATAL ERROR: Error fetching recording info')
      console.error('   └─ Error:', err)
      setRecordingStatus('Error checking recording status.')
      setRecordingUrl(null)
    } finally {
      setRecordingLoading(false)
      console.log('📋 Frontend Step 5: Request completed')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }
  }

  // Fetch recording info on mount if meeting has ended
  useEffect(() => {
    if (appointment?.zoom_meeting_id && appointment?.requested_date_time) {
      const meetingTime = new Date(appointment.requested_date_time)
      const now = new Date()
      const timeDiff = meetingTime.getTime() - now.getTime()
      // Only fetch if meeting has ended (more than 5 minutes past start time)
      if (timeDiff < -5 * 60 * 1000) {
        fetchRecordingInfo()
      }
    }
  }, [appointment?.zoom_meeting_id, appointment?.requested_date_time])

  return (
    <div key={sectionId} {...sectionProps}>
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Video className="h-5 w-5 text-cyan-400" />
          Meeting Information
        </h3>
        
        {/* Countdown Timer */}
        {timeRemaining && appointment?.requested_date_time && (
          <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-cyan-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span className="text-sm text-gray-400">
                {timeRemaining.isPast ? 'Meeting Status:' : 'Meeting starts in:'}
              </span>
            </div>
            <div className="text-2xl font-bold text-cyan-400 font-mono">
              {formatCountdown()}
            </div>
            {!timeRemaining.isPast && (
              <div className="text-xs text-gray-400 mt-1">
                {new Date(appointment.requested_date_time).toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </div>
            )}
          </div>
        )}
        
        {/* Start Meeting Button */}
        <div className="mb-4">
          {appointment?.zoom_start_url ? (
            <div className="flex items-center gap-4 flex-wrap">
              <button 
                onClick={handleStartMeeting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Video className="h-4 w-4" />
                <span>Start Meeting</span>
              </button>
              {appointment?.zoom_meeting_id && (
                <>
                  <span className="text-sm text-gray-400">Meeting ID:</span>
                  <span className="font-bold text-white">{appointment.zoom_meeting_id}</span>
                </>
              )}
              {appointment?.zoom_meeting_password && (
                <>
                  <span className="text-sm text-gray-400">Password:</span>
                  <span className="font-bold text-white">{appointment.zoom_meeting_password}</span>
                </>
              )}
            </div>
          ) : appointment?.zoom_meeting_url ? (
            <div className="text-sm text-amber-400 bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
              ⚠️ Start meeting link is not available. The meeting was created but the start URL is missing. Please contact support or recreate the meeting.
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              Meeting link will be available after appointment is accepted.
            </div>
          )}
        </div>
        
        <hr className="border-white/10 my-4" />
        <h4 className="text-md font-bold text-white mb-2">▶ Meeting Recording</h4>
        <div className="text-sm text-gray-400 mb-3 min-h-8">
          {recordingLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Checking for recording...</span>
            </div>
          ) : recordingStatus ? (
            recordingStatus
          ) : (
            'Meeting has not started yet'
          )}
        </div>
        {recordingUrl ? (
          <div className="mb-3">
            <a
              href={recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Play className="h-4 w-4" />
              View Recording
            </a>
          </div>
        ) : null}
        <button 
          onClick={fetchRecordingInfo}
          disabled={recordingLoading || !appointment?.zoom_meeting_id}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {recordingLoading ? 'Checking...' : 'Check again'}
        </button>
      </div>
    </div>
  )
}
