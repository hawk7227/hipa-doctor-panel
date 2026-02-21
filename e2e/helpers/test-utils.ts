import { type Page } from '@playwright/test'

export const BASE_URL = 'http://localhost:3000'

/** All doctor page routes — used by smoke tests */
export const DOCTOR_PAGES = [
  '/doctor/dashboard',
  '/doctor/appointments',
  '/doctor/patients',
  '/doctor/patient-records',
  '/doctor/new-patient',
  '/doctor/communication',
  '/doctor/campaigns',
  '/doctor/labs',
  '/doctor/prescriptions',
  '/doctor/prior-auth',
  '/doctor/alerts',
  '/doctor/billing',
  '/doctor/reports',
  '/doctor/referrals',
  '/doctor/quality',
  '/doctor/data-export',
  '/doctor/ai-assistant',
  '/doctor/admin-messages',
  '/doctor/admin-bugs',
  '/doctor/profile',
  '/doctor/availability',
  '/doctor/schedule',
  '/doctor/records',
  '/doctor/chart-management',
  '/doctor/bug-reports',
  '/doctor/staff-hub',
  '/doctor/system-health',
  '/doctor/settings',
  '/doctor/settings/staff',
  '/doctor/settings/audit',
  '/doctor/settings/data-export',
] as const

/** Main sidebar nav items — matches NAV_ITEMS in layout.tsx */
export const NAV_ITEMS = [
  { href: '/doctor/dashboard',       label: 'Dashboard' },
  { href: '/doctor/appointments',    label: 'Appointments' },
  { href: '/doctor/patients',        label: 'Patients' },
  { href: '/doctor/patient-records', label: 'Patient Records' },
  { href: '/doctor/new-patient',     label: 'New Patient' },
  { href: '/doctor/communication',   label: 'Communication' },
  { href: '/doctor/campaigns',       label: 'Campaigns' },
  { href: '/doctor/labs',            label: 'Lab Orders' },
  { href: '/doctor/prescriptions',   label: 'Prescriptions' },
  { href: '/doctor/prior-auth',      label: 'Prior Auth' },
  { href: '/doctor/alerts',          label: 'Clinical Alerts' },
  { href: '/doctor/billing',         label: 'Billing' },
  { href: '/doctor/reports',         label: 'Reports' },
  { href: '/doctor/referrals',       label: 'Referrals' },
  { href: '/doctor/quality',         label: 'Quality Measures' },
  { href: '/doctor/data-export',     label: 'Data Export' },
  { href: '/doctor/ai-assistant',    label: 'AI Assistant' },
  { href: '/doctor/admin-messages',  label: 'Admin Messages' },
  { href: '/doctor/profile',         label: 'Profile & Credentials' },
  { href: '/doctor/availability',    label: 'Availability' },
] as const

/** Admin sidebar items — matches ADMIN_ITEMS in layout.tsx */
export const ADMIN_ITEMS = [
  { href: '/doctor/system-health',    label: 'System Health' },
  { href: '/doctor/settings',         label: 'Settings' },
  { href: '/doctor/settings/staff',   label: 'Staff Management' },
  { href: '/doctor/staff-hub',        label: 'Staff Hub' },
  { href: '/doctor/chart-management', label: 'Chart Management' },
  { href: '/doctor/settings/audit',   label: 'Audit Log' },
] as const

/** API routes to health-check (GET should not return 500) */
export const API_ROUTES = [
  '/api/system-health',
  '/api/env-check',
  '/api/dashboard/stats',
  '/api/patients/search?q=test',
  '/api/medications?patient_id=00000000-0000-0000-0000-000000000000',
  '/api/panels/medications?patient_id=test',
  '/api/panels/allergies?patient_id=test',
  '/api/panels/problems?patient_id=test',
  '/api/panels/vitals?patient_id=test',
  '/api/panels/demographics?patient_id=test',
  '/api/panels/clinical-notes?patient_id=test',
  '/api/panels/lab-results?patient_id=test',
  '/api/panels/prescriptions?patient_id=test',
  '/api/panels/documents?patient_id=test',
  '/api/panels/insurance?patient_id=test',
  '/api/panels/billing?patient_id=test',
  '/api/panels/referrals?patient_id=test',
  '/api/panels/immunizations?patient_id=test',
  '/api/panels/history?patient_id=test',
  '/api/panels/alerts?patient_id=test',
] as const

/** Wait for page to finish loading */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  // Wait for any loading spinners to disappear
  const spinner = page.locator('.animate-spin')
  if (await spinner.count() > 0) {
    await spinner.first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {})
  }
}
