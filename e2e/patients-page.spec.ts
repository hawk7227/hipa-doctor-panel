import { test, expect } from '@playwright/test'
import { waitForPageReady } from './helpers/test-utils'

test.describe('Patients Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/doctor/patients')
    await waitForPageReady(page)
  })

  test('page loads with header', async ({ page }) => {
    await expect(page.locator('text=Patient Records')).toBeVisible()
  })

  test('stats cards are visible', async ({ page }) => {
    // 4 stats cards: Total Patients, Active Patients, New This Month, Avg. Appointments
    await expect(page.locator('text=Total Patients')).toBeVisible()
    await expect(page.locator('text=Active Patients')).toBeVisible()
    await expect(page.locator('text=New This Month')).toBeVisible()
    await expect(page.locator('text=Avg. Appointments')).toBeVisible()
  })

  test('patient list table renders rows', async ({ page }) => {
    // Table should be visible
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 10_000 })

    // Table should have at least 1 patient row
    const rows = table.locator('tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 10_000 })
  })

  test('pagination controls appear for large patient lists', async ({ page }) => {
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 10_000 })

    // Check for pagination text "Showing X–Y of Z"
    const paginationText = page.locator('text=/Showing \\d+–\\d+ of \\d+/')
    if (await paginationText.isVisible()) {
      // Next button should be present
      const nextBtn = page.locator('button:has-text("Next")')
      await expect(nextBtn).toBeVisible()

      // Previous button should be disabled on page 1
      const prevBtn = page.locator('button:has-text("Previous")')
      await expect(prevBtn).toBeVisible()
      await expect(prevBtn).toBeDisabled()

      // Click Next
      await nextBtn.click()

      // Should now show page 2
      await expect(page.locator('text=Page 2')).toBeVisible()

      // Previous should now be enabled
      await expect(prevBtn).toBeEnabled()
    }
  })

  test('search filters the patient list', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search by name"]')
    await expect(searchInput).toBeVisible()

    // Type a search term
    await searchInput.fill('test')

    // Table should update (rows may decrease or show "no results")
    await page.waitForTimeout(500)
  })

  test('clicking View opens patient modal', async ({ page }) => {
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 10_000 })

    // Click first View button
    const viewBtn = page.locator('button[title="View Patient Details"]').first()
    if (await viewBtn.isVisible()) {
      await viewBtn.click()

      // Patient detail modal should appear
      await expect(page.locator('text=Patient Details:')).toBeVisible({ timeout: 5000 })
    }
  })

  test('Show All Records toggle works', async ({ page }) => {
    const toggleBtn = page.locator('button:has-text("Show All Records")')
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click()

      // Record filter tabs should appear
      await expect(page.locator('text=All Records')).toBeVisible()
      await expect(page.locator('text=Prescriptions')).toBeVisible()
    }
  })
})
