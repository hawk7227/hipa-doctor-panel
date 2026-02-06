'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Phone, X, Volume2, VolumeX } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'

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
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastCheckRef = useRef<string | null>(null)

  // Load sound preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SOUND_STORAGE_KEY)
      if (saved !== null) {
        setSoundEnabled(saved === 'true')
      }
    }
  }, [])

  // Save sound preference
  const toggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    localStorage.setItem(SOUND_STORAGE_KEY, String(newValue))
  }

  // Get current doctor
  useEffect(() => {
    const loadDoctor = async () => {
      const user = await getCurrentUser()
      if (user?.doctor?.id) {
        setDoctorId(user.doctor.id)
      }
    }
    loadDoctor()
  }, [])

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return

    try {
      // Create audio element if needed
      if (!audioRef.current) {
        audioRef.current = new Audio()
        // Use a simple beep sound (base64 encoded)
        audioRef.current.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVgXQ47Q3rJkHwxJl9Tjt2ULDVuZ0NurYRwGP5ra16V5WBdDjtDes2QfDEmX1OO3ZQsNW5nQ26thHAY/mtrXpXlYF0OO0N6zZB8MSZfU47dlCw1bmdDbq2EcBj+a2teleVgXQ47Q3rNkHwxJl9Tjt2ULDV2gAACBhYqFbF1fdZmwrJBhNjVgodDbq2EcBj+a2teleVgXQ47Q3rNkHwxJl9Tjt2ULDVuZ0NurYRwGP5ra16V5WBdDjtDes2QfDEmX1OO3ZQsNW5nQ26thHAY/mtrXpXlYF0OO0N6zZB8MSZfU47dlCw1bmdDbq2EcBj+a2teleVgXQ47Q3rNkHwxJl9Tjt2ULDVuZ'
      }
      
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(e => {
        console.log('Could not play notification sound:', e)
      })
    } catch (e) {
      console.log('Error with notification sound:', e)
    }
  }, [soundEnabled])

  // Check for live session requests
  const checkForSessions = useCallback(async () => {
    if (!doctorId) return

    try {
      const response = await fetch(`/api/bug-reports?doctor_id=${doctorId}`)
      if (!response.ok) return

      const data = await response.json()
      const reports = data.bug_reports || []

      // Find any bug report with a live session requested by admin
      const sessionRequest = reports.find((report: any) => 
        report.live_session_status === 'requested' &&
        report.live_session_requested_by === 'admin' &&
        report.live_session_room_url &&
        !dismissed.has(report.id)
      )

      if (sessionRequest) {
        // Check if this is a new request (not the same as last check)
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

    // Initial check
    checkForSessions()

    // Set up polling
    const interval = setInterval(checkForSessions, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [doctorId, checkForSessions])

  // Handle join session
  const handleJoin = async () => {
    if (!activeSession) return

    try {
      // Update session status to active
      await fetch(`/api/bug-reports/${activeSession.id}/live-session`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      })

      // Open the room
      window.open(activeSession.live_session_room_url, '_blank')
      
      // Dismiss this alert
      setDismissed(prev => new Set([...prev, activeSession.id]))
      setActiveSession(null)
    } catch (error) {
      console.error('Error joining session:', error)
      // Still try to open the room
      window.open(activeSession.live_session_room_url, '_blank')
    }
  }

  // Handle dismiss
  const handleDismiss = () => {
    if (activeSession) {
      setDismissed(prev => new Set([...prev, activeSession.id]))
      setActiveSession(null)
    }
  }

  // Don't render if no active session
  if (!activeSession) return null

  return (
    <>
      {/* Full-width alert banner at top of screen */}
      <div className="fixed top-0 left-0 right-0 z-[9998] animate-slideDown">
        <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPulsing(!isPulsing)}
                className={`p-2 bg-white/20 rounded-full transition-all ${isPulsing ? 'animate-pulse' : ''}`}
                title={isPulsing ? 'Stop animation' : 'Resume animation'}
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
              {/* Sound toggle */}
              <button
                onClick={toggleSound}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </button>

              {/* Join button */}
              <button
                onClick={handleJoin}
                className="px-4 py-2 bg-white text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <Phone className="w-4 h-4" />
                Join Now
              </button>

              {/* Dismiss button */}
              <button
                onClick={handleDismiss}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add animation styles */}
      <style jsx global>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
