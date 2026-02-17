// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — HIPAA AUDIT LOGGING
// Client-side audit trail for all PHI access and modifications
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase'

// ── Action Constants ──
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  SESSION_REFRESH: 'SESSION_REFRESH',

  // Patient records
  VIEW_PATIENT: 'VIEW_PATIENT',
  SEARCH_PATIENTS: 'SEARCH_PATIENTS',
  UPDATE_PATIENT: 'UPDATE_PATIENT',
  CREATE_PATIENT: 'CREATE_PATIENT',

  // Appointments
  VIEW_APPOINTMENT: 'VIEW_APPOINTMENT',
  CREATE_APPOINTMENT: 'CREATE_APPOINTMENT',
  UPDATE_APPOINTMENT: 'UPDATE_APPOINTMENT',
  CANCEL_APPOINTMENT: 'CANCEL_APPOINTMENT',
  COMPLETE_APPOINTMENT: 'COMPLETE_APPOINTMENT',

  // Charts / Clinical
  VIEW_CHART: 'VIEW_CHART',
  UPDATE_CHART: 'UPDATE_CHART',
  SIGN_CHART: 'SIGN_CHART',
  LOCK_CHART: 'LOCK_CHART',
  AMEND_CHART: 'AMEND_CHART',
  VIEW_CLINICAL_NOTE: 'VIEW_CLINICAL_NOTE',
  UPDATE_CLINICAL_NOTE: 'UPDATE_CLINICAL_NOTE',

  // Prescriptions
  VIEW_PRESCRIPTIONS: 'VIEW_PRESCRIPTIONS',
  CREATE_PRESCRIPTION: 'CREATE_PRESCRIPTION',

  // Communication
  VIEW_MESSAGES: 'VIEW_MESSAGES',
  SEND_MESSAGE: 'SEND_MESSAGE',

  // Documents
  VIEW_DOCUMENT: 'VIEW_DOCUMENT',
  UPLOAD_DOCUMENT: 'UPLOAD_DOCUMENT',
  EXPORT_PDF: 'EXPORT_PDF',

  // Staff
  ADD_STAFF: 'ADD_STAFF',
  REMOVE_STAFF: 'REMOVE_STAFF',
  UPDATE_STAFF_PERMISSIONS: 'UPDATE_STAFF_PERMISSIONS',

  // System
  ERROR_BOUNDARY: 'ERROR_BOUNDARY',
  API_ERROR: 'API_ERROR',
  SETTINGS_CHANGE: 'SETTINGS_CHANGE',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export const RESOURCE_TYPES = {
  APPOINTMENT: 'appointment',
  PATIENT: 'patient',
  CLINICAL_NOTE: 'clinical_note',
  CHART: 'chart',
  PRESCRIPTION: 'prescription',
  MESSAGE: 'message',
  DOCUMENT: 'document',
  STAFF: 'staff',
  SETTINGS: 'settings',
  SYSTEM: 'system',
} as const

export type ResourceType = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES]

// ── Log Function ──

interface AuditLogParams {
  action: AuditAction
  resourceType: ResourceType
  resourceId?: string
  description?: string
  metadata?: Record<string, any>
}

// Queue for batching logs (don't block UI)
const logQueue: AuditLogParams[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
const FLUSH_INTERVAL = 2000 // 2 seconds
const MAX_BATCH = 20

async function flushLogs() {
  if (logQueue.length === 0) return

  const batch = logQueue.splice(0, MAX_BATCH)

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.warn('[Audit] No authenticated user, skipping log batch')
      return
    }

    const rows = batch.map(log => ({
      actor_id: user.id,
      actor_email: user.email || null,
      actor_role: 'doctor', // TODO Phase G: detect role from practice_staff
      action: log.action,
      resource_type: log.resourceType,
      resource_id: log.resourceId || null,
      description: log.description || null,
      metadata: log.metadata || {},
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }))

    const { error } = await supabase.from('audit_logs').insert(rows)
    if (error) {
      console.warn('[Audit] Failed to write logs:', error.message)
      // Don't re-queue to avoid infinite loops
    }
  } catch (err) {
    console.warn('[Audit] Flush error:', err)
  }
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushLogs()
  }, FLUSH_INTERVAL)
}

/**
 * Log an audit event. Non-blocking — queues and batches writes.
 * Call this whenever PHI is accessed or modified.
 */
export function logAudit(params: AuditLogParams) {
  logQueue.push(params)

  // Immediate flush for high-priority actions
  const immediateActions: AuditAction[] = [
    'LOGIN', 'LOGOUT', 'SIGN_CHART', 'LOCK_CHART', 'AMEND_CHART',
    'CREATE_PRESCRIPTION', 'EXPORT_PDF', 'ADD_STAFF', 'REMOVE_STAFF',
  ]

  if (immediateActions.includes(params.action)) {
    flushLogs()
  } else {
    scheduleFlush()
  }
}

// Convenience helpers
export function logViewPatient(patientId: string, patientName?: string) {
  logAudit({
    action: 'VIEW_PATIENT',
    resourceType: 'patient',
    resourceId: patientId,
    description: patientName ? `Viewed patient: ${patientName}` : 'Viewed patient record',
  })
}

export function logViewAppointment(appointmentId: string) {
  logAudit({
    action: 'VIEW_APPOINTMENT',
    resourceType: 'appointment',
    resourceId: appointmentId,
    description: 'Opened appointment detail',
  })
}

export function logViewChart(appointmentId: string) {
  logAudit({
    action: 'VIEW_CHART',
    resourceType: 'chart',
    resourceId: appointmentId,
    description: 'Viewed clinical chart',
  })
}

export function logSignChart(appointmentId: string) {
  logAudit({
    action: 'SIGN_CHART',
    resourceType: 'chart',
    resourceId: appointmentId,
    description: 'Signed clinical chart',
  })
}

export function logExportPdf(appointmentId: string) {
  logAudit({
    action: 'EXPORT_PDF',
    resourceType: 'chart',
    resourceId: appointmentId,
    description: 'Exported chart as PDF',
  })
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (logQueue.length > 0) {
      // Use sendBeacon for reliable delivery on page close
      try {
        const user = supabase.auth.getUser() // sync check not available, best effort
        flushLogs()
      } catch { /* best effort */ }
    }
  })
}
