import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { assertSafeE2eDatabaseUrl } from './tests/e2e/support/database-guard';
import {
  API_BASE,
  E2E_PORTS,
  STUB_ORIGIN,
  WEB_ORIGIN,
  apiEnv,
  webEnv,
  workerEnv,
} from './tests/e2e/support/e2e-env';

/**
 * E2E stack (WU-03): the provider stub, the built API and worker, the production web build and
 * a pinned Chromium all start here, against the disposable database in E2E_DATABASE_URL.
 * See tests/e2e/README.md.
 */

// Fail before anything starts when the database is not a disposable test database.
const databaseUrl = process.env.E2E_DATABASE_URL!;
assertSafeE2eDatabaseUrl(databaseUrl);

/**
 * Screenshots are rendered by the browser of the official Playwright image (same version as
 * @playwright/test, pinned by digest), so local runs and CI produce identical pixels.
 * E2E_BROWSER=local uses the host's Chromium instead (debugging only; screenshots will differ).
 */
const PLAYWRIGHT_IMAGE =
  'mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27';
const containerBrowser = process.env.E2E_BROWSER !== 'local';

const require = createRequire(import.meta.url);
const playwrightPackage = require.resolve('playwright/package.json', {
  paths: [path.dirname(require.resolve('@playwright/test/package.json'))],
});
const playwrightCoreDir = path.dirname(
  require.resolve('playwright-core/package.json', { paths: [path.dirname(playwrightPackage)] }),
);

const graceful = { signal: 'SIGTERM', timeout: 10_000 } as const;

export default defineConfig({
  testDir: './tests/e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    // Documented tolerance (tests/e2e/README.md): Playwright's default per-pixel colour
    // threshold and not a single differing pixel.
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0.2,
      maxDiffPixels: 0,
    },
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // The stack and the database are shared, and a flaky test must fail rather than retry.
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'en-US',
    timezoneId: 'Asia/Jakarta',
    colorScheme: 'light',
    ...(containerBrowser
      ? { connectOptions: { wsEndpoint: `ws://127.0.0.1:${E2E_PORTS.browser}/` } }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        ...(containerBrowser
          ? {}
          : {
              launchOptions: {
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
              },
            }),
      },
    },
  ],
  webServer: [
    {
      name: 'stub',
      // Resets and seeds the database first, so the API and the worker start on a clean state.
      command:
        'tsx tests/e2e/support/prepare-database.ts && exec tsx tests/e2e/support/graph-stub.ts',
      url: `${STUB_ORIGIN}/__stub/health`,
      env: { E2E_DATABASE_URL: databaseUrl },
      timeout: 180_000,
      stdout: 'pipe',
      gracefulShutdown: graceful,
    },
    {
      name: 'api',
      command: 'exec node ../api/dist/main.js',
      url: `${API_BASE}/health/live`,
      env: apiEnv(databaseUrl),
      timeout: 60_000,
      gracefulShutdown: graceful,
    },
    {
      name: 'worker',
      command: 'exec node ../worker/dist/main.js',
      wait: { stdout: /pg-boss background queue engine initialized and started/ },
      env: workerEnv(databaseUrl),
      timeout: 60_000,
      gracefulShutdown: graceful,
    },
    {
      name: 'web',
      command: `${process.env.E2E_SKIP_WEB_BUILD ? '' : 'next build && '}exec next start -p ${E2E_PORTS.web}`,
      url: WEB_ORIGIN,
      env: webEnv(),
      timeout: 300_000,
      gracefulShutdown: graceful,
    },
    ...(containerBrowser
      ? [
          {
            name: 'browser',
            command: 'sh tests/e2e/support/browser-server.sh',
            env: {
              PLAYWRIGHT_IMAGE,
              PLAYWRIGHT_CORE_DIR: playwrightCoreDir,
              BROWSER_PORT: String(E2E_PORTS.browser),
            },
            port: E2E_PORTS.browser,
            timeout: 180_000,
            gracefulShutdown: graceful,
          },
        ]
      : []),
  ],
});
