'use client'

import { useState, useRef, useEffect } from 'react'
import { X, GripHorizontal, Calendar } from 'lucide-react'

interface Appointment {
  id: string
  status: string
  service_type: string
  visit_type: string
  created_at: string
  requested_date_time: string | null
}

interface AppointmentsOverlayPanelProps {
  isOpen: boolean
  onClose: () => void
  patientName: string
  patientDOB?: string
  appointments: Appointment[]
  onViewAppointment: (appointmentId: string) => void
}

export default function AppointmentsOverlayPanel({
  isOpen,
  onClose,
  patientName,
  patientDOB,
  appointments,
  onViewAppointment
}: AppointmentsOverlayPanelProps) {
  // Draggable state
  const [position, setPosition] = useState({ x: 100, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <>
      {/* Semi-transparent backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
      />
      
      {/* Draggable Panel */}
      <div
        ref={panelRef}
        className="fixed z-[60] overflow-hidden flex flex-col"
        style={{
          left: position.x,
          top: position.y,
          width: '700px',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 100px)',
          cursor: isDragging ? 'grabbing' : 'default',
          background: 'linear-gradient(180deg, #0d1424, #0b1222)',
          borderRadius: '16px',
          boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Header */}
        <div 
          className="drag-handle sticky top-0 z-10 cursor-grab active:cursor-grabbing"
          style={{ 
            background: '#070c18b3', 
            backdropFilter: 'blur(8px)', 
            borderBottom: '1px solid #1b2b4d',
            padding: '10px 16px'
          }}
        >
          <div className="flex items-center gap-3">
            <GripHorizontal className="h-5 w-5 text-gray-500" />
            
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-400" />
              <span className="font-black text-[#e6f4ff]">Patient Appointments</span>
            </div>
            
            {/* Patient pills */}
            <span 
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full"
              style={{ background: '#0a1732', border: '1px solid #1b2b4d', color: '#cfe1ff' }}
            >
              {patientName}
            </span>
            {patientDOB && (
              <span 
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full"
                style={{ background: '#0a1732', border: '1px solid #1b2b4d', color: '#cfe1ff' }}
              >
                DOB {formatDate(patientDOB)}
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="text-[#98b1c9] hover:text-white transition-colors p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content - EXACT SAME AS PATIENTS PAGE */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Appointments ({appointments.length})</h3>
            {appointments.length === 0 ? (
              <p className="text-gray-400">No appointments found</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="bg-slate-700/50 rounded-lg p-4 border border-white/10 hover:border-cyan-500/50 transition-colors cursor-pointer"
                    onClick={() => onViewAppointment(appointment.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-white font-semibold">
                            {appointment.service_type?.replace(/_/g, ' ') || 'Appointment'}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            appointment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            appointment.status === 'accepted' ? 'bg-green-100 text-green-800' :
                            appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            appointment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {appointment.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          <p>Visit Type: {appointment.visit_type || 'N/A'}</p>
                          {appointment.requested_date_time && (
                            <p>Date: {formatDateTime(appointment.requested_date_time)}</p>
                          )}
                          <p>Created: {formatDateTime(appointment.created_at)}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewAppointment(appointment.id)
                        }}
                        className="ml-4 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}



