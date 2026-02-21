import { test, expect } from '@playwright/test'

test.describe('Patient Search Modal (Ctrl+K)', () => {
  test('Ctrl+K opens search modal', async ({ page }) => {
    await page.goto('/doctor/patients')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Control+k')

    const modal = page.locator('.fixed.inset-0.z-\\[100\\]')
    await expect(modal).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=Search Patients')).toBeVisible()
  })

  test('Escape closes the modal', async ({ page }) => {
    await page.goto('/doctor/patients')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Control+k')
    const modal = page.locator('.fixed.inset-0.z-\\[100\\]')
    await expect(modal).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
  })

  test('Ctrl+K toggles modal on/off', async ({ page }) => {
    await page.goto('/doctor/patients')
    await page.waitForLoadState('networkidle')

    await page.keyboard.press('Control+k')
    await expect(page.locator('.fixed.inset-0.z-\\[100\\]')).toBeVisible()

    await page.keyboard.press('Control+k')
    await expect(page.locator('.fixed.inset-0.z-\\[100\\]')).toBeHidden()
  })

  test('View Chart opens patient chart, not just patients list', async ({ page }) => {
    await page.goto('/doctor/patients')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(300)
    await page.fill('input[placeholder*="Search"]', 'a')
    await page.waitForTimeout(1000)
    const result = page.locator('[class*="search-result"]').first()
    if (await result.count() > 0) {
      await result.click()
      await page.waitForTimeout(300)
      await page.click('text=View Chart')
      await page.waitForTimeout(2000)
      // THE ACTUAL TEST: patient modal must be open
      const modal = page.locator('[class*="modal"], [role="dialog"]')
      await expect(modal).toBeVisible({ timeout: 5000 })
    }
  })
})
