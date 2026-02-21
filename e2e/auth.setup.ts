import { test as setup, expect } from '@playwright/test'

const AUTH_FILE = 'e2e/.auth/user.json'

setup('authenticate as doctor', async ({ page }) => {
  const email = process.env.E2E_DOCTOR_EMAIL
  const password = process.env.E2E_DOCTOR_PASSWORD

  if (!email || !password) {
    console.warn('[auth.setup] E2E_DOCTOR_EMAIL or E2E_DOCTOR_PASSWORD not set — skipping auth')
    // Save empty auth state so tests can still run (will hit login redirects)
    await page.context().storageState({ path: AUTH_FILE })
    return
  }

  // Navigate to login page
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  // Fill Supabase Auth login form
  await page.fill('input[type="email"], input[name="email"]', email)
  await page.fill('input[type="password"], input[name="password"]', password)
  await page.click('button[type="submit"]')

  // Wait for redirect to doctor dashboard
  await page.waitForURL('**/doctor/**', { timeout: 15_000 })
  await expect(page).toHaveURL(/\/doctor\//)

  // Save auth state
  await page.context().storageState({ path: AUTH_FILE })
  console.log('[auth.setup] Auth state saved to', AUTH_FILE)
})
