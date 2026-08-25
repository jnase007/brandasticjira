import { test, expect } from '@playwright/test'

const email = process.env.E2E_TEST_EMAIL
const password = process.env.E2E_TEST_PASSWORD
const isAdmin = process.env.E2E_TEST_IS_ADMIN === 'true'

const hasCredentials = Boolean(email && password)

test.describe('Smoke', () => {
  test('Login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
  })

  test('How It Works page loads', async ({ page }) => {
    await page.goto('/how-it-works')
    // Route is protected; unauthenticated users are redirected to login
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
  })

  test('Email templates are not public', async ({ page }) => {
    await page.goto('/email-templates')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /email templates/i })).toHaveCount(0)
    await expect(page.getByText(/resend\.com integration/i)).toHaveCount(0)
  })

  test('Logged-out client dashboard redirects to client login', async ({ page }) => {
    await page.goto('/client-dashboard')
    await expect(page).toHaveURL(/\/client-login/)
    await expect(page.locator('.animate-pulse')).toHaveCount(0)
  })

  test('robots.txt disallows crawlers', async ({ page }) => {
    const res = await page.goto('/robots.txt')
    expect(res?.ok()).toBeTruthy()
    const body = await res.text()
    expect(body).toContain('Disallow: /')
    expect(body).not.toContain('<!DOCTYPE html>')
  })
})

test.describe('Authenticated smoke', () => {
  test.skip(!hasCredentials, 'Missing E2E_TEST_EMAIL/E2E_TEST_PASSWORD')

  const signIn = async (page) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email.toLowerCase())
    await page.getByLabel(/password/i).fill(password)
    const authResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/auth/v1/token') &&
        resp.request().method() === 'POST',
      { timeout: 20_000 }
    )

    await page.getByRole('button', { name: /sign in|login/i }).click()

    let authResponse
    try {
      authResponse = await authResponsePromise
    } catch {
      authResponse = null
    }

    // Wait for either dashboard navigation or nav link
    const success = await Promise.race([
      page
        .waitForURL(/dashboard|\/$/, { timeout: 25_000 })
        .then(() => true)
        .catch(() => false),
      page
        .getByRole('link', { name: /dashboard/i })
        .waitFor({ timeout: 25_000 })
        .then(() => true)
        .catch(() => false),
      page
        .getByRole('link', { name: /clients/i })
        .waitFor({ timeout: 25_000 })
        .then(() => true)
        .catch(() => false),
    ])

    if (!success) {
      if (authResponse) {
        const status = authResponse.status()
        let body = ''
        try {
          const json = await authResponse.json()
          body = json?.error_description || json?.message || JSON.stringify(json)
        } catch {
          body = ''
        }
        throw new Error(
          `Login did not complete. Auth response: ${status}${body ? ` - ${body}` : ''}`
        )
      }

      // Capture common auth errors if shown
      const errorText = await page
        .locator('text=/invalid|error|failed|credentials|confirm/i')
        .first()
        .textContent()
        .catch(() => null)
      throw new Error(
        `Login did not complete. ${errorText ? `UI message: ${errorText}` : ''}`
      )
    }
  }

  test('Sign in and load key pages', async ({ page }) => {
    await signIn(page)

    await page.goto('/clients')
    await expect(page.getByRole('heading', { name: /client management/i })).toBeVisible()

    await page.goto('/boards')
    await expect(page.getByRole('heading', { name: /boards/i })).toBeVisible()

    await page.goto('/time')
    await expect(page.getByRole('heading', { name: /time tracking/i })).toBeVisible()
  })

  test('Diagnostics page loads for admins', async ({ page }) => {
    test.skip(!isAdmin, 'Requires admin test user')
    await signIn(page)

    await page.goto('/diagnostics')
    await expect(page.getByRole('heading', { name: /diagnostics/i })).toBeVisible()
    await page.getByRole('button', { name: /run diagnostics/i }).click()
    await expect(page.getByText(/system checks/i)).toBeVisible()
  })
})
