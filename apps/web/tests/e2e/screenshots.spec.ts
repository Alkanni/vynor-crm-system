import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './support/local-only';
import { E2E_USERS, STUB_PHONES } from './support/e2e-env';
import {
  closeE2eDatabase,
  connectWhatsAppChannel,
  devSessionToken,
  e2eDatabase,
  signInAs,
  stub,
} from './support/stack';

/**
 * Screenshot baseline of every web route on the current Next.js app (VYN-03-04), for the
 * Vite migration (WU-06) to compare against. Determinism (tests/e2e/README.md):
 * - pixels come from the pinned Playwright container, at 1440×900, DPR 1, en-US, Asia/Jakarta;
 * - routes that render sample data run with the browser clock fixed at FIXED_NOW;
 * - Inbox and Channels show real API data from the "E2E Screens" workspace, created during the
 *   run, so their clock is real and only the time-of-day labels are masked;
 * - animations are disabled and the caret hidden; comparison uses Playwright's default
 *   per-pixel threshold (0.2) and allows zero differing pixels.
 */

const FIXED_NOW = new Date('2026-10-15T10:00:00+07:00');
const MASK_STYLE = path.join(import.meta.dirname, 'support', 'screenshot-mask.css');

interface SampleRoute {
  name: string;
  path: string;
  heading: string;
  /** Extra readiness condition before the screenshot. */
  ready?: (page: Page) => Promise<void>;
  /** Run-specific values masked in the screenshot. */
  mask?: (page: Page) => Locator[];
}

/** Routes that show sample data (no API reads besides the signed-in actor). */
const SAMPLE_ROUTES: SampleRoute[] = [
  {
    name: 'home',
    path: '/',
    heading: 'Welcome back, Screens Admin',
    ready: (page) => expect(page.getByText('Live updates active')).toBeVisible(),
    // The correlation ID ends in a random suffix.
    mask: (page) => [page.getByText(/^web_\d+_/)],
  },
  { name: 'dashboard', path: '/dashboard', heading: 'Operational Pulse' },
  { name: 'contacts', path: '/contacts', heading: 'Contacts' },
  { name: 'ai-agent', path: '/ai-agent', heading: 'AI Agent' },
  // /analytics renders the Reports page.
  { name: 'analytics', path: '/analytics', heading: 'Reports' },
  { name: 'automations', path: '/automations', heading: 'Automations' },
  { name: 'blast', path: '/blast', heading: 'CSV Blast' },
  { name: 'campaigns', path: '/campaigns', heading: 'Broadcast' },
  { name: 'reports', path: '/reports', heading: 'Reports' },
  { name: 'settings', path: '/settings', heading: 'Settings' },
  { name: 'settings-audit', path: '/settings/audit', heading: 'Audit' },
  { name: 'settings-integrations', path: '/settings/integrations', heading: 'Integrations' },
  { name: 'settings-roles', path: '/settings/roles', heading: 'Roles' },
  { name: 'settings-teams', path: '/settings/teams', heading: 'Team members' },
  { name: 'templates', path: '/templates', heading: 'Templates' },
  { name: 'tickets', path: '/tickets', heading: 'Tickets' },
];

test.afterAll(async () => {
  await closeE2eDatabase();
});

async function settle(page: Page, ready: string): Promise<void> {
  await expect(page.getByRole('heading', { name: ready }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function signedIn(page: Page, fixedClock: boolean): Promise<void> {
  if (fixedClock) await page.clock.setFixedTime(FIXED_NOW);
  await signInAs(page, E2E_USERS.screens);
}

test.describe('sample-data routes', () => {
  for (const route of SAMPLE_ROUTES) {
    test(`${route.path} matches the baseline`, async ({ page }) => {
      await signedIn(page, true);
      await page.goto(route.path);
      await settle(page, route.heading);
      await route.ready?.(page);
      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
        mask: route.mask?.(page) ?? [],
      });
    });
  }

  test('/login matches the baseline', async ({ page }) => {
    await page.clock.setFixedTime(FIXED_NOW);
    await page.goto('/login');
    await settle(page, 'Login to VYNOR');
    await expect(
      page.getByRole('button', { name: 'Sign in as local admin (development)' }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot('login.png', { fullPage: true });
  });
});

test.describe('/ai-agent/[agentId] (dynamic route, client-only)', () => {
  test('a known agent opens by deep link and survives a reload', async ({ page }) => {
    await signedIn(page, true);
    await page.goto('/ai-agent/ai_support');
    await settle(page, 'VYNOR Support AI');
    await expect(page).toHaveURL('/ai-agent/ai_support');
    await expect(page).toHaveScreenshot('ai-agent-known.png', { fullPage: true });

    await page.reload();
    await settle(page, 'VYNOR Support AI');
    await expect(page).toHaveURL('/ai-agent/ai_support');
    await expect(page).toHaveScreenshot('ai-agent-known.png', { fullPage: true });
  });

  test('an unknown agent shows "AI agent not found" on deep link and reload', async ({ page }) => {
    await signedIn(page, true);
    const response = await page.goto('/ai-agent/ai_does_not_exist');
    // The route is rendered on the client, so the server answers 200 for any agent ID.
    expect(response?.status()).toBe(200);
    await settle(page, 'AI agent not found');
    await expect(page).toHaveScreenshot('ai-agent-unknown.png', { fullPage: true });

    await page.reload();
    await settle(page, 'AI agent not found');
    await expect(page).toHaveURL('/ai-agent/ai_does_not_exist');
    await expect(page).toHaveScreenshot('ai-agent-unknown.png', { fullPage: true });
  });
});

test.describe('API-backed routes', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const token = await devSessionToken(E2E_USERS.screens);
    const channel = await connectWhatsAppChannel(token, {
      name: 'WhatsApp Screens',
      phoneNumberId: STUB_PHONES.screens.id,
      appSecret: 'e2eScreensAppSecret0123456789abc',
    });
    await stub.inbound({
      phoneNumberId: channel.phoneNumberId,
      from: '6281277770001',
      name: 'Rina Screens',
      text: 'Apakah toko buka hari Minggu?',
      wamid: 'wamid.E2E-SCREENS-0001',
    });
    await expect
      .poll(() => e2eDatabase().conversation.count({ where: { providerAccountId: channel.id } }))
      .toBe(1);
  });

  /**
   * Values that differ on every run of API-backed pages: times of day of real messages and the
   * channel's random webhook key in its callback URL.
   */
  function runSpecificValues(page: Page): Locator[] {
    return [
      page.locator('time'),
      page.locator('[title^="Last activity"]'),
      page.getByLabel('Callback URL'),
    ];
  }

  test('/inbox matches the baseline', async ({ page }) => {
    await signedIn(page, false);
    await page.goto('/inbox');
    await expect(page.getByRole('log', { name: 'Conversation messages' })).toContainText(
      'Apakah toko buka hari Minggu?',
    );
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('inbox.png', {
      mask: runSpecificValues(page),
      stylePath: MASK_STYLE,
    });
  });

  test('/channels matches the baseline', async ({ page }) => {
    await signedIn(page, false);
    await page.goto('/channels');
    await settle(page, 'Channels');
    await expect(page.getByRole('region', { name: 'Connected inboxes' })).toContainText(
      'WhatsApp Screens',
    );
    await expect(page).toHaveScreenshot('channels.png', {
      fullPage: true,
      mask: runSpecificValues(page),
      stylePath: MASK_STYLE,
    });
  });
});
