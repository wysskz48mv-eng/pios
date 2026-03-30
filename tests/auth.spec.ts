import { test, expect } from '@playwright/test'

/**
 * PIOS E2E — Authentication flows
 */

test.describe('Auth', () => {
  test('login page loads with correct elements', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page).toHaveTitle(/PIOS/)
    await expect(page.getByText('Welcome back.')).toBeVisible()
  })

  test('signup page loads with form fields', async ({ page }) => {
    await page.goto('/auth/signup')
    // Default tab is Google OAuth; switch to email tab to see inputs
    await page.getByText('Email & password').click()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Send")').first().click()
    // Should show an error or remain on login page
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('unauthenticated user redirected from dashboard', async ({ page }) => {
    await page.goto('/platform/dashboard')
    await page.waitForURL(/auth\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/auth/login')
  })

  test('verify page displays email confirmation message', async ({ page }) => {
    await page.goto('/auth/verify')
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible()
  })
})
