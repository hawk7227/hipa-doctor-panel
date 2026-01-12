'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Video, Play, GripVertical, Clock, X } from 'lucide-react'
import { ZoomMtg } from "@zoom/meetingsdk";

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

type FloatingWindowProps = {
  title?: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  initialPosition?: { x: number; y: number }
  initialSize?: { width: number; height: number }
  minWidth?: number
  minHeight?: number
}

export function FloatingWindow({
  title = 'Window',
  open,
  onClose,
  children,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 1000, height: 800 },
  minWidth = 360,
  minHeight = 240
}: FloatingWindowProps) {
  const [position, setPosition] = useState(initialPosition)
  const [size, setSize] = useState(initialSize)
  const [minimized, setMinimized] = useState(false)

  const posRef = useRef(position)
  const sizeRef = useRef(size)

  useEffect(() => {
    posRef.current = position
  }, [position])

  useEffect(() => {
    sizeRef.current = size
  }, [size])

  // ✅ Fixed drag logic (no invalid "!<" operator, keeps window in viewport)
  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    const startPos = posRef.current

    const onMove = (ev: MouseEvent) => {
      const nextX = startPos.x + (ev.clientX - startX)
      const nextY = startPos.y + (ev.clientY - startY)

      const maxX = window.innerWidth - 80 // keep some visible area
      const maxY = window.innerHeight - 60

      setPosition({
        x: Math.min(Math.max(0, nextX), Math.max(0, maxX)),
        y: Math.min(Math.max(0, nextY), Math.max(0, maxY))
      })
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return

    const startX = e.clientX
    const startY = e.clientY
    const startSize = sizeRef.current

    const onMove = (ev: MouseEvent) => {
      setSize({
        width: Math.max(minWidth, startSize.width + ev.clientX - startX),
        height: Math.max(minHeight, startSize.height + ev.clientY - startY)
      })
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute bg-black rounded-xl shadow-xl border border-white/10 pointer-events-auto"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: minimized ? 44 : size.height
        }}
      >
        <div
          className="flex items-center justify-between px-3 h-11 bg-slate-900 rounded-t-xl cursor-move select-none"
          onMouseDown={startDrag}
        >
          <span className="text-sm text-white font-medium">{title}</span>
          <div className="flex gap-2">
            <button className="text-white text-sm px-2" onClick={() => setMinimized(v => !v)}>
              {minimized ? '▢' : '—'}
            </button>
            <button className="text-white text-sm px-2" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {!minimized && <div className="w-full h-[calc(100%-44px)] bg-black overflow-hidden">{children}</div>}

        {!minimized && (
          <div className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize" onMouseDown={startResize} />
        )}
      </div>
    </div>
  )
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

  // Window state
  const [openZoomModal, setOpenZoomModal] = useState(false)

  // ✅ Zoom join URL
  const zoomWebClientUrl = useMemo(() => {
    if (!appointment?.zoom_meeting_id) return null
    const mid = appointment.zoom_meeting_id.trim()
    const pwd = appointment.zoom_meeting_password?.trim() ?? ''

    if (appointment.zoom_start_url) return appointment.zoom_start_url
    return `https://zoom.us/wc/${encodeURIComponent(mid)}/join?pwd=${encodeURIComponent(pwd)}`
  }, [appointment?.zoom_meeting_id, appointment?.zoom_meeting_password, appointment?.zoom_start_url])

  // Check if meeting has started (or is near start)
  const checkMeetingStatus = useCallback(() => {
    if (!appointment?.requested_date_time) return false
    const meetingTime = new Date(appointment.requested_date_time)
    const now = new Date()
    const timeDiff = meetingTime.getTime() - now.getTime()
    return Math.abs(timeDiff) < 5 * 60 * 1000 || now >= meetingTime
  }, [appointment?.requested_date_time])

  const closeZoomModal = useCallback(() => setOpenZoomModal(false), [])

  const handleStartMeeting = () => {
    if (!appointment?.zoom_meeting_id) {
      alert('Meeting ID is not available yet.')
      return
    }
    if (!zoomWebClientUrl) {
      alert('Zoom meeting link is not available.')
      return
    }
    setOpenZoomModal(true)
  }

  // ✅ Fetch recording info
  const fetchRecordingInfo = useCallback(async () => {
    if (!appointment?.id) {
      console.log('⚠️ Cannot fetch recording: No appointment ID')
      return
    }

    setRecordingLoading(true)
    setRecordingStatus('')

    try {
      const response = await fetch(`/api/appointments/recordings?appointmentId=${appointment.id}`)
      const data = await response.json()

      if (data.success) {
        if (data.recordingUrl) {
          setRecordingUrl(data.recordingUrl)
          setRecordingStatus('Recording available')
        } else {
          const statusMessage = data.message || 'Meeting has not started yet'
          setRecordingStatus(statusMessage)
          setRecordingUrl(null)
        }
      } else {
        const errorMessage = data.message || data.error || 'Meeting has not started yet'
        setRecordingStatus(errorMessage)
        setRecordingUrl(null)
      }
    } catch (err) {
      console.error('Error fetching recording info:', err)
      setRecordingStatus('Error checking recording status.')
      setRecordingUrl(null)
    } finally {
      setRecordingLoading(false)
    }
  }, [appointment?.id])

  // Countdown timer
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
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeRemaining({ days, hours, minutes, seconds, isPast: false })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [appointment?.requested_date_time])

  // Fetch recording info on mount if meeting has ended
  useEffect(() => {
    if (appointment?.zoom_meeting_id && !checkMeetingStatus()) {
      fetchRecordingInfo()
    }
  }, [appointment?.zoom_meeting_id, checkMeetingStatus, fetchRecordingInfo])

  // ESC closes window
  useEffect(() => {
    if (!openZoomModal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeZoomModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openZoomModal, closeZoomModal])

  const formatCountdown = () => {
    if (!timeRemaining) return null
    if (timeRemaining.isPast) return 'Meeting has started'

    const parts: string[] = []
    if (timeRemaining.days > 0) parts.push(`${timeRemaining.days}d`)
    if (timeRemaining.hours > 0 || timeRemaining.days > 0) parts.push(`${timeRemaining.hours}h`)
    if (timeRemaining.minutes > 0 || timeRemaining.hours > 0 || timeRemaining.days > 0)
      parts.push(`${timeRemaining.minutes}m`)
    parts.push(`${timeRemaining.seconds}s`)
    return parts.join(' ')
  }

  return (
    <div key={sectionId} {...sectionProps} className="relative">
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
            <div className="text-2xl font-bold text-cyan-400 font-mono">{formatCountdown()}</div>
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
          {appointment?.zoom_meeting_id ? (
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleStartMeeting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Video className="h-4 w-4" />
                <span>Start Meeting</span>
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-400">Meeting link will be available after appointment is accepted.</div>
          )}
        </div>

        {/* ✅ Floating resizable window with iframe */}
        <FloatingWindow
          open={openZoomModal && !!zoomWebClientUrl}
          onClose={closeZoomModal}
          title="Zoom Meeting"
          initialPosition={{ x: 80, y: 60 }}
          initialSize={{ width: 1000, height: 600 }}
        >
          <div className="relative w-full h-full">
            <button
              onClick={closeZoomModal}
              className="absolute top-3 right-3 z-50 inline-flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700"
            >
              <X className="h-4 w-4" />
              Close
            </button>

            <iframe
              // You can switch between start_url or join_url:
              // src={appointment?.zoom_start_url ?? ''}
              src={appointment?.zoom_start_url ?? ''}
              className="w-full h-full border-0"
              allow="camera; microphone; fullscreen"
              allowFullScreen
            />
          </div>
        </FloatingWindow>

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