import { test, expect } from '@playwright/test';

test.describe('Authentication & Application Shell Smoke Test (FND-FE-003, FND-TST-008)', () => {
  test('unauthenticated visitor accessing protected route is redirected to /login with returnUrl', async ({
    page,
  }) => {
    // Attempt to access protected CRM inbox
    await page.goto('/inbox');

    // Expect edge middleware to intercept and redirect to /login
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Finbox/);

    // Verify correlation ID header is returned by middleware
    const response = await page.request.get('/inbox', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()['x-correlation-id']).toBeDefined();
    expect(response.headers()['location']).toBe('/login?returnUrl=%2Finbox');
  });

  test('login page renders clean authentication interface with credentials form', async ({
    page,
  }) => {
    await page.goto('/login');

    // Verify page header and branding (VYNOR v3 login layout)
    await expect(page.locator('h1')).toContainText('Login to VYNOR');
    await expect(page.getByText('Access your omnichannel workspace')).toBeVisible();

    // Verify form input controls
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('Login');
  });

  test('submitting credentials against auth provider displays feedback', async ({ page }) => {
    await page.goto('/login');

    // Fill credentials
    await page.fill('#email', 'invalid.agent@vynor.io');
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Expect error alert or feedback to appear (ignore Next's empty route announcer)
    const alertBox = page.getByRole('alert').filter({ hasText: /\S/ });
    await expect(alertBox).toBeVisible({ timeout: 5000 });
  });

  test('authenticated session renders protected CRM application shell and navigation', async ({
    page,
    context,
  }) => {
    const mockSession = {
      access_token: 'mock_valid_jwt_smoke_test',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 7200,
      refresh_token: 'mock_refresh_token_smoke',
      user: {
        id: 'usr_smoke_01',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'agent@vynor.io',
        user_metadata: {
          displayName: 'Agent Smoke',
          workspaceId: 'ws_smoke_01',
          workspaceName: 'Smoke Test Workspace',
        },
        app_metadata: {
          provider: 'email',
        },
        created_at: '2026-09-24T00:00:00.000Z',
      },
    };

    // Seed session in localStorage before client code executes
    await page.addInitScript((session) => {
      window.localStorage.setItem('vynor_supabase_auth', JSON.stringify(session));
    }, mockSession);

    // Seed authenticated session cookie for edge middleware
    await context.addCookies([
      {
        name: 'vynor_session',
        value: 'mock_valid_jwt_smoke_test',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    await page.goto('/');

    // VYNOR shell: no global top header / status bar, full-height sidebar instead
    await expect(page.getByRole('banner')).toHaveCount(0);
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('Smoke Test Workspace')).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Inbox' })).toBeVisible();

    // Verify home page header (PageHeader)
    await expect(page.locator('h1').first()).toContainText('Welcome back, Agent Smoke');
    await expect(page.getByText('Authenticated (RBAC active)')).toBeVisible();

    // Verify the profile menu in the sidebar footer
    await expect(sidebar.getByText('Agent Smoke')).toBeVisible();
    await sidebar.getByRole('button', { name: /Agent Smoke/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Log out' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Double-clicking the resize handle collapses the sidebar to 56px
    await page.getByRole('separator', { name: 'Resize sidebar' }).dblclick();
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(56);
  });
});
