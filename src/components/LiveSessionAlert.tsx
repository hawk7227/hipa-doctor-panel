'use client'

// ============================================================================
// LIVE SESSION ALERT — Polls for admin session requests, shows banner + sound
// Updated for Bugsy v3 API paths
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { Phone, X, Volume2, VolumeX } from 'lucide-react'

interface LiveSessionRequest {
  id: string
  live_session_room_url: string
  live_session_requested_at: string
  description: string
}

const POLL_INTERVAL = 10000 // 10 seconds
const SOUND_STORAGE_KEY = 'bugReport_soundEnabled'

export default function LiveSessionAlert() {
  const [activeSession, setActiveSession] = useState<LiveSessionRequest | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [isPulsing, setIsPulsing] = useState(true)
  const [inCall, setInCall] = useState(false)
  const [callRoomUrl, setCallRoomUrl] = useState<string | null>(null)
  const [callReportId, setCallReportId] = useState<string | null>(null)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastCheckRef = useRef<string | null>(null)

  // Load sound preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SOUND_STORAGE_KEY)
      if (saved !== null) setSoundEnabled(saved === 'true')
    }
  }, [])

  // Save sound preference
  const toggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    localStorage.setItem(SOUND_STORAGE_KEY, String(newValue))
  }

  // Get current doctor from sessionStorage (Medazon pattern)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = sessionStorage.getItem('doctor_id')
      if (id) setDoctorId(id)
    }
  }, [])

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio()
        audioRef.current.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVgXQ47Q3rJkHwxJl9Tjt2ULDVuZ0NurYRwGP5ra16V5WBdDjtDes2QfDEmX1OO3ZQsNW5nQ26thHAY/mtrXpXlYF0OO0N6zZB8MSZfU47dlCw1bmdDbq2EcBj+a2teleVgXQ47Q3rNkHwxJl9Tjt2ULDV2gAACBhYqFbF1fdZmwrJBhNjVgodDbq2EcBj+a2teleVgXQ47Q3rNkHwxJl9Tjt2ULDVuZ0NurYRwGP5ra16V5WBdDjtDes2QfDEmX1OO3ZQsNW5nQ26thHAY/mtrXpXlYF0OO0N6zZB8MSZfU47dlCw1bmdDbq2EcBj+a2teleVgXQ47Q3rNkHwxJl9Tjt2ULDVuZ'
      }
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    } catch {}
  }, [soundEnabled])

  // Check for live session requests — uses v3 admin reports API
  const checkForSessions = useCallback(async () => {
    if (!doctorId) return

    try {
      // Fetch reports for this doctor that have a live session requested
      const response = await fetch('/api/bugsy/admin/reports')
      if (!response.ok) return

      const data = await response.json()
      const reports = data.data || []

      // Find any bug report with a live session requested by admin for THIS doctor
      const sessionRequest = reports.find((report: any) =>
        report.doctor_id === doctorId &&
        report.live_session_status === 'requested' &&
        report.live_session_requested_by === 'admin' &&
        report.live_session_room_url &&
        !dismissed.has(report.id)
      )

      if (sessionRequest) {
        if (lastCheckRef.current !== sessionRequest.id) {
          lastCheckRef.current = sessionRequest.id
          playNotificationSound()
        }
        setActiveSession({
          id: sessionRequest.id,
          live_session_room_url: sessionRequest.live_session_room_url,
          live_session_requested_at: sessionRequest.live_session_requested_at,
          description: sessionRequest.description,
        })
      } else {
        setActiveSession(null)
        lastCheckRef.current = null
      }
    } catch (error) {
      console.error('Error checking for live sessions:', error)
    }
  }, [doctorId, dismissed, playNotificationSound])

  // Poll for session requests
  useEffect(() => {
    if (!doctorId) return
    checkForSessions()
    const interval = setInterval(checkForSessions, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [doctorId, checkForSessions])

  // Handle join session — embedded inside dashboard
  const handleJoin = async () => {
    if (!activeSession) return
    try {
      await fetch(`/api/bugsy/admin/reports/${activeSession.id}/live-session`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      })
    } catch (error) {
      console.error('Error joining session:', error)
    }
    setCallRoomUrl(activeSession.live_session_room_url)
    setCallReportId(activeSession.id)
    setInCall(true)
    setDismissed(prev => new Set([...prev, activeSession.id]))
    setActiveSession(null)
  }

  // End session
  const handleEndCall = async () => {
    if (callReportId) {
      try {
        await fetch(`/api/bugsy/admin/reports/${callReportId}/live-session`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'end' }),
        })
      } catch (err) {
        console.error('Error ending session:', err)
      }
    }
    setInCall(false)
    setCallRoomUrl(null)
    setCallReportId(null)
  }

  // Handle dismiss
  const handleDismiss = () => {
    if (activeSession) {
      setDismissed(prev => new Set([...prev, activeSession.id]))
      setActiveSession(null)
    }
  }

  if (!activeSession && !inCall) return null

  return (
    <>
      {/* Notification banner */}
      {!inCall && activeSession && (
      <div className="fixed top-0 left-0 right-0 z-[9998] animate-slideDown">
        <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPulsing(!isPulsing)}
                className={`p-2 bg-white/20 rounded-full transition-all ${isPulsing ? 'animate-pulse' : ''}`}
              >
                <Phone className="w-5 h-5" />
              </button>
              <div>
                <p className="font-semibold">Live Support Session Requested</p>
                <p className="text-sm text-red-100 truncate max-w-md">
                  {activeSession.description || 'Admin wants to help with your bug report'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={toggleSound} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title={soundEnabled ? 'Mute' : 'Unmute'}>
                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <button onClick={handleJoin} className="px-4 py-2 bg-white text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2">
                <Phone className="w-4 h-4" /> Join Now
              </button>
              <button onClick={handleDismiss} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Dismiss">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Embedded video call */}
      {inCall && callRoomUrl && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl h-[80vh] bg-[#0d2626] rounded-2xl border border-teal-500/20 overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 bg-[#0a1f1f] border-b border-teal-500/20">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-white font-semibold text-sm">Live Support Session</span>
                <span className="text-gray-500 text-xs">with admin</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEndCall}
                  className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-medium rounded-lg transition-colors"
                >
                  End Session
                </button>
                <button
                  onClick={() => setInCall(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  title="Minimize (session continues)"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
            <iframe
              src={callRoomUrl}
              className="flex-1 w-full border-0"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              allowFullScreen
            />
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </>
  )
}


