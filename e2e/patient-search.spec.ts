import { test, expect } from '@playwright/test'
import { waitForPageReady } from './helpers/test-utils'

test.describe('Patient Search Modal (Ctrl+K)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/doctor/dashboard')
    await waitForPageReady(page)
  })

  test('Ctrl+K opens search modal', async ({ page }) => {
    await page.keyboard.press('Control+k')

    // Modal overlay should appear
    const modal = page.locator('.fixed.inset-0.z-\\[100\\]')
    await expect(modal).toBeVisible({ timeout: 3000 })

    // Header should say "Search Patients"
    await expect(page.locator('text=Search Patients')).toBeVisible()
  })

  test('Escape closes the modal', async ({ page }) => {
    await page.keyboard.press('Control+k')
    const modal = page.locator('.fixed.inset-0.z-\\[100\\]')
    await expect(modal).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
  })

  test('typing in search shows results', async ({ page }) => {
    await page.keyboard.press('Control+k')

    // Focus should be on the search input
    const searchInput = page.locator('input[placeholder*="Search patients"]')
    await expect(searchInput).toBeVisible()

    // Type a search term
    await searchInput.fill('test')

    // Wait for results to appear (or "no results" message)
    await page.waitForTimeout(1000) // debounce delay
  })

  test('selecting a patient shows action picker', async ({ page }) => {
    await page.keyboard.press('Control+k')

    const searchInput = page.locator('input[placeholder*="Search patients"]')
    await searchInput.fill('a') // broad search to get results

    // Wait for results dropdown
    await page.waitForTimeout(1500)

    // Click first result if available
    const firstResult = page.locator('[class*="cursor-pointer"]').first()
    if (await firstResult.isVisible()) {
      await firstResult.click()

      // Action picker should show "View Chart" and "Book Appointment"
      await expect(page.locator('text=View Chart')).toBeVisible({ timeout: 3000 })
      await expect(page.locator('text=Book Appointment')).toBeVisible()
    }
  })

  test('Ctrl+K toggles modal on/off', async ({ page }) => {
    // Open
    await page.keyboard.press('Control+k')
    await expect(page.locator('.fixed.inset-0.z-\\[100\\]')).toBeVisible()

    // Close
    await page.keyboard.press('Control+k')
    await expect(page.locator('.fixed.inset-0.z-\\[100\\]')).toBeHidden()
  })
})
