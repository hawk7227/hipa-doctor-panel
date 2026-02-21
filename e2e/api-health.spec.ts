import { test, expect } from '@playwright/test'
import { API_ROUTES } from './helpers/test-utils'

test.describe('API Health Checks — No 500 Errors', () => {
  const BASE = 'http://localhost:3000'

  for (const route of API_ROUTES) {
    test(`GET ${route} does not return 500`, async ({ request }) => {
      const res = await request.get(`${BASE}${route}`)

      // API should return a valid response — 200, 401, 400, 404 are all acceptable
      // Only 500 (server crash) is unacceptable
      expect(res.status()).not.toBe(500)
      expect(res.status()).toBeLessThan(500)
    })
  }
})
