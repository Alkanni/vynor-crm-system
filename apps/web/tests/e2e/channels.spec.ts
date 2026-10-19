import { expect, test } from './support/local-only';
import { STUB_PHONES, STUB_WABA_ID } from './support/e2e-env';
import {
  attachProviderTrace,
  closeE2eDatabase,
  e2eDatabase,
  signInWithDevSession,
  stub,
} from './support/stack';

/**
 * Channels E2E (VYN-03-04): an admin connects a WhatsApp Business number through the Channels
 * page; the API verifies the credentials against the provider stub, stores them sealed, and the
 * channel is listed and can be health-checked.
 */

const NAME = 'WhatsApp Channels UI';
const ACCESS_TOKEN = 'EAAGe2eChannelsUiAccessToken000000';
const APP_SECRET = 'e2eChannelsUiAppSecret0123456789';

// Playwright requires a destructuring pattern as the first argument, even without fixtures.
// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  await attachProviderTrace(testInfo);
});

test.afterAll(async () => {
  await closeE2eDatabase();
});

test('an admin connects WhatsApp Business through the Channels page against the stub', async ({
  page,
}) => {
  await signInWithDevSession(page, '/channels');
  const since = (await stub.calls()).at(-1)?.seq ?? 0;

  await page
    .getByRole('button', { name: /connect a platform/i })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /WhatsApp Business/ }).click();
  await dialog.getByLabel('Inbox name').fill(NAME);
  await dialog.getByLabel('Phone number ID').fill(STUB_PHONES.channelsUi.id);
  await dialog.getByLabel('WhatsApp Business Account ID').fill(STUB_WABA_ID);
  await dialog.getByLabel('Permanent access token').fill(ACCESS_TOKEN);
  await dialog.getByLabel('App secret').fill(APP_SECRET);
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();

  // The dialog confirms the verified number and, since the API is not on public HTTPS, explains
  // that the callback URL must be configured manually.
  await expect(dialog.getByRole('heading', { name: `${NAME} is connected` })).toBeVisible();
  await expect(dialog).toContainText(
    `WhatsApp Business verified ${STUB_PHONES.channelsUi.display}.`,
  );
  await expect(dialog).toContainText('only delivers to public HTTPS addresses');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();

  const inboxes = page.getByRole('region', { name: 'Connected inboxes' });
  const card = inboxes.getByRole('button', { name: new RegExp(NAME) });
  await expect(card).toBeVisible();
  await expect(card).toContainText(STUB_PHONES.channelsUi.display);

  // The API verified the number and subscribed the app, all against the stub.
  const calls = (await stub.calls()).filter((call) => call.seq > since);
  expect(calls.map((call) => `${call.method} ${call.path} ${call.status}`)).toEqual([
    `GET /meta/v26.0/${STUB_PHONES.channelsUi.id} 200`,
    `GET /meta/v26.0/${STUB_WABA_ID}/phone_numbers 200`,
    `POST /meta/v26.0/${STUB_WABA_ID}/subscribed_apps 200`,
  ]);

  const channel = await e2eDatabase().providerAccount.findFirstOrThrow({
    where: { name: NAME, deletedAt: null },
  });
  expect(channel).toMatchObject({
    provider: 'WHATSAPP_CLOUD',
    channelType: 'WHATSAPP',
    accountIdentifier: STUB_PHONES.channelsUi.id,
    status: 'ACTIVE',
  });
  // Credentials are stored sealed, never as plaintext.
  const stored = JSON.stringify(channel.credentials);
  expect(stored).not.toContain(ACCESS_TOKEN);
  expect(stored).not.toContain(APP_SECRET);

  // "Test connection" runs the provider health check against the stub.
  await expect(card).toHaveAttribute('aria-current', 'true');
  const beforeTest = (await stub.calls()).at(-1)?.seq ?? 0;
  await page.getByRole('button', { name: 'Test connection' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await expect
    .poll(async () =>
      (await stub.calls())
        .filter((call) => call.seq > beforeTest)
        .map((call) => `${call.method} ${call.path}`),
    )
    .toEqual([`GET /meta/v26.0/${STUB_PHONES.channelsUi.id}`]);
});
