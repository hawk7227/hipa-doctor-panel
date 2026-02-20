// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

/**
 * PatientSearchModal — Global Ctrl+K search modal
 * 
 * Wraps PatientSearchBar in a full-screen modal overlay.
 * When a patient is selected, shows an action picker:
 *   - View Chart → navigates to patient chart (non-appointment)
 *   - Book Appointment → navigates to schedule/calendar
 * 
 * Triggered by:
 *   - Ctrl+K / Cmd+K keyboard shortcut
 *   - PatientSearchTrigger component (dispatches Ctrl+K)
 *   - Sidebar search button (dispatches Ctrl+K)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, FileText, Calendar, Search } from 'lucide-react'
import PatientSearchBar, { PatientSearchResult } from '@/components/PatientSearchBar'

export default function PatientSearchModal() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null)
  const [showActionPicker, setShowActionPicker] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // ─── Ctrl+K / Cmd+K listener ───────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(prev => {
          if (prev) {
            // Closing — reset state
            setSelectedPatient(null)
            setShowActionPicker(false)
          }
          return !prev
        })
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true) // capture phase to beat other listeners
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen])

  // ─── Close handler ─────────────────────────────────────────
  const handleClose = useCallback(() => {
    setIsOpen(false)
    setSelectedPatient(null)
    setShowActionPicker(false)
  }, [])

  // ─── Patient selected from search ─────────────────────────
  const handlePatientSelect = useCallback((patient: PatientSearchResult) => {
    console.log('[PatientSearchModal] Patient selected:', patient.id, patient.first_name, patient.last_name)
    setSelectedPatient(patient)
    setShowActionPicker(true)
  }, [])

  // ─── Action handlers ──────────────────────────────────────
  const handleViewChart = useCallback(() => {
    if (!selectedPatient) return
    console.log('[PatientSearchModal] Navigating to chart for patient:', selectedPatient.id)
    handleClose()
    // Navigate to patients page with openChart param to auto-open the chart modal
    router.push(`/doctor/patients?openChart=${selectedPatient.id}`)
  }, [selectedPatient, router, handleClose])

  const handleBookAppointment = useCallback(() => {
    if (!selectedPatient) return
    console.log('[PatientSearchModal] Navigating to schedule for patient:', selectedPatient.id)
    handleClose()
    // Navigate to schedule/appointments page with patient pre-selected
    router.push(`/doctor/appointments?patientId=${selectedPatient.id}&mode=book`)
  }, [selectedPatient, router, handleClose])

  // ─── Keyboard shortcuts for action picker ──────────────────
  useEffect(() => {
    if (!showActionPicker) return

    const handleActionKey = (e: KeyboardEvent) => {
      if (e.key === '1' || e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        handleViewChart()
      } else if (e.key === '2' || e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        handleBookAppointment()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        // Go back to search
        setSelectedPatient(null)
        setShowActionPicker(false)
      }
    }

    window.addEventListener('keydown', handleActionKey, true)
    return () => window.removeEventListener('keydown', handleActionKey, true)
  }, [showActionPicker, handleViewChart, handleBookAppointment])

  // ─── Click outside to close ────────────────────────────────
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="w-full max-w-xl mx-4 bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a3d3d]">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-medium text-white">
              {showActionPicker ? 'What would you like to do?' : 'Search Patients'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="text-[10px] font-bold text-gray-500 bg-[#0a1f1f] px-1.5 py-0.5 rounded border border-[#1a3d3d]">ESC</kbd>
            <button
              onClick={handleClose}
              className="p-1 rounded hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {!showActionPicker ? (
            /* ─── Search Mode ─── */
            <PatientSearchBar
              onSelect={handlePatientSelect}
              autoFocus={true}
              placeholder="Search patients — name, DOB, email, phone..."
              showSelected={false}
            />
          ) : (
            /* ─── Action Picker Mode ─── */
            <div>
              {/* Selected patient info */}
              <div className="flex items-center gap-3 mb-4 p-3 bg-[#0a1f1f] rounded-lg border border-[#1a3d3d]">
                <div className="w-10 h-10 rounded-full bg-teal-600/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-teal-400">
                    {selectedPatient?.first_name?.charAt(0)}{selectedPatient?.last_name?.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">
                    {selectedPatient?.first_name} {selectedPatient?.last_name}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {selectedPatient?.date_of_birth && (
                      <span>DOB: {selectedPatient.date_of_birth}</span>
                    )}
                    {selectedPatient?.phone && (
                      <span>{selectedPatient.phone}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedPatient(null); setShowActionPicker(false) }}
                  className="text-xs text-gray-500 hover:text-teal-400 transition-colors px-2 py-1 rounded hover:bg-white/5"
                >
                  ← Back
                </button>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleViewChart}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-[#1a3d3d] bg-[#0a1f1f] hover:border-teal-500/60 hover:bg-teal-500/5 transition-all group"
                >
                  <FileText className="w-8 h-8 text-teal-400 group-hover:text-teal-300 transition-colors" />
                  <span className="text-sm font-medium text-white">View Chart</span>
                  <span className="text-[10px] text-gray-500">Open patient record</span>
                  <kbd className="text-[9px] font-bold text-gray-600 bg-[#0d2626] px-1.5 py-0.5 rounded border border-[#1a3d3d] mt-1">
                    Press C or 1
                  </kbd>
                </button>

                <button
                  onClick={handleBookAppointment}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-[#1a3d3d] bg-[#0a1f1f] hover:border-amber-500/60 hover:bg-amber-500/5 transition-all group"
                >
                  <Calendar className="w-8 h-8 text-amber-400 group-hover:text-amber-300 transition-colors" />
                  <span className="text-sm font-medium text-white">Book Appointment</span>
                  <span className="text-[10px] text-gray-500">Schedule a visit</span>
                  <kbd className="text-[9px] font-bold text-gray-600 bg-[#0d2626] px-1.5 py-0.5 rounded border border-[#1a3d3d] mt-1">
                    Press B or 2
                  </kbd>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
