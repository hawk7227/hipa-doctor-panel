import { test, expect } from '@playwright/test'
import { NAV_ITEMS, ADMIN_ITEMS, waitForPageReady } from './helpers/test-utils'

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/doctor/dashboard')
    await waitForPageReady(page)
  })

  // Test every main nav link
  for (const item of NAV_ITEMS) {
    test(`nav link: ${item.label} → ${item.href}`, async ({ page }) => {
      const link = page.locator(`nav[aria-label="Main navigation"] a[href="${item.href}"]`)

      // Link should exist (may be hidden by access control — skip if not visible)
      if ((await link.count()) === 0) {
        test.skip()
        return
      }

      await link.click()
      await page.waitForURL(`**${item.href}`)
      await waitForPageReady(page)
      expect(page.url()).toContain(item.href)
    })
  }

  // Test every admin nav link
  for (const item of ADMIN_ITEMS) {
    test(`admin link: ${item.label} → ${item.href}`, async ({ page }) => {
      const link = page.locator(`nav[aria-label="Main navigation"] a[href="${item.href}"]`)

      if ((await link.count()) === 0) {
        test.skip()
        return
      }

      await link.click()
      await page.waitForURL(`**${item.href}`)
      await waitForPageReady(page)
      expect(page.url()).toContain(item.href)
    })
  }
})

test.describe('Keyboard Navigation Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/doctor/patients')
    await waitForPageReady(page)
  })

  const shortcuts = [
    { keys: ['g', 'd'], expected: '/doctor/dashboard', label: 'G+D → Dashboard' },
    { keys: ['g', 'a'], expected: '/doctor/appointments', label: 'G+A → Appointments' },
    { keys: ['g', 'p'], expected: '/doctor/patients', label: 'G+P → Patients' },
    { keys: ['g', 's'], expected: '/doctor/settings', label: 'G+S → Settings' },
  ]

  for (const shortcut of shortcuts) {
    test(shortcut.label, async ({ page }) => {
      // Press keys in sequence (chord shortcut)
      for (const key of shortcut.keys) {
        await page.keyboard.press(key)
      }

      await page.waitForURL(`**${shortcut.expected}`, { timeout: 5000 })
      expect(page.url()).toContain(shortcut.expected)
    })
  }
})
