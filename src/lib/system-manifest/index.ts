// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — SYSTEM MANIFEST
// Single source of truth for every system, wiring, and fix pattern.
// Every page, API, table connection, and known failure mode documented.
// Used by: System Health API, Auto-Fix engine, Admin Fix Log
// ═══════════════════════════════════════════════════════════════

// ── KNOWN FIX PATTERNS ──────────────────────────────────────
// These are fixes we've applied during the build. If the same
// issue recurs, the auto-fix engine can re-apply them.
export interface FixPattern {
  id: string
  title: string
  symptoms: string[]           // What the doctor/admin would see
  rootCause: string
  fix: string
  sqlFix?: string              // SQL to run if applicable
  apiFix?: string              // API endpoint to call
  dateFixed: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'rls' | 'api' | 'data' | 'ui' | 'auth' | 'deploy' | 'column' | 'config'
}

export const FIX_HISTORY: FixPattern[] = [
  {
    id: 'FIX-001',
    title: 'RLS blocking all DrChrono table reads',
    symptoms: ['No medications found', 'Empty allergies panel', 'Problems panel blank', '0 results from drchrono_* tables'],
    rootCause: 'Row Level Security policies with USING(false) blocked service role key reads on drchrono_medications, drchrono_allergies, drchrono_problems, drchrono_appointments, and 14 other drchrono_* tables',
    fix: 'Disabled RLS on all drchrono_* tables permanently. Service role key bypasses RLS but USING(false) was blocking even service role in some Supabase configs.',
    sqlFix: `ALTER TABLE drchrono_medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_allergies DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_problems DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_clinical_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_lab_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_lab_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_vaccines DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_procedures DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_care_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_amendments DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_prescription_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_implantable_devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_line_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_eligibility_checks DISABLE ROW LEVEL SECURITY;
ALTER TABLE drchrono_sync_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE patient_medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE medication_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE patient_data_exports DISABLE ROW LEVEL SECURITY;`,
    dateFixed: '2026-02-17',
    severity: 'critical',
    category: 'rls',
  },
  {
    id: 'FIX-002',
    title: 'Medications API querying wrong tables',
    symptoms: ['No medications found in Rx Refill', 'Express checkout shows 0 meds'],
    rootCause: 'API was querying medication_history and patient_medications instead of drchrono_medications where the 20,132 actual medications live',
    fix: 'Rewrote medications API to query drchrono_medications as primary source with 7 fallback sources',
    dateFixed: '2026-02-17',
    severity: 'critical',
    category: 'api',
  },
  {
    id: 'FIX-003',
    title: 'Wrong column names in allergies/problems export',
    symptoms: ['Export shows null allergy names', 'Problems missing ICD codes'],
    rootCause: 'drchrono_allergies uses "reaction" not "description" for allergy name. drchrono_problems uses "icd_code" and "date_diagnosis" not "date_onset"',
    fix: 'Updated export API to use correct column names: reaction (allergies), icd_code + date_diagnosis (problems)',
    dateFixed: '2026-02-17',
    severity: 'high',
    category: 'column',
  },
  {
    id: 'FIX-004',
    title: 'Data export "unexpected token" error saving to database',
    symptoms: ['Sync Now button fails', '"unexpected token r" error', 'Export not saving'],
    rootCause: '/api/export-patient-data returns ~7MB JSON. Browser parsed it then tried to re-upload via Supabase client SDK — too large for single request',
    fix: 'Changed Sync Now to call /api/cron-export which fetches + saves entirely server-side. No large payload transferred to browser.',
    dateFixed: '2026-02-17',
    severity: 'high',
    category: 'api',
  },
  {
    id: 'FIX-005',
    title: 'EHR panels not opening when toolbar buttons clicked',
    symptoms: ['Clicking Med Hx / Meds / Allergies does nothing', 'Panels dont open', 'No grid items appear'],
    rootCause: 'Three issues: (1) dragConfig={{handle}} is wrong prop — correct is draggableHandle=".grid-drag-handle". (2) lab-results-inline and referrals-followup had no PANEL_CONTENT entry. (3) Patients page used old 7109-line AppointmentDetailModal instead of WorkspaceCanvas.',
    fix: 'Fixed prop name, added missing panel entries, switched patients page to WorkspaceCanvas',
    dateFixed: '2026-02-17',
    severity: 'critical',
    category: 'ui',
  },
  {
    id: 'FIX-006',
    title: 'Calendar availability stopping at 5PM',
    symptoms: ['No time slots after 5 PM', 'Patients cant book evening appointments'],
    rootCause: 'doctor_availability table had recurring hours set to 09:00-17:00 from initial setup. Default 9am-10pm fallback never triggered because rows existed.',
    fix: 'Updated all doctor_availability rows to 09:00-22:00 via SQL UPDATE',
    sqlFix: `UPDATE doctor_availability SET start_time = '09:00:00', end_time = '22:00:00' WHERE doctor_id = '1fd1af57-5529-4d00-a301-e653b4829efc' AND is_available = true;`,
    dateFixed: '2026-02-17',
    severity: 'high',
    category: 'data',
  },
  {
    id: 'FIX-007',
    title: 'Vercel deploying wrong branch / not picking up commits',
    symptoms: ['Changes not appearing on live site', 'Old version still showing'],
    rootCause: 'Patient panel was tracking "production" branch, doctor panel was on "enterprise-workspace". Vercel production branch setting didnt match git push branch.',
    fix: 'Standardized both repos to push to "master" branch. Vercel production branch set to master.',
    dateFixed: '2026-02-17',
    severity: 'high',
    category: 'deploy',
  },
  {
    id: 'FIX-008',
    title: 'DrChrono patient ID often NULL in panel APIs',
    symptoms: ['Panel shows no DrChrono data', 'drchrono_patient_id is null'],
    rootCause: 'patients.drchrono_patient_id is NULL for many patients. Panel APIs need email fallback to find DrChrono data.',
    fix: 'All panel APIs use _shared.ts getDrchronoPatientId() which tries patients.drchrono_patient_id first, then falls back to email match in drchrono_patients table.',
    dateFixed: '2026-02-17',
    severity: 'high',
    category: 'data',
  },
  {
    id: 'FIX-009',
    title: 'Turbopack build error blocking Vercel deployment',
    symptoms: ['Vercel build fails', 'turbopack config error'],
    rootCause: 'Next.js 16 defaults to Turbopack but errors when webpack config exists without turbopack config',
    fix: 'Added empty turbopack: {} to next.config to satisfy Next.js 16',
    dateFixed: '2026-02-17',
    severity: 'medium',
    category: 'deploy',
  },
]

// ── SYSTEM WIRING MAP ───────────────────────────────────────
// Every system, what it connects to, what tables it reads/writes
export interface SystemNode {
  id: string
  name: string
  type: 'page' | 'api' | 'panel' | 'cron' | 'service' | 'table'
  path?: string
  description: string
  dependencies: string[]       // IDs of other SystemNodes this depends on
  tables?: string[]            // Supabase tables read/written
  apiEndpoints?: string[]      // API routes called
  knownIssues?: string[]       // FIX-xxx IDs of known issues
  healthCheck?: string         // Endpoint to check if healthy
}

export const SYSTEM_MAP: SystemNode[] = [
  // ═══ PAGES ═══
  { id: 'page-dashboard', name: 'Doctor Dashboard', type: 'page', path: '/doctor/dashboard',
    description: 'Main dashboard with KPIs, appointments, notifications, clinical inbox, revenue, data stats',
    dependencies: ['api-dashboard-stats', 'api-cron-export'],
    tables: ['appointments', 'notifications', 'patients', 'patient_data_exports'],
    apiEndpoints: ['/api/dashboard/stats', '/api/cron-export', '/api/export-patient-data'],
    knownIssues: ['FIX-004'],
  },
  { id: 'page-appointments', name: 'Appointments Calendar', type: 'page', path: '/doctor/appointments',
    description: 'Full appointment calendar with WorkspaceCanvas. Opens EHR panels for any appointment.',
    dependencies: ['workspace-canvas', 'api-appointments'],
    tables: ['appointments', 'patients', 'doctors', 'doctor_availability'],
    knownIssues: ['FIX-005', 'FIX-006'],
  },
  { id: 'page-patients', name: 'Patient Management', type: 'page', path: '/doctor/patients',
    description: 'Patient list, search, detail view. Opens WorkspaceCanvas with all EHR panels.',
    dependencies: ['workspace-canvas', 'api-patients'],
    tables: ['patients', 'appointments', 'drchrono_patients'],
    knownIssues: ['FIX-005', 'FIX-008'],
  },
  { id: 'page-express-checkout', name: 'Express Checkout (Patient)', type: 'page', path: '/express-checkout',
    description: '4 visit types (Instant/Refill/Video/Phone), dynamic pricing, medication selector, Stripe payment',
    dependencies: ['api-medications', 'api-availability', 'stripe'],
    tables: ['patients', 'appointments', 'drchrono_medications'],
    knownIssues: ['FIX-001', 'FIX-002'],
  },
  { id: 'page-data-export', name: 'Data Export', type: 'page', path: '/doctor/data-export',
    description: 'Full backup page with sync, download, and status overview',
    dependencies: ['api-cron-export', 'api-export-patient-data'],
    tables: ['patient_data_exports'],
    knownIssues: ['FIX-004'],
  },

  // ═══ WORKSPACE ═══
  { id: 'workspace-canvas', name: 'WorkspaceCanvas (EHR)', type: 'service', path: '/components/workspace/WorkspaceCanvas.tsx',
    description: '28 EHR panel buttons in toolbar. Opens panels in react-grid-layout. Used by appointments + patients pages.',
    dependencies: ['panel-medications', 'panel-allergies', 'panel-problems', 'panel-appointments',
      'panel-demographics', 'panel-vitals', 'panel-clinical-notes', 'panel-lab-results',
      'panel-immunizations', 'panel-documents', 'panel-history', 'panel-pharmacy',
      'panel-care-plans', 'panel-billing', 'panel-comm-hub', 'panel-chart-management',
      'panel-prior-auth', 'panel-insurance', 'panel-alerts', 'panel-ai-interactions',
      'panel-quality-measures', 'panel-cohorts', 'panel-medication-history',
      'panel-orders', 'panel-prescription-history'],
    knownIssues: ['FIX-005'],
  },

  // ═══ EHR PANELS (each calls /api/panels/{endpoint}) ═══
  { id: 'panel-medications', name: 'Medications Panel', type: 'panel',
    description: 'Active medications with DrChrono merge + export fallback',
    dependencies: ['api-panel-medications'], tables: ['drchrono_medications', 'patient_medications'],
    apiEndpoints: ['/api/panels/medications'], knownIssues: ['FIX-001', 'FIX-002'] },
  { id: 'panel-allergies', name: 'Allergies Panel', type: 'panel',
    description: 'Patient allergies with severity badges',
    dependencies: ['api-panel-allergies'], tables: ['drchrono_allergies', 'patient_allergies'],
    apiEndpoints: ['/api/panels/allergies'], knownIssues: ['FIX-001', 'FIX-003'] },
  { id: 'panel-problems', name: 'Problems Panel', type: 'panel',
    description: 'Active problems/diagnoses with ICD codes',
    dependencies: ['api-panel-problems'], tables: ['drchrono_problems', 'patient_problems'],
    apiEndpoints: ['/api/panels/problems'], knownIssues: ['FIX-001', 'FIX-003'] },
  { id: 'panel-appointments', name: 'Appointments Panel', type: 'panel',
    description: 'Patient appointment history',
    dependencies: ['api-panel-appointments'], tables: ['appointments', 'drchrono_appointments'],
    apiEndpoints: ['/api/panels/patient-appointments'] },
  { id: 'panel-demographics', name: 'Demographics Panel', type: 'panel',
    description: 'Patient demographics with DrChrono merge',
    dependencies: ['api-panel-demographics'], tables: ['patients', 'drchrono_patients'],
    apiEndpoints: ['/api/panels/demographics'] },
  { id: 'panel-vitals', name: 'Vitals Panel', type: 'panel',
    description: 'Patient vitals history',
    dependencies: ['api-panel-vitals'], tables: ['patient_vitals'],
    apiEndpoints: ['/api/panels/vitals'] },
  { id: 'panel-clinical-notes', name: 'Clinical Notes Panel', type: 'panel',
    description: 'SOAP notes and clinical documentation',
    dependencies: ['api-panel-clinical-notes'], tables: ['clinical_notes'],
    apiEndpoints: ['/api/panels/clinical-notes'] },
  { id: 'panel-lab-results', name: 'Lab Results Panel', type: 'panel',
    description: 'Lab orders and results',
    dependencies: ['api-panel-lab-results'], tables: ['drchrono_lab_orders', 'drchrono_lab_results'],
    apiEndpoints: ['/api/panels/lab-results'] },
  { id: 'panel-medication-history', name: 'Medication History Panel', type: 'panel',
    description: 'Full medication history with timeline',
    dependencies: ['api-panel-medication-history'], tables: ['drchrono_medications', 'medication_history'],
    apiEndpoints: ['/api/panels/medication-history'], knownIssues: ['FIX-001'] },
  { id: 'panel-prescription-history', name: 'Prescription History Panel', type: 'panel',
    description: 'Prescription history',
    dependencies: ['api-panel-prescriptions'], tables: ['drchrono_medications'],
    apiEndpoints: ['/api/panels/prescriptions'] },
  { id: 'panel-orders', name: 'Orders Panel', type: 'panel',
    description: 'Clinical orders management',
    dependencies: ['api-panel-orders'], tables: ['clinical_orders'],
    apiEndpoints: ['/api/panels/orders'] },
  { id: 'panel-immunizations', name: 'Immunizations Panel', type: 'panel',
    description: 'Immunization records', dependencies: ['api-panel-immunizations'],
    tables: ['drchrono_vaccines'], apiEndpoints: ['/api/panels/immunizations'] },
  { id: 'panel-documents', name: 'Documents Panel', type: 'panel',
    description: 'Patient documents', dependencies: ['api-panel-documents'],
    tables: ['drchrono_documents', 'patient_documents'], apiEndpoints: ['/api/panels/documents'] },
  { id: 'panel-history', name: 'History Panels (Family/Social/Surgical)', type: 'panel',
    description: 'Patient history records', dependencies: ['api-panel-history'],
    apiEndpoints: ['/api/panels/history'] },
  { id: 'panel-pharmacy', name: 'Pharmacy Panel', type: 'panel',
    description: 'Preferred pharmacy', dependencies: ['api-panel-pharmacy'],
    apiEndpoints: ['/api/panels/pharmacy'] },
  { id: 'panel-care-plans', name: 'Care Plans Panel', type: 'panel',
    description: 'Care plans', dependencies: ['api-panel-care-plans'],
    apiEndpoints: ['/api/panels/care-plans'] },
  { id: 'panel-billing', name: 'Billing Panel', type: 'panel',
    description: 'Billing and payments', dependencies: ['api-panel-billing'],
    apiEndpoints: ['/api/panels/billing'] },
  { id: 'panel-comm-hub', name: 'Communications Hub', type: 'panel',
    description: 'SMS, email, messaging', dependencies: ['api-panel-comm-hub'],
    apiEndpoints: ['/api/panels/comm-hub'] },
  { id: 'panel-chart-management', name: 'Chart Management Panel', type: 'panel',
    description: 'Sign/close/amend charts', dependencies: ['api-chart'],
    apiEndpoints: ['/api/chart'] },
  { id: 'panel-prior-auth', name: 'Prior Auth Panel', type: 'panel',
    description: 'Prior authorization', dependencies: ['api-panel-prior-auth'],
    apiEndpoints: ['/api/panels/prior-auth'] },
  { id: 'panel-insurance', name: 'Insurance Panel', type: 'panel',
    description: 'Insurance info', dependencies: ['api-panel-insurance'],
    apiEndpoints: ['/api/panels/insurance'] },
  { id: 'panel-alerts', name: 'Alerts Panel', type: 'panel',
    description: 'Clinical alerts', dependencies: ['api-panel-alerts'],
    apiEndpoints: ['/api/panels/alerts'] },
  { id: 'panel-ai-interactions', name: 'AI Assistant Panel', type: 'panel',
    description: 'AI clinical decision support', dependencies: ['api-panel-ai-interactions'],
    apiEndpoints: ['/api/panels/ai-interactions'] },
  { id: 'panel-quality-measures', name: 'Quality Measures Panel', type: 'panel',
    description: 'Quality metrics', dependencies: ['api-panel-quality-measures'],
    apiEndpoints: ['/api/panels/quality-measures'] },
  { id: 'panel-cohorts', name: 'Cohorts Panel', type: 'panel',
    description: 'Patient cohorts', dependencies: ['api-panel-cohorts'],
    apiEndpoints: ['/api/panels/cohorts'] },

  // ═══ CRON / AUTOMATION ═══
  { id: 'cron-export', name: 'Daily Data Export Cron', type: 'cron', path: '/api/cron-export',
    description: 'Runs daily at 6AM UTC. Exports all patients + meds + allergies + problems + appointments to patient_data_exports table.',
    dependencies: [], tables: ['drchrono_patients', 'drchrono_medications', 'drchrono_allergies', 'drchrono_problems', 'drchrono_appointments', 'patient_data_exports'],
  },
  { id: 'cron-drchrono-sync', name: 'DrChrono Sync Cron', type: 'cron', path: '/api/drchrono/cron-sync',
    description: 'Runs every 30 minutes. Syncs all DrChrono entities.',
    dependencies: [], tables: ['drchrono_sync_log'],
  },

  // ═══ CORE DATA ═══
  { id: 'data-export-system', name: '3-Tier Fallback System', type: 'service',
    description: 'Tier 1: Live DrChrono query. Tier 2: Supabase patient_data_exports. Tier 3: Static /public/data/patient-medications.json (4.3MB baked into app). Ensures data access even without internet.',
    dependencies: ['cron-export'],
    tables: ['patient_data_exports', 'drchrono_medications', 'drchrono_allergies', 'drchrono_problems', 'drchrono_appointments'],
  },
]

// ── HEALTH CHECK DEFINITIONS ────────────────────────────────
export interface HealthCheck {
  id: string
  name: string
  type: 'api' | 'table' | 'count' | 'rls'
  endpoint?: string
  table?: string
  minCount?: number
  expectStatus?: number
}

export const HEALTH_CHECKS: HealthCheck[] = [
  { id: 'hc-dashboard', name: 'Dashboard API', type: 'api', endpoint: '/api/dashboard/stats', expectStatus: 200 },
  { id: 'hc-patients-count', name: 'Patients table', type: 'count', table: 'patients', minCount: 6000 },
  { id: 'hc-medications-count', name: 'Medications table', type: 'count', table: 'drchrono_medications', minCount: 20000 },
  { id: 'hc-allergies-count', name: 'Allergies table', type: 'count', table: 'drchrono_allergies', minCount: 600 },
  { id: 'hc-problems-count', name: 'Problems table', type: 'count', table: 'drchrono_problems', minCount: 1300 },
  { id: 'hc-appointments-count', name: 'Appointments table', type: 'count', table: 'drchrono_appointments', minCount: 250 },
  { id: 'hc-export-fresh', name: 'Export freshness', type: 'count', table: 'patient_data_exports', minCount: 1 },
  // Panel APIs
  ...['medications', 'allergies', 'problems', 'patient-appointments', 'demographics',
    'vitals', 'clinical-notes', 'lab-results', 'medication-history', 'prescriptions',
    'orders', 'immunizations', 'documents', 'history', 'pharmacy', 'care-plans',
    'billing', 'prior-auth', 'insurance', 'alerts', 'ai-interactions', 'quality-measures', 'cohorts'
  ].map(ep => ({
    id: `hc-panel-${ep}`, name: `Panel: ${ep}`, type: 'api' as const,
    endpoint: `/api/panels/${ep}?patient_id=test`, expectStatus: 400, // 400 = API exists, needs real patient_id
  })),
]
