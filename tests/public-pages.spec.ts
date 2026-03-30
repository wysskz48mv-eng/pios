import { test, expect } from '@playwright/test'

/**
 * PIOS E2E — Public pages (no auth required)
 */

test.describe('Public pages', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/PIOS/)
  })

  test('pricing page shows 3 tiers', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByText('Researcher', { exact: true })).toBeVisible()
    await expect(page.getByText('Founder', { exact: true })).toBeVisible()
    await expect(page.getByText('Team', { exact: true })).toBeVisible()
  })

  test('privacy policy page renders', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.locator('text=/privacy/i').first()).toBeVisible()
    // Should contain legal content
    const body = await page.textContent('body')
    expect(body?.length).toBeGreaterThan(500)
  })

  test('terms page renders', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.locator('text=/terms/i').first()).toBeVisible()
    const body = await page.textContent('body')
    expect(body?.length).toBeGreaterThan(500)
  })
})
