'use client'

import { useEffect, useState, useRef } from 'react'
import './InstantVisitQueueModal.css'

interface InstantVisitPatient {
  id: string
  appointmentId: string
  name: string
  email: string
  phone: string
  reason: string
  visitType: 'video' | 'phone'
  position: number
  totalInQueue: number
  estimatedWait: number
  paidAt: Date
}

interface InstantVisitQueueModalProps {
  isOpen: boolean
  patient: InstantVisitPatient | null
  onClose: () => void
  onStartCall: (appointmentId: string) => void
  onComplete: (appointmentId: string) => void
  onCancel: (appointmentId: string) => void
}

export default function InstantVisitQueueModal({
  isOpen,
  patient,
  onClose,
  onStartCall,
  onComplete,
  onCancel
}: InstantVisitQueueModalProps) {
  const [queueTime, setQueueTime] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [joinedTime, setJoinedTime] = useState<string>('')
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [progressStep, setProgressStep] = useState(2) // 0: Paid, 1: Intake, 2: In Queue, 3: Visit, 4: Complete

  useEffect(() => {
    if (!isOpen || !patient) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      return
    }

    // Initialize timer
    const startTime = patient.paidAt
    setJoinedTime(formatTime(startTime))
    
    const updateTimer = () => {
      const now = new Date()
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000)
      
      const hours = Math.floor(elapsed / 3600)
      const minutes = Math.floor((elapsed % 3600) / 60)
      const seconds = elapsed % 60
      
      setQueueTime({ hours, minutes, seconds })
    }

    updateTimer() // Initial update
    timerIntervalRef.current = setInterval(updateTimer, 1000)

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [isOpen, patient])

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const formatClockDisplay = () => {
    if (queueTime.hours > 0) {
      return `${String(queueTime.hours).padStart(2, '0')}:${String(queueTime.minutes).padStart(2, '0')}`
    }
    return `${String(queueTime.minutes).padStart(2, '0')}:${String(queueTime.seconds).padStart(2, '0')}`
  }

  const formatClockSeconds = () => {
    if (queueTime.hours > 0) {
      return `:${String(queueTime.seconds).padStart(2, '0')}`
    }
    return ''
  }

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (!isOpen || !patient) return null

  return (
    <div className={`queue-modal-overlay ${!isOpen ? 'hidden' : ''}`} onClick={onClose}>
      <div className="queue-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="queue-header">
          <div className="queue-title">
            <div className="queue-title-icon">⚡</div>
            <div>
              <h2>Instant Visit Queue</h2>
              <span>● LIVE</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Patient Info */}
        <div className="patient-section">
          <div className="patient-avatar">{getInitials(patient.name)}</div>
          <div className="patient-name">{patient.name}</div>
          <div className="patient-details">
            <div className="patient-detail">
              <span className="patient-detail-icon">📧</span>
              <span>{patient.email}</span>
            </div>
            <div className="patient-detail">
              <span className="patient-detail-icon">📱</span>
              <span>{patient.phone}</span>
            </div>
          </div>
          <div className={`visit-type-badge ${patient.visitType}`}>
            <span>{patient.visitType === 'video' ? '📹' : '📞'}</span>
            <span>{patient.visitType === 'video' ? 'Video Visit' : 'Phone Visit'}</span>
          </div>
        </div>

        {/* Clock Section */}
        <div className="clock-section">
          <div className="clock-label">⏱️ Time in Queue</div>
          <div className="clock-container">
            <div className="clock-ring"></div>
            <div className="clock-display">
              {formatClockDisplay()}
              {formatClockSeconds() && (
                <span className="clock-seconds">{formatClockSeconds()}</span>
              )}
            </div>
          </div>
          <div className="clock-started">
            Joined queue at <strong>{joinedTime}</strong>
          </div>
        </div>

        {/* Queue Position */}
        <div className="queue-position-section">
          <div className="queue-stat">
            <div className="queue-stat-value position">{patient.position}</div>
            <div className="queue-stat-label">Position</div>
          </div>
          <div className="queue-divider"></div>
          <div className="queue-stat">
            <div className="queue-stat-value total">{patient.totalInQueue}</div>
            <div className="queue-stat-label">In Queue</div>
          </div>
          <div className="queue-divider"></div>
          <div className="estimated-wait">
            <div className="estimated-wait-value">~{patient.estimatedWait} min</div>
            <div className="estimated-wait-label">Est. Wait</div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="progress-section">
          <div className="progress-steps">
            <div className="progress-step">
              <div className={`step-icon ${progressStep > 0 ? 'completed' : 'pending'}`}>✓</div>
              <div className={`step-label ${progressStep > 0 ? 'completed' : ''}`}>Paid</div>
            </div>
            <div className="progress-step">
              <div className={`step-icon ${progressStep > 1 ? 'completed' : progressStep === 1 ? 'active' : 'pending'}`}>
                {progressStep > 1 ? '✓' : progressStep === 1 ? '⏳' : ''}
              </div>
              <div className={`step-label ${progressStep > 1 ? 'completed' : progressStep === 1 ? 'active' : ''}`}>Intake</div>
            </div>
            <div className="progress-step">
              <div className={`step-icon ${progressStep > 2 ? 'completed' : progressStep === 2 ? 'active' : 'pending'}`}>
                {progressStep > 2 ? '✓' : progressStep === 2 ? '⏳' : ''}
              </div>
              <div className={`step-label ${progressStep > 2 ? 'completed' : progressStep === 2 ? 'active' : ''}`}>In Queue</div>
            </div>
            <div className="progress-step">
              <div className={`step-icon ${progressStep > 3 ? 'completed' : progressStep === 3 ? 'active' : 'pending'}`}>
                {progressStep > 3 ? '✓' : progressStep === 3 ? '📹' : ''}
              </div>
              <div className={`step-label ${progressStep > 3 ? 'completed' : progressStep === 3 ? 'active' : ''}`}>Visit</div>
            </div>
            <div className="progress-step">
              <div className={`step-icon ${progressStep > 4 ? 'completed' : 'pending'}`}>
                {progressStep > 4 ? '✓' : ''}
              </div>
              <div className={`step-label ${progressStep > 4 ? 'completed' : ''}`}>Complete</div>
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="reason-section">
          <div className="reason-label">📋 Reason for Visit</div>
          <div className="reason-text">{patient.reason || 'No reason provided'}</div>
        </div>

        {/* Actions */}
        <div className="action-section">
          <button 
            className="action-btn start-call" 
            onClick={() => {
              setProgressStep(3)
              onStartCall(patient.appointmentId)
            }}
          >
            <span>📹</span>
            <span>Start Call</span>
          </button>
          <button 
            className="action-btn complete" 
            onClick={() => {
              setProgressStep(4)
              onComplete(patient.appointmentId)
            }}
          >
            <span>✅</span>
            <span>Complete</span>
          </button>
          <button 
            className="action-btn cancel" 
            onClick={() => onCancel(patient.appointmentId)}
          >
            <span>✕</span>
            <span>Remove</span>
          </button>
        </div>
      </div>
    </div>
  )
}


