// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ═══════════════════════════════════════════════
// MEDAZON HEALTH — CONSTANTS
// Single source of truth for all shared values
// ═══════════════════════════════════════════════

// ─── TIMEZONE ───
// Provider timezone is ALWAYS America/Phoenix (no DST)
export const PROVIDER_TIMEZONE = 'America/Phoenix' as const

// ─── APPOINTMENT STATUSES ───
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
} as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS]

// ─── VISIT TYPES ───
export const VISIT_TYPE = {
  VIDEO: 'video',
  PHONE: 'phone',
  ASYNC: 'async',
  INSTANT: 'instant',
} as const

export type VisitType = (typeof VISIT_TYPE)[keyof typeof VISIT_TYPE]

// ─── CHART STATUSES (5-state enterprise lifecycle) ───
export const CHART_STATUS = {
  DRAFT: 'draft',
  PRELIMINARY: 'preliminary',
  SIGNED: 'signed',
  CLOSED: 'closed',
  AMENDED: 'amended',
} as const

export type ChartStatus = (typeof CHART_STATUS)[keyof typeof CHART_STATUS]

// ─── CHART STATUS DISPLAY CONFIG ───
export const CHART_STATUS_CONFIG: Record<ChartStatus, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
}> = {
  draft: {
    label: 'Draft',
    color: '#6b7280',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500',
    icon: '',
  },
  preliminary: {
    label: 'Preliminary',
    color: '#f59e0b',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500',
    icon: '⏳',
  },
  signed: {
    label: 'Signed',
    color: '#22c55e',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500',
    icon: '✓',
  },
  closed: {
    label: 'Closed',
    color: '#3b82f6',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500',
    icon: '🔒',
  },
  amended: {
    label: 'Amended',
    color: '#a855f7',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500',
    icon: '🔒✎',
  },
}

// ─── USER ROLES ───
export const USER_ROLE = {
  PROVIDER: 'provider',
  ASSISTANT: 'assistant',
  SCRIBE: 'scribe',
  MA: 'ma',
  BILLING_ADMIN: 'billing_admin',
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

// ─── ROLE PERMISSIONS ───
export const ROLE_CAN_SIGN_CHART = [USER_ROLE.PROVIDER] as const
export const ROLE_CAN_CLOSE_CHART = [USER_ROLE.PROVIDER] as const
export const ROLE_CAN_UNLOCK_CHART = [USER_ROLE.PROVIDER] as const
export const ROLE_CAN_PRESCRIBE = [USER_ROLE.PROVIDER] as const
export const ROLE_CAN_MANAGE_STAFF = [USER_ROLE.PROVIDER] as const
export const ROLE_CAN_WRITE_SOAP = [USER_ROLE.PROVIDER, USER_ROLE.ASSISTANT, USER_ROLE.SCRIBE, USER_ROLE.MA] as const
export const ROLE_CAN_PEND_ORDERS = [USER_ROLE.PROVIDER, USER_ROLE.ASSISTANT, USER_ROLE.SCRIBE, USER_ROLE.MA] as const

// ─── Z-INDEX SCALE ───
// Prevents z-index chaos across workspace
export const Z_INDEX = {
  BASE: 10,
  PANEL: 20,
  ACTIVE_PANEL: 30,
  OVERLAY: 40,
  HOVER_POPUP: 45,
  MODAL: 50,
  TOAST: 60,
  CRITICAL: 70,
} as const

// ─── AMENDMENT TYPES ───
export const AMENDMENT_TYPE = {
  LATE_ENTRY: 'late_entry',
  ADDENDUM: 'addendum',
  CORRECTION: 'correction',
} as const

export type AmendmentType = (typeof AMENDMENT_TYPE)[keyof typeof AMENDMENT_TYPE]

// ─── TIMELINESS THRESHOLDS (CMS/Medicare compliance) ───
export const TIMELINESS = {
  WARNING_HOURS: 24,      // Yellow badge after 24hrs unsigned
  NONCOMPLIANT_HOURS: 48, // Red flag after 48hrs unsigned
} as const

// ─── AUDIT EVENT CATEGORIES ───
export const AUDIT_CATEGORY = {
  AUTH: 'auth',
  ACCESS: 'access',
  CHANGE: 'change',
  ADMIN: 'admin',
} as const

export type AuditCategory = (typeof AUDIT_CATEGORY)[keyof typeof AUDIT_CATEGORY]

// ─── AUDIT ACTIONS ───
export const AUDIT_ACTION = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  SIGN: 'sign',
  COSIGN: 'cosign',
  SUBMIT: 'submit',
  PEND: 'pend',
  APPROVE: 'approve',
  LOGIN: 'login',
  LOGOUT: 'logout',
} as const

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION]

// ─── ROLE PERMISSION HELPERS ─────────────────────────────────
export const canSignChart = (role: UserRole): boolean =>
  ROLE_CAN_SIGN_CHART.includes(role as typeof ROLE_CAN_SIGN_CHART[number])

export const canCloseChart = (role: UserRole): boolean =>
  ROLE_CAN_CLOSE_CHART.includes(role as typeof ROLE_CAN_CLOSE_CHART[number])

export const canPrescribe = (role: UserRole): boolean =>
  ROLE_CAN_PRESCRIBE.includes(role as typeof ROLE_CAN_PRESCRIBE[number])

export const canManageStaff = (role: UserRole): boolean =>
  ROLE_CAN_MANAGE_STAFF.includes(role as typeof ROLE_CAN_MANAGE_STAFF[number])

export const canWriteSOAP = (role: UserRole): boolean =>
  ROLE_CAN_WRITE_SOAP.includes(role as typeof ROLE_CAN_WRITE_SOAP[number])

export const canAccessStaffPage = (role: UserRole): boolean =>
  ROLE_CAN_MANAGE_STAFF.includes(role as typeof ROLE_CAN_MANAGE_STAFF[number])

export const canAccessChartManagement = (role: UserRole): boolean =>
  ROLE_CAN_SIGN_CHART.includes(role as typeof ROLE_CAN_SIGN_CHART[number])

// ─── PANEL IDS ───────────────────────────────────────────────
// All workspace panel identifiers in one place
export const PANEL_ID = {
  MEDICATION_HISTORY: 'medication-history',
  ORDERS: 'orders',
  PRESCRIPTION_HISTORY: 'prescription-history',
  APPOINTMENTS: 'appointments',
  ALLERGIES: 'allergies',
  VITALS: 'vitals',
  MEDICATIONS: 'medications',
  DEMOGRAPHICS: 'demographics',
  PROBLEMS: 'problems',
  CLINICAL_NOTES: 'clinical-notes',
  LAB_RESULTS: 'lab-results-panel',
  IMMUNIZATIONS: 'immunizations',
  DOCUMENTS: 'documents',
  FAMILY_HISTORY: 'family-history',
  SOCIAL_HISTORY: 'social-history',
  SURGICAL_HISTORY: 'surgical-history',
  PHARMACY: 'pharmacy',
  CARE_PLANS: 'care-plans',
  BILLING: 'billing',
  COMM_HUB: 'comm-hub',
  LAB_ORDERS: 'lab-results-inline',
  REFERRALS: 'referrals-followup',
  PRIOR_AUTH: 'prior-auth',
  CHART_MANAGEMENT: 'chart-management',
  ERX: 'drchrono-erx',
  VIDEO: 'video-call',
  PATIENT_SNAPSHOT: 'patient-snapshot',
  SOAP: 'soap-notes',
  COSIGN_QUEUE: 'cosign-queue',
  AUDIT_TRAIL: 'audit-trail',
} as const

export type PanelId = (typeof PANEL_ID)[keyof typeof PANEL_ID]

// ─── PANELS THAT LOCK WITH CHART ─────────────────────────────
// These panels become read-only when chart is Signed/Closed
export const CHART_LOCKED_PANELS: readonly PanelId[] = [
  PANEL_ID.MEDICATIONS,
  PANEL_ID.ALLERGIES,
  PANEL_ID.PROBLEMS,
  PANEL_ID.VITALS,
  PANEL_ID.ORDERS,
  PANEL_ID.CLINICAL_NOTES,
  PANEL_ID.LAB_RESULTS,
  PANEL_ID.IMMUNIZATIONS,
  PANEL_ID.FAMILY_HISTORY,
  PANEL_ID.SOCIAL_HISTORY,
  PANEL_ID.SURGICAL_HISTORY,
  PANEL_ID.CARE_PLANS,
  PANEL_ID.REFERRALS,
  PANEL_ID.LAB_ORDERS,
] as const

// ─── PANELS ALWAYS EDITABLE (administrative/operational) ─────
export const ALWAYS_EDITABLE_PANELS: readonly PanelId[] = [
  PANEL_ID.DEMOGRAPHICS,
  PANEL_ID.DOCUMENTS,
  PANEL_ID.PHARMACY,
  PANEL_ID.BILLING,
  PANEL_ID.COMM_HUB,
  PANEL_ID.PRIOR_AUTH,
] as const

// ─── WORKSPACE LAYOUT DEBOUNCE ───
export const LAYOUT_SAVE_DEBOUNCE_MS = 500

// ─── TRANSITION TIMING ───
export const TRANSITION_DURATION_MS = 200
export const TRANSITION_EASING = 'cubic-bezier(0.25, 0.1, 0.25, 1)'

// ─── WORKSPACE DEFAULTS ──────────────────────────────────────
export const WORKSPACE_DEFAULTS = {
  LAYOUT_SAVE_DEBOUNCE_MS: 500,
  RESIZE_CONTENT_DEBOUNCE_MS: 200,
  TRANSITION_DURATION_MS: 200,
  TRANSITION_EASING: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  DRAG_TAP_DELAY_MS: 150,
} as const

// ─── MOBILE BREAKPOINTS ───
export const BREAKPOINT = {
  MOBILE: 768,
  TABLET: 1024,
} as const

// ─── CALENDAR DEFAULTS ───────────────────────────────────────
export const CALENDAR_DEFAULTS = {
  START_HOUR: 5,    // 5:00 AM
  END_HOUR: 20,     // 8:00 PM
  SLOT_MINUTES: 30,
  HOVER_POPUP_DELAY_MS: 300,
  HOVER_POPUP_GRACE_MS: 150,
} as const
