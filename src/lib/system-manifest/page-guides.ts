import type { PageGuideConfig } from '@/components/PageGuide'

// ═══════════════════════════════════════════════════════════════
// PAGE GUIDE CONFIGS — One per page
// Each defines: features, system wiring, known fixes, tips
// ═══════════════════════════════════════════════════════════════

export const GUIDE_DASHBOARD: PageGuideConfig = {
  pageTitle: 'Doctor Dashboard',
  pageDescription: 'Central command center — KPIs, appointments, notifications, clinical inbox, and data health at a glance.',
  features: [
    { name: 'KPI Cards', description: 'Total patients, active patients, new this month, and avg appointments. Click "Total Patients" to jump to the patients page.', },
    { name: 'Data Stats Row', description: 'Shows live counts of medications (20,132), allergies (620), problems (1,401), and appointments (263) from the last backup sync.', },
    { name: 'Sync Now Button', description: 'Triggers a full server-side export of all patient data (5 data types) and saves to Supabase. No large file downloads to browser.', steps: ['Click "Sync Now" (teal button in action bar)', 'Wait for sync to complete (~5-10 seconds)', 'Data stats will auto-refresh with latest counts'] },
    { name: 'Download Backup', description: 'Downloads a full JSON backup of all patients + medications + allergies + problems + appointments to your local machine.', steps: ['Click "Download Backup" (purple button)', 'Browser downloads medazon-backup-YYYY-MM-DD.json (~7MB)', 'File contains all 6,968 patients with nested data'] },
    { name: 'Action Buttons', description: 'Quick access to Create Meeting Link, Start No-Call Review, Open Calendar, Manage Staff, and Chart Management.' },
    { name: 'Appointments & Notifications', description: 'Shows upcoming appointments and latest notifications in two columns below the KPIs.' },
  ],
  systemWiring: [
    { label: 'Dashboard Stats API', type: 'api', path: '/api/dashboard/stats' },
    { label: 'Cron Export (server-side sync)', type: 'api', path: '/api/cron-export' },
    { label: 'Export Patient Data (download)', type: 'api', path: '/api/export-patient-data' },
    { label: 'Patient Data Exports', type: 'table', path: 'patient_data_exports' },
    { label: 'Appointments Table', type: 'table', path: 'appointments' },
    { label: 'Patients Table', type: 'table', path: 'patients' },
    { label: 'Daily auto-sync at 6AM UTC', type: 'cron', path: '/api/cron-export' },
  ],
  knownFixes: [
    { id: 'FIX-004', title: 'Data export "unexpected token" error saving to database', status: 'fixed' },
  ],
  tips: [
    'If data stats show 0, click "Sync Now" to populate from DrChrono tables',
    'The backup auto-runs daily at 6AM UTC via Vercel Cron — no manual sync needed',
    'Download Backup creates a local JSON file as a safety net if Supabase is down',
  ],
}

export const GUIDE_APPOINTMENTS: PageGuideConfig = {
  pageTitle: 'Appointments Calendar',
  pageDescription: 'Full appointment management with drag-and-drop calendar, WorkspaceCanvas EHR panels, and video calls.',
  features: [
    { name: 'Calendar View', description: 'Shows appointments by day with status badges (pending=amber, accepted=green, completed=blue, cancelled=red).', steps: ['Use left/right arrows to navigate dates', 'Click any appointment card to open its workspace', 'Time slots shown in Phoenix timezone'] },
    { name: 'WorkspaceCanvas (EHR)', description: 'Opens when you click an appointment. Contains 28 EHR panel buttons in the toolbar — each opens a draggable/resizable panel.', steps: ['Click an appointment to open the workspace', 'Click any EHR button (Med Hx, Allergies, Problems, etc.)', 'Panel opens in the grid below — drag to rearrange', 'Click X on panel header to close it'] },
    { name: 'SOAP Notes', description: 'The main clinical documentation panel. Always visible when a workspace is open. Supports Subjective, Objective, Assessment, Plan sections.' },
    { name: 'Video Call', description: 'For video visits, a "Video Call" button appears. Uses Daily.co embedded video panel.' },
    { name: 'Status Management', description: 'Change appointment status (pending→accepted→completed), reschedule, or cancel directly from the workspace toolbar.' },
    { name: 'Chart Management', description: 'Sign, close, amend, or unlock patient charts. Draft→Preliminary→Signed→Closed workflow.' },
  ],
  systemWiring: [
    { label: 'Appointments API', type: 'api', path: '/api/appointments' },
    { label: 'WorkspaceCanvas', type: 'service', path: '/components/workspace/WorkspaceCanvas.tsx' },
    { label: '28 Panel APIs', type: 'api', path: '/api/panels/*' },
    { label: 'Chart Management API', type: 'api', path: '/api/chart' },
    { label: 'Appointments Table', type: 'table', path: 'appointments' },
    { label: 'Patients Table', type: 'table', path: 'patients' },
    { label: 'All DrChrono Tables', type: 'table', path: 'drchrono_*' },
  ],
  knownFixes: [
    { id: 'FIX-005', title: 'EHR panels not opening (wrong grid prop + missing panel entries)', status: 'fixed' },
    { id: 'FIX-006', title: 'Calendar availability stopping at 5PM', status: 'fixed' },
  ],
  tips: [
    'All 28 EHR panels fetch data from /api/panels/{name} with patient_id',
    'Panels use 3-tier fallback: Live DrChrono → Supabase backup → Static JSON',
    'The grid layout is react-grid-layout — drag panels by their header bar',
  ],
}

export const GUIDE_PATIENTS: PageGuideConfig = {
  pageTitle: 'Patient Management',
  pageDescription: 'Search, view, and manage all 6,968 patients. Opens full EHR workspace with all clinical panels.',
  features: [
    { name: 'Patient Search', description: 'Search by name, email, phone, or DOB. Uses fuzzy matching across the patients table.', steps: ['Type in the search bar at the top', 'Results appear as you type', 'Click a patient to select them'] },
    { name: 'Patient Detail View', description: 'Shows demographics, contact info, appointment history, and medications for the selected patient.' },
    { name: 'Open Clinical Panel', description: 'Opens the full WorkspaceCanvas with all 28 EHR panel buttons.', steps: ['Select a patient from the list', 'Click "Open Clinical Panel"', 'The workspace opens with SOAP notes and patient info', 'Click any EHR button to open additional panels'] },
    { name: 'Patient List', description: 'Paginated list of all patients with name, email, phone, last appointment, and status.' },
  ],
  systemWiring: [
    { label: 'Patient Detail API', type: 'api', path: '/api/patients/[id]' },
    { label: 'Patient Search API', type: 'api', path: '/api/patients/search' },
    { label: 'WorkspaceCanvas', type: 'service', path: '/components/workspace/WorkspaceCanvas.tsx' },
    { label: 'Patients Table', type: 'table', path: 'patients' },
    { label: 'DrChrono Patients', type: 'table', path: 'drchrono_patients' },
  ],
  knownFixes: [
    { id: 'FIX-005', title: 'Patients page was using old 7109-line modal instead of WorkspaceCanvas', status: 'fixed' },
    { id: 'FIX-008', title: 'DrChrono patient ID often NULL — uses email fallback', status: 'fixed' },
  ],
}

export const GUIDE_STAFF_HUB: PageGuideConfig = {
  pageTitle: 'Staff Hub',
  pageDescription: 'Manage clinical staff, assign roles, track tasks, and communicate with your team.',
  features: [
    { name: 'Staff List', description: 'View all staff members with their roles, contact info, and active/inactive status.' },
    { name: 'Role Management', description: 'Assign roles like Doctor, Nurse, Admin, Receptionist. Roles control access via RBAC system.' },
    { name: 'Task Assignment', description: 'Create and assign tasks to staff. Track completion status and due dates.' },
    { name: 'Staff Messaging', description: 'Internal messaging between staff members. Separate from patient communication.' },
    { name: 'Call Tracking', description: 'Log staff calls with timestamps and notes for audit compliance.' },
  ],
  systemWiring: [
    { label: 'Staff Tasks API', type: 'api', path: '/api/staff-tasks' },
    { label: 'Staff Messages API', type: 'api', path: '/api/staff-messages' },
    { label: 'Staff Calls API', type: 'api', path: '/api/staff-calls' },
    { label: 'Staff Notifications', type: 'api', path: '/api/staff-notifications' },
    { label: 'RBAC System', type: 'service', path: '/lib/rbac.ts' },
  ],
  tips: [
    'Staff roles are managed via the RBAC system in /lib/rbac.ts',
    'All staff actions are logged for HIPAA audit compliance',
  ],
}

export const GUIDE_CHART_MANAGEMENT: PageGuideConfig = {
  pageTitle: 'Chart Management',
  pageDescription: 'Sign, close, amend, and audit patient charts. HIPAA-compliant workflow with locked chart protections.',
  features: [
    { name: 'Chart Status Workflow', description: 'Charts flow through: Draft → Preliminary → Signed → Closed. Each transition is logged.', steps: ['Open a patient chart from appointments or patients page', 'Review SOAP notes and clinical data', 'Click "Sign Chart" to lock it', 'Signed charts require unlock reason to edit'] },
    { name: 'Bulk Chart Actions', description: 'Process multiple charts at once — sign all draft charts, close all signed charts, etc.' },
    { name: 'Chart Audit Trail', description: 'Every sign, close, amend, and unlock action is logged with who, when, and why.' },
    { name: 'Chart Locking', description: 'Signed/Closed charts are read-only. Unlock requires a documented reason (HIPAA requirement).' },
  ],
  systemWiring: [
    { label: 'Chart Management API', type: 'api', path: '/api/chart' },
    { label: 'Audit Log System', type: 'service', path: '/lib/audit.ts' },
    { label: 'Clinical Notes Table', type: 'table', path: 'clinical_notes' },
    { label: 'Appointments Table', type: 'table', path: 'appointments' },
  ],
  tips: [
    'Once a chart is signed, all EHR panels become read-only',
    'Unlock requires a written reason — this is logged for HIPAA compliance',
    'The chart status badge appears in the workspace toolbar header',
  ],
}

export const GUIDE_COMMUNICATION: PageGuideConfig = {
  pageTitle: 'Communication Hub',
  pageDescription: 'Multi-channel patient communication — SMS, email, and in-app messaging.',
  features: [
    { name: 'SMS Messaging', description: 'Send SMS to patients via Twilio integration. Supports appointment reminders, follow-ups, and custom messages.', steps: ['Select a patient or conversation', 'Type your message', 'Click Send — delivered via Twilio SMS', 'Message is logged in the conversation thread'] },
    { name: 'Email Communication', description: 'Send emails to patients via Gmail/SMTP integration. Supports templates for common scenarios.' },
    { name: 'Conversation Threads', description: 'All messages (SMS + email) are organized by patient in conversation threads with full history.' },
    { name: 'Message Templates', description: 'Pre-built templates for appointment reminders, follow-up instructions, medication refill notifications.' },
  ],
  systemWiring: [
    { label: 'Twilio SMS Service', type: 'service', path: '/lib/twilio.ts' },
    { label: 'Gmail Integration', type: 'service', path: '/lib/gmail.ts' },
    { label: 'Email Service', type: 'service', path: '/lib/email.ts' },
    { label: 'Messenger API', type: 'api', path: '/api/messenger' },
    { label: 'Send Email API', type: 'api', path: '/api/send-email' },
  ],
  tips: [
    'SMS uses Twilio — make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are in Vercel env vars',
    'All patient communications are logged for HIPAA compliance',
  ],
}

export const GUIDE_DATA_EXPORT: PageGuideConfig = {
  pageTitle: 'Data Export',
  pageDescription: 'Full backup system with 3-tier fallback. Export all patient data including medications, allergies, problems, and appointments.',
  features: [
    { name: 'Sync & Save', description: 'Triggers server-side export of all 5 data types and saves to Supabase patient_data_exports table.', steps: ['Click "Sync & Save to Database"', 'Server fetches all data from DrChrono tables', 'Builds full patient objects with nested arrays', 'Saves to patient_data_exports (UUID: 00000000-0000-0000-0000-000000000001)'] },
    { name: 'Download JSON', description: 'Downloads the full backup as a JSON file to your computer (~7MB).' },
    { name: '3-Tier Fallback', description: 'Tier 1: Live DrChrono query. Tier 2: Supabase patient_data_exports table. Tier 3: Static JSON file baked into the app at /public/data/patient-medications.json.' },
    { name: 'Auto-Sync Cron', description: 'Runs automatically at 6AM UTC daily via Vercel Cron. No manual intervention needed.' },
  ],
  systemWiring: [
    { label: 'Cron Export API', type: 'api', path: '/api/cron-export' },
    { label: 'Export Patient Data API', type: 'api', path: '/api/export-patient-data' },
    { label: 'Export Fallback Helper', type: 'service', path: '/lib/export-fallback.ts' },
    { label: 'Patient Data Exports', type: 'table', path: 'patient_data_exports' },
    { label: 'Static JSON Fallback', type: 'service', path: '/public/data/patient-medications.json' },
    { label: 'Daily 6AM UTC Cron', type: 'cron', path: 'vercel.json → /api/cron-export' },
  ],
  knownFixes: [
    { id: 'FIX-003', title: 'Wrong column names in allergies/problems export', status: 'fixed' },
    { id: 'FIX-004', title: 'Save to database "unexpected token" error', status: 'fixed' },
  ],
}

export const GUIDE_ADMIN_BUGS: PageGuideConfig = {
  pageTitle: 'Bug Reports & Admin',
  pageDescription: 'Manage bug reports, view system issues, and track resolutions.',
  features: [
    { name: 'Bug Report List', description: 'View all submitted bug reports with status (open, investigating, resolved, closed).' },
    { name: 'Video Recording', description: 'Staff can record video bug reports directly in the browser for visual debugging.' },
    { name: 'Priority Tracking', description: 'Bugs are prioritized as critical, high, medium, or low.' },
  ],
  systemWiring: [
    { label: 'Bug Reports API', type: 'api', path: '/api/bug-reports' },
    { label: 'Bugsy System', type: 'service', path: '/lib/bugsy/' },
  ],
}

export const GUIDE_PRESCRIPTIONS: PageGuideConfig = {
  pageTitle: 'Prescriptions',
  pageDescription: 'Manage and track all patient prescriptions. Integrates with DrChrono eRx system.',
  features: [
    { name: 'Prescription List', description: 'View all prescriptions with medication name, dosage, patient, status, and date.' },
    { name: 'eRx Integration', description: 'Send electronic prescriptions via DrChrono eRx. Includes controlled substance detection.' },
    { name: 'Refill Management', description: 'Process refill requests with automatic controlled substance flagging.' },
  ],
  systemWiring: [
    { label: 'Prescriptions API', type: 'api', path: '/api/prescriptions' },
    { label: 'Fast Prescriptions API', type: 'api', path: '/api/prescriptions-fast' },
    { label: 'Panel: Prescriptions', type: 'api', path: '/api/panels/prescriptions' },
    { label: 'DrChrono Medications', type: 'table', path: 'drchrono_medications' },
  ],
}

export const GUIDE_LABS: PageGuideConfig = {
  pageTitle: 'Lab Orders',
  pageDescription: 'Order labs, track results, and review lab history for patients.',
  features: [
    { name: 'Lab Orders', description: 'Create and send lab orders. Track order status from ordered to resulted.' },
    { name: 'Results Review', description: 'View lab results with normal ranges, flagged values, and trending.' },
  ],
  systemWiring: [
    { label: 'Lab Results Panel API', type: 'api', path: '/api/panels/lab-results' },
    { label: 'DrChrono Lab Orders', type: 'table', path: 'drchrono_lab_orders' },
    { label: 'DrChrono Lab Results', type: 'table', path: 'drchrono_lab_results' },
  ],
}

export const GUIDE_BILLING: PageGuideConfig = {
  pageTitle: 'Billing',
  pageDescription: 'Patient billing, payment tracking, and insurance claims management.',
  features: [
    { name: 'Payment Processing', description: 'Stripe integration for collecting payments. Supports one-time and recurring.' },
    { name: 'Invoice Management', description: 'Generate and track invoices for appointments and services.' },
    { name: 'Insurance Claims', description: 'Track insurance claim status and EOB (Explanation of Benefits).' },
  ],
  systemWiring: [
    { label: 'Billing Panel API', type: 'api', path: '/api/panels/billing' },
    { label: 'Stripe Integration', type: 'service', path: '/lib/stripe.ts' },
    { label: 'Payment Service', type: 'service', path: '/lib/payment.ts' },
  ],
}

export const GUIDE_AVAILABILITY: PageGuideConfig = {
  pageTitle: 'Availability Management',
  pageDescription: 'Set recurring weekly hours, block off dates, and manage appointment availability.',
  features: [
    { name: 'Weekly Hours', description: 'Set recurring availability for each day of the week. Currently 9AM-10PM all 7 days.', steps: ['Select a day of the week', 'Set start and end times', 'Toggle availability on/off per day'] },
    { name: 'Date Overrides', description: 'Block specific dates (vacations, holidays) or add extra availability for special days.' },
    { name: 'Calendar Preview', description: 'Preview how your availability looks to patients on the booking calendar.' },
  ],
  systemWiring: [
    { label: 'Doctor Availability Table', type: 'table', path: 'doctor_availability' },
    { label: 'Availability Batch API', type: 'api', path: '/api/appointments/availability-batch' },
  ],
  knownFixes: [
    { id: 'FIX-006', title: 'Availability was 9-5 instead of 9-10PM', status: 'fixed' },
  ],
}

export const GUIDE_SETTINGS: PageGuideConfig = {
  pageTitle: 'Settings',
  pageDescription: 'System configuration, integrations, and admin tools.',
  features: [
    { name: 'DrChrono Integration', description: 'OAuth connection to DrChrono EHR. Syncs patients, medications, allergies, problems, and appointments.' },
    { name: 'Notification Settings', description: 'Configure email, SMS, and push notification preferences.' },
    { name: 'System Health', description: 'Access the full system health dashboard from the admin sidebar.' },
  ],
  systemWiring: [
    { label: 'DrChrono OAuth', type: 'service', path: '/lib/drchrono.ts' },
    { label: 'DrChrono Sync API', type: 'api', path: '/api/drchrono/cron-sync' },
    { label: 'Environment Check', type: 'api', path: '/api/env-check' },
  ],
}

export const GUIDE_ALERTS: PageGuideConfig = {
  pageTitle: 'Clinical Alerts',
  pageDescription: 'Clinical decision support alerts, drug interactions, and patient safety notifications.',
  features: [
    { name: 'Alert Dashboard', description: 'View all active clinical alerts grouped by severity and type.' },
    { name: 'Drug Interaction Checks', description: 'Automatic checking for drug interactions when prescribing.' },
  ],
  systemWiring: [
    { label: 'Alerts Panel API', type: 'api', path: '/api/panels/alerts' },
    { label: 'CDSS API', type: 'api', path: '/api/cdss' },
  ],
}

export const GUIDE_REPORTS: PageGuideConfig = {
  pageTitle: 'Reports',
  pageDescription: 'Analytics and reporting for appointments, revenue, patient outcomes, and quality measures.',
  features: [
    { name: 'Appointment Analytics', description: 'View appointment volume, no-show rates, and scheduling patterns.' },
    { name: 'Revenue Reports', description: 'Track revenue by service type, payment method, and time period.' },
  ],
  systemWiring: [
    { label: 'Dashboard Stats API', type: 'api', path: '/api/dashboard/stats' },
    { label: 'Appointments Table', type: 'table', path: 'appointments' },
  ],
}

export const GUIDE_REFERRALS: PageGuideConfig = {
  pageTitle: 'Referrals',
  pageDescription: 'Manage patient referrals to specialists and follow-up tracking.',
  features: [
    { name: 'Referral Management', description: 'Create, track, and close referrals to specialists.' },
    { name: 'Follow-Up Tracking', description: 'Track referral outcomes and ensure follow-up completion.' },
  ],
  systemWiring: [
    { label: 'Referrals Panel API', type: 'api', path: '/api/panels/referrals' },
  ],
}

export const GUIDE_QUALITY: PageGuideConfig = {
  pageTitle: 'Quality Measures',
  pageDescription: 'Track clinical quality metrics and regulatory compliance.',
  features: [
    { name: 'Quality Dashboard', description: 'View quality measure scores and compliance status.' },
    { name: 'MIPS/MACRA Tracking', description: 'Track CMS quality reporting requirements.' },
  ],
  systemWiring: [
    { label: 'Quality Measures Panel API', type: 'api', path: '/api/panels/quality-measures' },
  ],
}

export const GUIDE_AI_ASSISTANT: PageGuideConfig = {
  pageTitle: 'AI Assistant',
  pageDescription: 'AI-powered clinical decision support and documentation assistance.',
  features: [
    { name: 'Clinical Q&A', description: 'Ask clinical questions and get evidence-based answers.' },
    { name: 'Note Generation', description: 'AI-assisted SOAP note generation from appointment data.' },
    { name: 'Scribe Integration', description: 'Real-time transcription and note-taking during appointments.' },
  ],
  systemWiring: [
    { label: 'AI Interactions Panel API', type: 'api', path: '/api/panels/ai-interactions' },
    { label: 'Scribe API', type: 'api', path: '/api/scribe' },
    { label: 'Transcribe API', type: 'api', path: '/api/transcribe' },
  ],
}

export const GUIDE_PROFILE: PageGuideConfig = {
  pageTitle: 'Profile & Credentials',
  pageDescription: 'Manage your doctor profile, credentials, NPI, licenses, and practice information.',
  features: [
    { name: 'Profile Management', description: 'Update your name, specialty, bio, and contact information.' },
    { name: 'Credentials', description: 'Manage NPI, DEA, state licenses, and board certifications.' },
  ],
  systemWiring: [
    { label: 'Doctors Table', type: 'table', path: 'doctors' },
  ],
}
