// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { PROVIDER_TIMEZONE } from '@/lib/constants'
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export function useAppointmentActions(
  appointmentId: string | null,
  onStatusChange: () => void,
  onClose: () => void,
  setAppointment: (fn: (prev: any) => any) => void,
  setError: (err: string | null) => void,
) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [showRescheduleForm, setShowRescheduleForm] = useState(false)
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showMoveForm, setShowMoveForm] = useState(false)
  const [selectedMoveTime, setSelectedMoveTime] = useState<string>('')
  const [moveLoading, setMoveLoading] = useState(false)

  // Accept / Reject
  const handleAppointmentAction = useCallback(async (action: 'accept' | 'reject') => {
    if (!appointmentId) return
    setActionLoading(action)
    setError(null)
    try {
      console.log(`[Action] ${action} appointment:`, appointmentId)
      const endpoint = action === 'accept' ? '/api/appointments/accept' : '/api/appointments/reject'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Failed to ${action} appointment`)
      }
      onStatusChange()
      if (action === 'reject') onClose()
    } catch (err: any) {
      console.error(`[Action] ${action} error:`, err)
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }, [appointmentId, onStatusChange, onClose, setError])

  // Status change via dropdown
  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!appointmentId) return
    setStatusUpdating(true)
    setError(null)
    try {
      console.log('[Action] Status change:', appointmentId, '->', newStatus)
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', appointmentId)
      if (updateError) throw updateError
      setAppointment((prev: any) => prev ? { ...prev, status: newStatus } : prev)
      onStatusChange()
    } catch (err: any) {
      console.error('[Action] Status change error:', err)
      setError(err.message)
    } finally {
      setStatusUpdating(false)
    }
  }, [appointmentId, onStatusChange, setAppointment, setError])

  // Complete
  const handleComplete = useCallback(async () => {
    if (!appointmentId) return
    setActionLoading('complete')
    setError(null)
    try {
      console.log('[Action] Completing appointment:', appointmentId)
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', appointmentId)
      if (updateError) throw updateError
      setAppointment((prev: any) => prev ? { ...prev, status: 'completed' } : prev)
      onStatusChange()
    } catch (err: any) {
      console.error('[Action] Complete error:', err)
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }, [appointmentId, onStatusChange, setAppointment, setError])

  // Cancel
  const handleCancel = useCallback(async (reason?: string) => {
    if (!appointmentId) return
    setCancelling(true)
    setError(null)
    try {
      console.log('[Action] Cancelling appointment:', appointmentId)
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, reason: reason || 'Cancelled by provider' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel appointment')
      }
      onStatusChange()
      onClose()
    } catch (err: any) {
      console.error('[Action] Cancel error:', err)
      setError(err.message)
    } finally {
      setCancelling(false)
      setShowCancelConfirm(false)
    }
  }, [appointmentId, onStatusChange, onClose, setError])

  // Reschedule
  const handleReschedule = useCallback(async (newDateTime: string) => {
    if (!appointmentId || !newDateTime) return
    setRescheduleLoading(true)
    setError(null)
    try {
      console.log('[Action] Rescheduling appointment:', appointmentId, '->', newDateTime)
      const res = await fetch('/api/appointments/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, newDateTime }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reschedule appointment')
      }
      setShowRescheduleForm(false)
      onStatusChange()
    } catch (err: any) {
      console.error('[Action] Reschedule error:', err)
      setError(err.message)
    } finally {
      setRescheduleLoading(false)
    }
  }, [appointmentId, onStatusChange, setError])

  // Move (quick time change)
  const handleMove = useCallback(async (newTime: string) => {
    if (!appointmentId || !newTime) return
    setMoveLoading(true)
    setError(null)
    try {
      console.log('[Action] Moving appointment:', appointmentId, '->', newTime)
      const res = await fetch('/api/appointments/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, newTime }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to move appointment')
      }
      setShowMoveForm(false)
      setSelectedMoveTime('')
      onStatusChange()
    } catch (err: any) {
      console.error('[Action] Move error:', err)
      setError(err.message)
    } finally {
      setMoveLoading(false)
    }
  }, [appointmentId, onStatusChange, setError])

  // Reset forms
  const closeAllForms = useCallback(() => {
    setShowRescheduleForm(false)
    setShowCancelConfirm(false)
    setShowMoveForm(false)
    setSelectedMoveTime('')
  }, [])

  return {
    actionLoading, statusUpdating,
    showRescheduleForm, setShowRescheduleForm, rescheduleLoading,
    showCancelConfirm, setShowCancelConfirm, cancelling,
    showMoveForm, setShowMoveForm, selectedMoveTime, setSelectedMoveTime, moveLoading,
    handleAppointmentAction, handleStatusChange, handleComplete,
    handleCancel, handleReschedule, handleMove, closeAllForms,
  }
}
