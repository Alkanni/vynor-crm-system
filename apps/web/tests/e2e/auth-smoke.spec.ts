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

    // Verify page header and branding
    await expect(page.locator('h1')).toContainText('Sign in to VYNOR CRM');
    await expect(
      page.getByText('Enter your credentials to access your omnichannel workspace'),
    ).toBeVisible();

    // Verify form input controls
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('Sign in');
  });

  test('submitting credentials against auth provider displays feedback', async ({ page }) => {
    await page.goto('/login');

    // Fill credentials
    await page.fill('#email', 'invalid.agent@vynor.io');
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Expect error alert or feedback to appear
    const alertBox = page.locator('[role="alert"]');
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

    // Verify VYNOR CRM app shell header and workspace badge
    await expect(page.getByText('VYNOR CRM')).toBeVisible();
    await expect(page.getByRole('banner').getByText('Smoke Test Workspace')).toBeVisible();

    // Verify navigation sidebar
    const navMenu = page.locator('nav[aria-label="Main Navigation"]');
    await expect(navMenu).toBeVisible();

    // Verify home page welcome header
    await expect(page.locator('h1')).toContainText('Welcome back, Agent Smoke');
    await expect(page.getByText('Authenticated (RBAC Active)')).toBeVisible();

    // Verify user display name in header
    await expect(page.getByRole('banner').getByText('Agent Smoke')).toBeVisible();

    // Verify sidebar toggle button
    const toggleButton = page.locator('button[aria-label="Toggle Navigation Sidebar"]');
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    // Verify sign out button is rendered
    const signOutBtn = page.locator('button[aria-label="Sign Out"]');
    await expect(signOutBtn).toBeVisible();
  });
});
