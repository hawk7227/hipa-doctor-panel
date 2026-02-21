// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — ENTERPRISE RBAC (Role-Based Access Control)
// 50+ granular permissions modeled after HIPAA best practices
// Doctor has FULL control over what staff can see, do, and access
// ═══════════════════════════════════════════════════════════════

// ── Roles ──
export const ROLES = {
  DOCTOR: 'doctor',
  ASSISTANT: 'assistant',
  NURSE: 'nurse',
  ADMIN: 'admin',
  BILLING: 'billing',
  FRONT_DESK: 'front_desk',
} as const
export type Role = (typeof ROLES)[keyof typeof ROLES]

// ── Permissions ──
// Organized by domain with granular read/write/delete separation
export const PERMISSIONS = {
  // ─── SCHEDULING & APPOINTMENTS ───
  VIEW_SCHEDULE: 'view_schedule',                   // See the calendar/schedule
  VIEW_APPOINTMENTS: 'view_appointments',           // See appointment details
  CREATE_APPOINTMENTS: 'create_appointments',       // Book new appointments
  EDIT_APPOINTMENTS: 'edit_appointments',            // Modify existing appointments
  CANCEL_APPOINTMENTS: 'cancel_appointments',       // Cancel appointments
  COMPLETE_APPOINTMENTS: 'complete_appointments',   // Mark appointments complete
  RESCHEDULE_APPOINTMENTS: 'reschedule_appointments', // Reschedule appointments
  VIEW_APPOINTMENT_HISTORY: 'view_appointment_history', // See past appointments

  // ─── PATIENT RECORDS ───
  VIEW_PATIENT_LIST: 'view_patient_list',           // See list of patients
  VIEW_PATIENT_DEMOGRAPHICS: 'view_patient_demographics', // See name, DOB, contact
  EDIT_PATIENT_DEMOGRAPHICS: 'edit_patient_demographics', // Update demographics
  CREATE_PATIENTS: 'create_patients',               // Register new patients
  DELETE_PATIENTS: 'delete_patients',               // Remove patient records
  VIEW_PATIENT_INSURANCE: 'view_patient_insurance', // See insurance details
  EDIT_PATIENT_INSURANCE: 'edit_patient_insurance', // Update insurance info
  VIEW_PATIENT_HISTORY: 'view_patient_history',     // See medical history
  VIEW_PATIENT_DOCUMENTS: 'view_patient_documents', // See uploaded documents
  UPLOAD_PATIENT_DOCUMENTS: 'upload_patient_documents', // Upload documents
  DELETE_PATIENT_DOCUMENTS: 'delete_patient_documents', // Remove documents
  EXPORT_PATIENT_DATA: 'export_patient_data',       // Download/export patient data

  // ─── CLINICAL NOTES & CHARTS ───
  VIEW_CLINICAL_NOTES: 'view_clinical_notes',       // Read clinical notes (SOAP, etc.)
  CREATE_CLINICAL_NOTES: 'create_clinical_notes',   // Write new clinical notes
  EDIT_CLINICAL_NOTES: 'edit_clinical_notes',       // Modify draft notes
  SIGN_CLINICAL_NOTES: 'sign_clinical_notes',       // E-sign/lock clinical notes
  COSIGN_CLINICAL_NOTES: 'cosign_clinical_notes',   // Co-sign under provider name
  LOCK_CHARTS: 'lock_charts',                       // Lock/close charts
  ADD_ADDENDUM: 'add_addendum',                     // Add addendum to closed charts
  VIEW_CHART_AUDIT: 'view_chart_audit',             // See chart audit trail

  // ─── PRESCRIPTIONS & MEDICATIONS ───
  VIEW_PRESCRIPTIONS: 'view_prescriptions',         // See medication list
  CREATE_PRESCRIPTIONS: 'create_prescriptions',     // Write new prescriptions
  EDIT_PRESCRIPTIONS: 'edit_prescriptions',         // Modify prescriptions
  SEND_ERX: 'send_erx',                            // Send electronic prescriptions
  VIEW_DRUG_INTERACTIONS: 'view_drug_interactions', // Drug interaction alerts
  VIEW_MEDICATION_HISTORY: 'view_medication_history', // Past medication records

  // ─── LAB RESULTS & ORDERS ───
  VIEW_LAB_RESULTS: 'view_lab_results',             // See lab results
  ORDER_LABS: 'order_labs',                         // Place new lab orders
  EDIT_LAB_ORDERS: 'edit_lab_orders',               // Modify lab orders
  ACKNOWLEDGE_LAB_RESULTS: 'acknowledge_lab_results', // Mark results as reviewed

  // ─── COMMUNICATION ───
  VIEW_MESSAGES: 'view_messages',                   // Read inbox messages
  SEND_MESSAGES: 'send_messages',                   // Send messages
  VIEW_FAXES: 'view_faxes',                        // See incoming faxes
  SEND_FAXES: 'send_faxes',                        // Send outgoing faxes
  MANAGE_TASKS: 'manage_tasks',                     // Create/assign tasks
  ACCESS_MESSAGE_CENTER: 'access_message_center',   // Full message center access

  // ─── BILLING & PAYMENTS ───
  VIEW_BILLING: 'view_billing',                     // See billing info/claims
  EDIT_BILLING: 'edit_billing',                     // Modify billing entries
  SUBMIT_CLAIMS: 'submit_claims',                   // Submit insurance claims
  POST_PAYMENTS: 'post_payments',                   // Record payments
  PROCESS_REFUNDS: 'process_refunds',               // Issue refunds
  VIEW_FEE_SCHEDULE: 'view_fee_schedule',           // See fee schedules
  EDIT_FEE_SCHEDULE: 'edit_fee_schedule',           // Modify fee schedules
  VIEW_BILLING_REPORTS: 'view_billing_reports',     // Billing analytics/reports
  VIEW_PATIENT_BALANCE: 'view_patient_balance',     // See what patients owe
  COLLECT_COPAY: 'collect_copay',                   // Collect copays at check-in

  // ─── TELEHEALTH / VIDEO ───
  JOIN_VIDEO_CALLS: 'join_video_calls',             // Join telehealth sessions
  START_VIDEO_CALLS: 'start_video_calls',           // Initiate video calls
  VIEW_VIDEO_RECORDINGS: 'view_video_recordings',   // Access recorded sessions

  // ─── REPORTS & ANALYTICS ───
  VIEW_DASHBOARD: 'view_dashboard',                 // See main dashboard
  VIEW_PATIENT_ANALYTICS: 'view_patient_analytics', // Patient population reports
  VIEW_PRACTICE_REPORTS: 'view_practice_reports',   // Practice-level analytics
  EXPORT_REPORTS: 'export_reports',                 // Download/export reports

  // ─── ADMIN & SETTINGS ───
  MANAGE_STAFF: 'manage_staff',                     // Add/edit/remove staff
  MANAGE_STAFF_PERMISSIONS: 'manage_staff_permissions', // Change staff permissions
  VIEW_AUDIT_LOG: 'view_audit_log',                 // See system audit logs
  MANAGE_SETTINGS: 'manage_settings',               // Practice settings
  MANAGE_OFFICE_HOURS: 'manage_office_hours',       // Set office hours
  MANAGE_APPOINTMENT_TYPES: 'manage_appointment_types', // Configure visit types
  MANAGE_TEMPLATES: 'manage_templates',             // Clinical note templates
  MANAGE_INTEGRATIONS: 'manage_integrations',       // Stripe, Twilio, etc.
  VIEW_SYSTEM_LOGS: 'view_system_logs',             // Technical system logs

  // ─── SENSITIVE DATA ACCESS ───
  VIEW_SSN: 'view_ssn',                            // See patient SSN
  VIEW_MENTAL_HEALTH_NOTES: 'view_mental_health_notes', // Behavioral health records
  VIEW_SUBSTANCE_ABUSE: 'view_substance_abuse',     // 42 CFR Part 2 protected
  VIEW_HIV_STATUS: 'view_hiv_status',               // HIV/STD status records
  VIEW_GENETIC_DATA: 'view_genetic_data',           // Genetic test results
  BREAK_GLASS_ACCESS: 'break_glass_access',         // Emergency override access
} as const
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// ── Default permissions by role ──
// Doctor: FULL ACCESS to everything
// Others: Principle of Least Privilege
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  doctor: Object.values(PERMISSIONS),

  nurse: [
    // Scheduling
    'view_schedule', 'view_appointments', 'create_appointments', 'edit_appointments',
    'complete_appointments', 'reschedule_appointments', 'view_appointment_history',
    // Patients
    'view_patient_list', 'view_patient_demographics', 'edit_patient_demographics',
    'create_patients', 'view_patient_insurance', 'view_patient_history',
    'view_patient_documents', 'upload_patient_documents',
    // Clinical
    'view_clinical_notes', 'create_clinical_notes', 'edit_clinical_notes',
    'cosign_clinical_notes', 'view_chart_audit',
    // Medications
    'view_prescriptions', 'view_drug_interactions', 'view_medication_history',
    // Labs
    'view_lab_results', 'order_labs',
    // Communication
    'view_messages', 'send_messages', 'manage_tasks', 'access_message_center',
    // Video
    'join_video_calls',
    // Reports
    'view_dashboard', 'view_patient_analytics',
  ],

  assistant: [
    // Scheduling
    'view_schedule', 'view_appointments', 'create_appointments', 'edit_appointments',
    'cancel_appointments', 'reschedule_appointments', 'view_appointment_history',
    // Patients
    'view_patient_list', 'view_patient_demographics', 'edit_patient_demographics',
    'create_patients', 'view_patient_insurance', 'edit_patient_insurance',
    'view_patient_documents', 'upload_patient_documents',
    // Clinical (view only, no sign)
    'view_clinical_notes', 'create_clinical_notes', 'edit_clinical_notes',
    // Medications (view only)
    'view_prescriptions', 'view_medication_history',
    // Labs (view only)
    'view_lab_results',
    // Communication
    'view_messages', 'send_messages', 'manage_tasks', 'access_message_center',
    'view_faxes', 'send_faxes',
    // Billing (limited)
    'view_billing', 'collect_copay', 'view_patient_balance',
    // Video
    'join_video_calls',
    // Reports
    'view_dashboard',
  ],

  admin: [
    // Scheduling
    'view_schedule', 'view_appointments', 'create_appointments', 'edit_appointments',
    'cancel_appointments', 'reschedule_appointments', 'view_appointment_history',
    // Patients
    'view_patient_list', 'view_patient_demographics', 'edit_patient_demographics',
    'create_patients', 'view_patient_insurance', 'edit_patient_insurance',
    'view_patient_documents', 'upload_patient_documents', 'export_patient_data',
    // Clinical (view only)
    'view_clinical_notes', 'view_chart_audit',
    // Communication
    'view_messages', 'send_messages', 'manage_tasks', 'access_message_center',
    'view_faxes', 'send_faxes',
    // Billing
    'view_billing', 'edit_billing', 'submit_claims', 'post_payments',
    'view_fee_schedule', 'view_billing_reports', 'view_patient_balance', 'collect_copay',
    // Reports
    'view_dashboard', 'view_patient_analytics', 'view_practice_reports', 'export_reports',
    // Admin
    'manage_staff', 'manage_staff_permissions', 'view_audit_log', 'manage_settings',
    'manage_office_hours', 'manage_appointment_types', 'manage_templates',
    'manage_integrations', 'view_system_logs',
  ],

  billing: [
    // Scheduling (view only)
    'view_schedule', 'view_appointments', 'view_appointment_history',
    // Patients (limited)
    'view_patient_list', 'view_patient_demographics',
    'view_patient_insurance', 'edit_patient_insurance',
    // Billing (full)
    'view_billing', 'edit_billing', 'submit_claims', 'post_payments',
    'process_refunds', 'view_fee_schedule', 'edit_fee_schedule',
    'view_billing_reports', 'view_patient_balance', 'collect_copay',
    // Reports
    'view_dashboard', 'view_practice_reports', 'export_reports',
  ],

  front_desk: [
    // Scheduling (full)
    'view_schedule', 'view_appointments', 'create_appointments', 'edit_appointments',
    'cancel_appointments', 'reschedule_appointments', 'view_appointment_history',
    // Patients (demographics only)
    'view_patient_list', 'view_patient_demographics', 'edit_patient_demographics',
    'create_patients', 'view_patient_insurance', 'edit_patient_insurance',
    'view_patient_documents', 'upload_patient_documents',
    // Communication
    'view_messages', 'send_messages', 'view_faxes',
    // Billing (copay only)
    'collect_copay', 'view_patient_balance',
    // Reports
    'view_dashboard',
  ],
}

// ── Role display config ──
export const ROLE_CONFIG: Record<Role, { label: string; color: string; bgColor: string; description: string }> = {
  doctor: {
    label: 'Provider',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/15',
    description: 'Full access to all features — sign charts, prescribe, manage practice',
  },
  nurse: {
    label: 'Nurse / MA',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/15',
    description: 'Clinical access — vitals, notes, labs, medications (no prescribing)',
  },
  assistant: {
    label: 'Medical Assistant',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    description: 'Scheduling, patient intake, notes, messages, basic billing',
  },
  admin: {
    label: 'Office Admin',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    description: 'Staff management, billing, settings, reports — no clinical signing',
  },
  billing: {
    label: 'Billing Staff',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    description: 'Claims, payments, refunds, fee schedules — no clinical access',
  },
  front_desk: {
    label: 'Front Desk',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/15',
    description: 'Check-in, scheduling, demographics, insurance — no clinical access',
  },
}

// ── Permission groups for UI display ──
// Each group shows a category with individual toggleable permissions
export const PERMISSION_GROUPS: {
  label: string
  icon: string
  description: string
  permissions: { key: Permission; label: string; description: string; sensitive?: boolean }[]
}[] = [
  {
    label: 'Scheduling & Appointments',
    icon: '📅',
    description: 'Calendar, booking, and appointment management',
    permissions: [
      { key: 'view_schedule', label: 'View Schedule', description: 'See the appointment calendar and daily schedule' },
      { key: 'view_appointments', label: 'View Appointment Details', description: 'See appointment info including reason for visit' },
      { key: 'create_appointments', label: 'Book Appointments', description: 'Schedule new patient appointments' },
      { key: 'edit_appointments', label: 'Edit Appointments', description: 'Modify appointment time, type, or notes' },
      { key: 'cancel_appointments', label: 'Cancel Appointments', description: 'Cancel existing appointments' },
      { key: 'complete_appointments', label: 'Complete Appointments', description: 'Mark appointments as completed' },
      { key: 'reschedule_appointments', label: 'Reschedule', description: 'Move appointments to different date/time' },
      { key: 'view_appointment_history', label: 'View History', description: 'See past appointment records' },
    ],
  },
  {
    label: 'Patient Records',
    icon: '👤',
    description: 'Patient demographics, documents, and personal information',
    permissions: [
      { key: 'view_patient_list', label: 'View Patient List', description: 'See the list of all patients' },
      { key: 'view_patient_demographics', label: 'View Demographics', description: 'See patient name, DOB, contact info, address' },
      { key: 'edit_patient_demographics', label: 'Edit Demographics', description: 'Update patient contact info and address' },
      { key: 'create_patients', label: 'Register Patients', description: 'Add new patients to the system' },
      { key: 'delete_patients', label: 'Delete Patients', description: 'Permanently remove patient records', sensitive: true },
      { key: 'view_patient_insurance', label: 'View Insurance', description: 'See patient insurance details and ID cards' },
      { key: 'edit_patient_insurance', label: 'Edit Insurance', description: 'Update insurance information' },
      { key: 'view_patient_history', label: 'View Medical History', description: 'See allergies, conditions, past diagnoses' },
      { key: 'view_patient_documents', label: 'View Documents', description: 'See uploaded files, consent forms, IDs' },
      { key: 'upload_patient_documents', label: 'Upload Documents', description: 'Add new documents to patient chart' },
      { key: 'delete_patient_documents', label: 'Delete Documents', description: 'Remove documents from patient chart', sensitive: true },
      { key: 'export_patient_data', label: 'Export Patient Data', description: 'Download or export patient records', sensitive: true },
    ],
  },
  {
    label: 'Clinical Notes & Charts',
    icon: '📋',
    description: 'SOAP notes, chart signing, addendums, and clinical documentation',
    permissions: [
      { key: 'view_clinical_notes', label: 'View Clinical Notes', description: 'Read SOAP notes, assessments, and plans' },
      { key: 'create_clinical_notes', label: 'Create Notes', description: 'Write new clinical notes and documentation' },
      { key: 'edit_clinical_notes', label: 'Edit Draft Notes', description: 'Modify notes that have not been signed' },
      { key: 'sign_clinical_notes', label: 'Sign/Lock Notes', description: 'E-sign clinical notes under provider name', sensitive: true },
      { key: 'cosign_clinical_notes', label: 'Co-sign Notes', description: 'Co-sign notes written by another staff member' },
      { key: 'lock_charts', label: 'Lock/Close Charts', description: 'Permanently close charts and generate PDFs', sensitive: true },
      { key: 'add_addendum', label: 'Add Addendum', description: 'Add addendum, late entry, or correction to closed charts' },
      { key: 'view_chart_audit', label: 'View Chart Audit Trail', description: 'See who accessed/modified chart and when' },
    ],
  },
  {
    label: 'Prescriptions & Medications',
    icon: '💊',
    description: 'Medication management, e-prescribing, and drug interactions',
    permissions: [
      { key: 'view_prescriptions', label: 'View Medications', description: 'See current and past medication lists' },
      { key: 'create_prescriptions', label: 'Create Prescriptions', description: 'Write new prescriptions (under provider name)', sensitive: true },
      { key: 'edit_prescriptions', label: 'Edit Prescriptions', description: 'Modify prescriptions before sending' },
      { key: 'send_erx', label: 'Send e-Prescriptions', description: 'Electronically transmit prescriptions to pharmacy', sensitive: true },
      { key: 'view_drug_interactions', label: 'Drug Interaction Alerts', description: 'See drug-drug interaction warnings' },
      { key: 'view_medication_history', label: 'Medication History', description: 'See full medication history including discontinued' },
    ],
  },
  {
    label: 'Lab Results & Orders',
    icon: '🔬',
    description: 'Laboratory orders, results, and acknowledgments',
    permissions: [
      { key: 'view_lab_results', label: 'View Lab Results', description: 'See incoming lab results and values' },
      { key: 'order_labs', label: 'Order Labs', description: 'Place new lab orders for patients' },
      { key: 'edit_lab_orders', label: 'Edit Lab Orders', description: 'Modify lab orders before submission' },
      { key: 'acknowledge_lab_results', label: 'Acknowledge Results', description: 'Mark lab results as reviewed' },
    ],
  },
  {
    label: 'Communication',
    icon: '💬',
    description: 'Messages, faxes, tasks, and the message center',
    permissions: [
      { key: 'view_messages', label: 'View Messages', description: 'Read incoming and sent messages' },
      { key: 'send_messages', label: 'Send Messages', description: 'Compose and send messages to patients or staff' },
      { key: 'view_faxes', label: 'View Faxes', description: 'See incoming fax documents' },
      { key: 'send_faxes', label: 'Send Faxes', description: 'Send outgoing faxes to pharmacies, referrals, etc.' },
      { key: 'manage_tasks', label: 'Manage Tasks', description: 'Create, assign, and complete tasks' },
      { key: 'access_message_center', label: 'Message Center Access', description: 'Full access to the message center hub' },
    ],
  },
  {
    label: 'Billing & Payments',
    icon: '💳',
    description: 'Claims, payments, refunds, fee schedules, and billing reports',
    permissions: [
      { key: 'view_billing', label: 'View Billing', description: 'See billing entries and claim status' },
      { key: 'edit_billing', label: 'Edit Billing', description: 'Modify billing codes, modifiers, and charges' },
      { key: 'submit_claims', label: 'Submit Claims', description: 'Send claims to insurance electronically' },
      { key: 'post_payments', label: 'Post Payments', description: 'Record insurance and patient payments' },
      { key: 'process_refunds', label: 'Process Refunds', description: 'Issue refunds to patients', sensitive: true },
      { key: 'view_fee_schedule', label: 'View Fee Schedule', description: 'See procedure fees and rates' },
      { key: 'edit_fee_schedule', label: 'Edit Fee Schedule', description: 'Modify fee schedules and pricing' },
      { key: 'view_billing_reports', label: 'Billing Reports', description: 'Access billing analytics and AR reports' },
      { key: 'view_patient_balance', label: 'View Patient Balance', description: 'See outstanding patient balances' },
      { key: 'collect_copay', label: 'Collect Copay', description: 'Process copay payments at check-in' },
    ],
  },
  {
    label: 'Telehealth & Video',
    icon: '📹',
    description: 'Video calls and telehealth session management',
    permissions: [
      { key: 'join_video_calls', label: 'Join Video Calls', description: 'Participate in telehealth video sessions' },
      { key: 'start_video_calls', label: 'Start Video Calls', description: 'Initiate new video consultations' },
      { key: 'view_video_recordings', label: 'View Recordings', description: 'Access saved video session recordings', sensitive: true },
    ],
  },
  {
    label: 'Reports & Analytics',
    icon: '📊',
    description: 'Dashboard, patient analytics, and practice reports',
    permissions: [
      { key: 'view_dashboard', label: 'View Dashboard', description: 'See the main dashboard with stats and notifications' },
      { key: 'view_patient_analytics', label: 'Patient Analytics', description: 'Population health and patient trend reports' },
      { key: 'view_practice_reports', label: 'Practice Reports', description: 'Practice-level performance and revenue analytics' },
      { key: 'export_reports', label: 'Export Reports', description: 'Download reports as CSV, PDF, or Excel', sensitive: true },
    ],
  },
  {
    label: 'Administration & Settings',
    icon: '⚙️',
    description: 'Staff management, permissions, system settings, and integrations',
    permissions: [
      { key: 'manage_staff', label: 'Manage Staff', description: 'Invite, deactivate, and remove staff members', sensitive: true },
      { key: 'manage_staff_permissions', label: 'Manage Permissions', description: 'Change staff roles and individual permissions', sensitive: true },
      { key: 'view_audit_log', label: 'View Audit Log', description: 'See all system actions and access logs' },
      { key: 'manage_settings', label: 'Practice Settings', description: 'Modify practice name, address, hours, branding' },
      { key: 'manage_office_hours', label: 'Office Hours', description: 'Set and modify office working hours' },
      { key: 'manage_appointment_types', label: 'Appointment Types', description: 'Configure visit types, durations, and pricing' },
      { key: 'manage_templates', label: 'Note Templates', description: 'Create and edit clinical note templates' },
      { key: 'manage_integrations', label: 'Integrations', description: 'Configure Stripe, Twilio, and other APIs', sensitive: true },
      { key: 'view_system_logs', label: 'System Logs', description: 'View technical logs and error reports' },
    ],
  },
  {
    label: 'Sensitive Data Access (HIPAA)',
    icon: '🔒',
    description: 'Access to specially protected health information — requires explicit authorization',
    permissions: [
      { key: 'view_ssn', label: 'View SSN', description: 'See patient Social Security Numbers', sensitive: true },
      { key: 'view_mental_health_notes', label: 'Mental Health Notes', description: 'Access behavioral and mental health records', sensitive: true },
      { key: 'view_substance_abuse', label: 'Substance Abuse Records', description: '42 CFR Part 2 protected substance abuse treatment records', sensitive: true },
      { key: 'view_hiv_status', label: 'HIV/STD Status', description: 'Access HIV testing and STD status records', sensitive: true },
      { key: 'view_genetic_data', label: 'Genetic Data', description: 'Access genetic testing results and data', sensitive: true },
      { key: 'break_glass_access', label: 'Break Glass (Emergency)', description: 'Emergency override to access restricted records — fully audited', sensitive: true },
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

// Count sensitive permissions a user has
export function countSensitivePermissions(userPermissions: Permission[]): number {
  const sensitiveKeys = PERMISSION_GROUPS.flatMap(g => g.permissions.filter(p => p.sensitive).map(p => p.key))
  return userPermissions.filter(p => sensitiveKeys.includes(p)).length
}

// Get total available permissions count
export function getTotalPermissionsCount(): number {
  return Object.values(PERMISSIONS).length
}
