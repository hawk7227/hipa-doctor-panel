#!/usr/bin/env node

/**
 * stamp-manifest.js
 * Adds @build-manifest headers to all source files and BUILD_HISTORY
 * footers to critical files. Safe to run multiple times — skips files
 * that already have the stamp.
 *
 * Usage: node scripts/stamp-manifest.js
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

const HEADER_TS = `// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
`

// Critical files get detailed BUILD_HISTORY footers
const BUILD_HISTORIES = {
  'src/components/workspace/WorkspaceCanvas.tsx': `
// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: WorkspaceCanvas — 28 EHR panel grid workspace
// Built: 2026-02-17 | Replaces old 7109-line AppointmentDetailModal
//
// FIX-005 (2026-02-17): Panels not opening
//   - dragConfig={{handle}} → draggableHandle=".grid-drag-handle"
//   - Added lab-results-inline + referrals-followup to PANEL_CONTENT
//   - Switched patients page from AppointmentDetailModal to this
//
// WIRING: Used by /doctor/appointments and /doctor/patients
// DEPENDS ON: /api/panels/*, ToolbarButtons.tsx, PanelRegistry.ts
// PANELS: 28 total (see EHR_PANELS in ToolbarButtons.tsx)
// GRID: react-grid-layout with draggableHandle=".grid-drag-handle"
// ═══════════════════════════════════════════════════════════════`,

  'src/app/api/cron-export/route.ts': `
// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Daily auto-sync cron job
// Built: 2026-02-17 | Runs at 6AM UTC via Vercel Cron
//
// Fetches all 5 data types with 1000-row pagination:
//   patients, medications, allergies, problems, appointments
// Saves to patient_data_exports (UUID: 00000000-0000-0000-0000-000000000001)
//
// FIX-004 (2026-02-17): Dashboard now calls this instead of
//   downloading 7MB to browser and re-uploading
//
// WIRING: Called by dashboard Sync Now button + Vercel Cron
// TABLES: drchrono_patients, drchrono_medications, drchrono_allergies,
//         drchrono_problems, drchrono_appointments, patient_data_exports
// ═══════════════════════════════════════════════════════════════`,

  'src/app/api/export-patient-data/route.ts': `
// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Export patient data API (returns JSON for download)
// Built: 2026-02-17 | Rewritten from 135 to 87 lines
//
// FIX-003 (2026-02-17): Correct column names
//   - allergies: "reaction" not "description"
//   - problems: "icd_code" + "date_diagnosis"
//
// WARNING: This returns ~7MB JSON. Do NOT use for saving to DB.
//   Use /api/cron-export for server-side save instead.
//
// WIRING: Called by Download Backup button only
// ═══════════════════════════════════════════════════════════════`,

  'src/lib/export-fallback.ts': `
// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: 3-tier data fallback system
// Built: 2026-02-17 | Used by all 6 panel APIs
//
// Tier 1: Live DrChrono query (handled by panel API itself)
// Tier 2: Supabase patient_data_exports table (this file)
// Tier 3: Static /public/data/patient-medications.json (this file)
//
// Functions: getExportMedications(), getExportAllergies(),
//   getExportProblems(), getExportAppointments()
//
// WIRING: Used by /api/panels/medications, /api/panels/allergies,
//   /api/panels/problems, /api/panels/patient-appointments,
//   /api/panels/medication-history, /api/panels/prescriptions
// ═══════════════════════════════════════════════════════════════`,

  'src/app/doctor/dashboard/page.tsx': `
// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Doctor Dashboard
// Built: 2026-02-17 | Main dashboard with KPIs, actions, data stats
//
// FIX-004 (2026-02-17): Sync Now changed from browser upload to
//   /api/cron-export (server-side)
//
// COMPONENTS: SyncButton, DownloadButton, DataStatsRow
// WIRING: /api/dashboard/stats, /api/cron-export, /api/export-patient-data
// TABLES: appointments, patients, patient_data_exports
// ═══════════════════════════════════════════════════════════════`,

  'src/app/doctor/appointments/page.tsx': `
// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Appointments Calendar Page
// Built: 2026-02-17 | Uses WorkspaceCanvas for EHR panels
//
// FIX-005 (2026-02-17): Grid panels now open correctly
// FIX-006 (2026-02-17): Availability extended to 9AM-10PM
//
// WIRING: WorkspaceCanvas, /api/appointments, /api/panels/*
// TABLES: appointments, patients, doctors, doctor_availability
// ═══════════════════════════════════════════════════════════════`,

  'src/app/doctor/patients/page.tsx': `
// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Patient Management Page
// Built: 2026-02-17 | Switched from AppointmentDetailModal to WorkspaceCanvas
//
// FIX-005 (2026-02-17): Replaced old 7109-line modal with WorkspaceCanvas
// FIX-008 (2026-02-17): DrChrono patient ID null → email fallback
//
// WIRING: WorkspaceCanvas, /api/patients/[id], /api/patients/search
// TABLES: patients, drchrono_patients, appointments
// ═══════════════════════════════════════════════════════════════`,

  'src/lib/system-manifest/index.ts': `
// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: THE SYSTEM MANIFEST — source of truth
// Built: 2026-02-17 | Must be updated with every fix/build
//
// Contains: FIX_HISTORY, SYSTEM_MAP, HEALTH_CHECKS
// Used by: /api/system-health, /doctor/system-health, PageGuide
//
// RULE: Every new fix MUST be added to FIX_HISTORY here
// RULE: Every new system MUST be added to SYSTEM_MAP here
// RULE: AI/dev MUST read this file before changing any code
// ═══════════════════════════════════════════════════════════════`,

  'src/components/appointment/sections/ToolbarButtons.tsx': `
// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: EHR Panel toolbar button configs
// Built: 2026-02-17 | 28 panel buttons + eRx
//
// Each button maps to a panel ID used in WorkspaceCanvas PANEL_CONTENT
// If you add a button here, you MUST add matching entry in
// WorkspaceCanvas.tsx PANEL_CONTENT and create the panel component
//
// FIX-005 (2026-02-17): lab-results-inline and referrals-followup
//   were in this file but missing from PANEL_CONTENT
// ═══════════════════════════════════════════════════════════════`,
}

// Panel API routes all get the same template
const PANEL_API_HISTORY = (name) => `
// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Panel API for ${name}
// Built: 2026-02-17 | Uses service role key + getDrchronoPatientId
//
// FIX-001: RLS disabled on drchrono_* tables
// FIX-008: Uses email fallback when drchrono_patient_id is NULL
//
// WIRING: Called by usePanelData hook from ${name} panel component
// SHARED: Uses _shared.ts for getDrchronoPatientId()
// ═══════════════════════════════════════════════════════════════`

// ─── MAIN ───────────────────────────────────────────────────

let stamped = 0
let skipped = 0

function addHeader(filepath) {
  const content = fs.readFileSync(filepath, 'utf8')
  if (content.includes('@build-manifest')) {
    skipped++
    return
  }

  const ext = path.extname(filepath)
  if (!['.ts', '.tsx'].includes(ext)) return

  fs.writeFileSync(filepath, HEADER_TS + content)
  stamped++
}

function addFooter(filepath, footer) {
  const content = fs.readFileSync(filepath, 'utf8')
  if (content.includes('BUILD_HISTORY')) {
    skipped++
    return
  }
  fs.writeFileSync(filepath, content + '\n' + footer + '\n')
  stamped++
}

// Stamp all .ts/.tsx files with header
function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walkDir(fullPath)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      addHeader(fullPath)
    }
  }
}

console.log('Stamping files with @build-manifest headers...')
walkDir(SRC)

// Add BUILD_HISTORY footers to critical files
console.log('Adding BUILD_HISTORY footers to critical files...')
for (const [relPath, footer] of Object.entries(BUILD_HISTORIES)) {
  const fullPath = path.join(ROOT, relPath)
  if (fs.existsSync(fullPath)) {
    addFooter(fullPath, footer)
  } else {
    console.log(`  SKIP (not found): ${relPath}`)
  }
}

// Stamp panel API routes
const panelDir = path.join(ROOT, 'src/app/api/panels')
if (fs.existsSync(panelDir)) {
  const panels = fs.readdirSync(panelDir, { withFileTypes: true })
  for (const p of panels) {
    if (p.isDirectory()) {
      const routeFile = path.join(panelDir, p.name, 'route.ts')
      if (fs.existsSync(routeFile)) {
        addFooter(routeFile, PANEL_API_HISTORY(p.name))
      }
    }
  }
}

console.log(`\nDone! Stamped: ${stamped} | Already stamped: ${skipped}`)
