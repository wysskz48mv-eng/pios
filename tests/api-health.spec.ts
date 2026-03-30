import { test, expect } from '@playwright/test'

/**
 * PIOS E2E — API health & smoke tests
 */

test.describe('API Health', () => {
  test('GET /api/health returns 200 with status', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status')
    expect(['healthy', 'degraded']).toContain(body.status)
  })

  test('GET /api/health/smoke returns 200', async ({ request }) => {
    const res = await request.get('/api/health/smoke')
    expect(res.status()).toBe(200)
  })

  test('protected API returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/dashboard')
    expect(res.status()).toBe(401)
  })

  test('stripe webhook rejects unsigned requests', async ({ request }) => {
    const res = await request.post('/api/stripe/webhook', {
      data: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
    // Should reject — no valid Stripe signature
    expect([400, 401, 403, 500]).toContain(res.status())
  })

  test('cron endpoints reject without secret', async ({ request }) => {
    const res = await request.post('/api/cron/morning-brief')
    expect(res.status()).toBe(401)
  })
})
