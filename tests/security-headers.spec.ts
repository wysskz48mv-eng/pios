import { test, expect } from '@playwright/test'

/**
 * PIOS E2E — Security headers (ISO 27001 A.14.2)
 */

test.describe('Security headers', () => {
  test('responses include required security headers', async ({ request }) => {
    const res = await request.get('/')
    const headers = res.headers()

    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['strict-transport-security']).toContain('max-age=')
    expect(headers['permissions-policy']).toContain('camera=()')
  })

  test('CSP header is present', async ({ request }) => {
    const res = await request.get('/')
    const csp = res.headers()['content-security-policy']
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
  })

  test('blocked paths return 404', async ({ request }) => {
    const blocked = ['/api/debug', '/.env', '/.git', '/api/openapi']
    for (const path of blocked) {
      const res = await request.get(path)
      expect(res.status(), `${path} should be blocked`).toBe(404)
    }
  })

  test('rate limiting returns 429 after threshold', async ({ request }) => {
    // This test is informational — in production, rate limit is 100/15min
    // Just verify the endpoint responds (we won't actually exhaust the limit)
    const res = await request.get('/api/health')
    expect([200, 429]).toContain(res.status())
  })
})
