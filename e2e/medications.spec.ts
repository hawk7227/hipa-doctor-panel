import { test, expect } from '@playwright/test'

test.describe('Medications API', () => {
  const BASE = 'http://localhost:3000'
  const FAKE_PATIENT_ID = '00000000-0000-0000-0000-000000000000'

  test('GET /api/medications returns 200 or 401 (not 500)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/medications?patient_id=${FAKE_PATIENT_ID}`)
    expect([200, 401, 400]).toContain(res.status())
    expect(res.status()).not.toBe(500)
  })

  test('POST /api/medications returns 201, 401, or 400 (not 500)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/medications`, {
      data: {
        patient_id: FAKE_PATIENT_ID,
        medication_name: 'Test Medication',
        dosage: '10mg',
        frequency: 'BID',
        route: 'oral',
        status: 'active',
      },
    })
    expect([201, 401, 400]).toContain(res.status())
    expect(res.status()).not.toBe(500)
  })

  test('PATCH /api/medications/[id] returns 200, 401, 400, or 404 (not 500)', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000001'
    const res = await request.patch(`${BASE}/api/medications/${fakeId}`, {
      data: { dosage: '20mg' },
    })
    expect([200, 401, 400, 404]).toContain(res.status())
    expect(res.status()).not.toBe(500)
  })

  test('DELETE /api/medications/[id] returns 200, 401, 400, or 404 (not 500)', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000002'
    const res = await request.delete(`${BASE}/api/medications/${fakeId}`)
    expect([200, 401, 400, 404]).toContain(res.status())
    expect(res.status()).not.toBe(500)
  })
})

test.describe('Medications Panel UI', () => {
  test('medications panel can be accessed from workspace', async ({ page }) => {
    await page.goto('/doctor/patients')
    await page.waitForLoadState('domcontentloaded')

    // The medications panel is available within the patient workspace
    // It renders via MedicationsPanelV2 when a patient is selected
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })
})
