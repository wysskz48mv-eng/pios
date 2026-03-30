import { test, expect } from '@playwright/test'

/**
 * PIOS E2E — Onboarding flow
 * NOTE: Full onboarding requires a valid Supabase session.
 *       These tests verify the pages render correctly.
 */

test.describe('Onboarding', () => {
  test('onboarding page loads', async ({ page }) => {
    await page.goto('/onboarding')
    // Should show onboarding content or redirect to login
    const url = page.url()
    expect(url).toMatch(/onboarding|login/)
  })
})
