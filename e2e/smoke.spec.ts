import { test, expect } from '@playwright/test'
import { DOCTOR_PAGES, waitForPageReady } from './helpers/test-utils'

test.describe('Smoke Tests — All Doctor Pages Load', () => {
  for (const route of DOCTOR_PAGES) {
    test(`${route} loads without crashing`, async ({ page }) => {
      const response = await page.goto(route)

      // Page should not return a server error
      expect(response?.status()).not.toBe(500)

      await waitForPageReady(page)

      // Page should have visible content (not blank)
      const body = page.locator('body')
      await expect(body).not.toBeEmpty()

      // No unhandled error boundaries
      const errorBoundary = page.locator('text=Application error')
      await expect(errorBoundary).toHaveCount(0)
    })
  }
})
