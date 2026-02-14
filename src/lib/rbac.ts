// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — RBAC (Role-Based Access Control)
// Phase G: Permissions, roles, and access checking
// ═══════════════════════════════════════════════════════════════

// ── Roles ──
export const ROLES = {
  DOCTOR: 'doctor',
  ASSISTANT: 'assistant',
  ADMIN: 'admin',
  BILLING: 'billing',
} as const
export type Role = (typeof ROLES)[keyof typeof ROLES]

// ── Permissions ──
export const PERMISSIONS = {
  // Appointments
  VIEW_APPOINTMENTS: 'view_appointments',
  CREATE_APPOINTMENTS: 'create_appointments',
  CANCEL_APPOINTMENTS: 'cancel_appointments',
  COMPLETE_APPOINTMENTS: 'complete_appointments',

  // Patients
  VIEW_PATIENTS: 'view_patients',
  CREATE_PATIENTS: 'create_patients',
  EDIT_PATIENTS: 'edit_patients',

  // Charts / Clinical
  VIEW_CHARTS: 'view_charts',
  EDIT_CHARTS: 'edit_charts',
  SIGN_CHARTS: 'sign_charts',
  LOCK_CHARTS: 'lock_charts',
  AMEND_CHARTS: 'amend_charts',

  // Prescriptions
  VIEW_PRESCRIPTIONS: 'view_prescriptions',
  CREATE_PRESCRIPTIONS: 'create_prescriptions',

  // Communication
  VIEW_MESSAGES: 'view_messages',
  SEND_MESSAGES: 'send_messages',

  // Billing
  VIEW_BILLING: 'view_billing',
  MANAGE_BILLING: 'manage_billing',

  // Admin
  MANAGE_STAFF: 'manage_staff',
  VIEW_AUDIT_LOG: 'view_audit_log',
  MANAGE_SETTINGS: 'manage_settings',
} as const
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// ── Default permissions by role ──
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  doctor: Object.values(PERMISSIONS), // Full access

  assistant: [
    'view_appointments', 'create_appointments', 'cancel_appointments',
    'view_patients', 'create_patients', 'edit_patients',
    'view_charts', 'edit_charts', // Can edit but NOT sign/lock/amend
    'view_prescriptions',
    'view_messages', 'send_messages',
    'view_billing',
  ],

  admin: [
    'view_appointments', 'create_appointments', 'cancel_appointments',
    'view_patients', 'create_patients', 'edit_patients',
    'view_charts',
    'view_prescriptions',
    'view_messages', 'send_messages',
    'view_billing', 'manage_billing',
    'manage_staff', 'view_audit_log', 'manage_settings',
  ],

  billing: [
    'view_appointments',
    'view_patients',
    'view_billing', 'manage_billing',
  ],
}

// ── Role display config ──
export const ROLE_CONFIG: Record<Role, { label: string; color: string; bgColor: string; description: string }> = {
  doctor: { label: 'Provider', color: 'text-teal-400', bgColor: 'bg-teal-500/15', description: 'Full access to all features, can sign charts' },
  assistant: { label: 'Assistant', color: 'text-blue-400', bgColor: 'bg-blue-500/15', description: 'Can manage appointments, edit charts (cannot sign)' },
  admin: { label: 'Admin', color: 'text-purple-400', bgColor: 'bg-purple-500/15', description: 'Staff management, billing, settings access' },
  billing: { label: 'Billing', color: 'text-amber-400', bgColor: 'bg-amber-500/15', description: 'View appointments and manage billing only' },
}

// ── Permission groups for UI ──
export const PERMISSION_GROUPS: { label: string; permissions: { key: Permission; label: string }[] }[] = [
  {
    label: 'Appointments',
    permissions: [
      { key: 'view_appointments', label: 'View appointments' },
      { key: 'create_appointments', label: 'Create appointments' },
      { key: 'cancel_appointments', label: 'Cancel appointments' },
      { key: 'complete_appointments', label: 'Complete appointments' },
    ],
  },
  {
    label: 'Patients',
    permissions: [
      { key: 'view_patients', label: 'View patients' },
      { key: 'create_patients', label: 'Create patients' },
      { key: 'edit_patients', label: 'Edit patient info' },
    ],
  },
  {
    label: 'Charts & Clinical',
    permissions: [
      { key: 'view_charts', label: 'View charts' },
      { key: 'edit_charts', label: 'Edit charts' },
      { key: 'sign_charts', label: 'Sign charts' },
      { key: 'lock_charts', label: 'Lock charts' },
      { key: 'amend_charts', label: 'Amend charts' },
    ],
  },
  {
    label: 'Prescriptions',
    permissions: [
      { key: 'view_prescriptions', label: 'View prescriptions' },
      { key: 'create_prescriptions', label: 'Create prescriptions' },
    ],
  },
  {
    label: 'Communication',
    permissions: [
      { key: 'view_messages', label: 'View messages' },
      { key: 'send_messages', label: 'Send messages' },
    ],
  },
  {
    label: 'Billing',
    permissions: [
      { key: 'view_billing', label: 'View billing' },
      { key: 'manage_billing', label: 'Manage billing' },
    ],
  },
  {
    label: 'Admin',
    permissions: [
      { key: 'manage_staff', label: 'Manage staff' },
      { key: 'view_audit_log', label: 'View audit log' },
      { key: 'manage_settings', label: 'Manage settings' },
    ],
  },
]

// ── Helpers ──

export function hasPermission(userPermissions: Permission[], required: Permission): boolean {
  return userPermissions.includes(required)
}

export function hasAnyPermission(userPermissions: Permission[], required: Permission[]): boolean {
  return required.some(p => userPermissions.includes(p))
}

export function hasAllPermissions(userPermissions: Permission[], required: Permission[]): boolean {
  return required.every(p => userPermissions.includes(p))
}

export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}
