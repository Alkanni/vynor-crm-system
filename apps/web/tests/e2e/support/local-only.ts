import { expect, test as base } from '@playwright/test';

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

/**
 * `test` for the WU-03 specs: every page may only talk to the local stack. A request to any
 * other host (a live provider, a CDN, Supabase) is aborted and fails the test afterwards.
 */
export const test = base.extend<{ localOnly: void }>({
  localOnly: [
    async ({ page }, use) => {
      const blocked: string[] = [];
      await page.route(
        (url) => !LOCAL_HOSTS.includes(url.hostname),
        async (route) => {
          blocked.push(route.request().url());
          await route.abort('blockedbyclient');
        },
      );
      await use();
      expect(blocked, 'requests to hosts outside the local stack').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
