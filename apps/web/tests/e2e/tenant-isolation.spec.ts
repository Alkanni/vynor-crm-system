import { expect, test } from './support/local-only';
import { E2E_USERS, STUB_PHONES } from './support/e2e-env';
import {
  callApi,
  closeE2eDatabase,
  connectWhatsAppChannel,
  devSessionToken,
  e2eDatabase,
  signInAs,
  stub,
  type ConnectedChannel,
} from './support/stack';

/**
 * Tenant isolation with the second-tenant fixture (VYN-03-01/04): the admin of "E2E Tenant B"
 * sees only Tenant B's conversations in the Inbox and gets 404 for Tenant A's records by ID,
 * and 403 when naming Tenant A's workspace. The HTTP integration specs cover the full matrix.
 */

const TENANT_A_CUSTOMER = { phone: '6281266660001', name: 'Ani Tenant A' };
const TENANT_B_CUSTOMER = { phone: '6281255550001', name: 'Budi Tenant B' };

test.describe.configure({ mode: 'serial' });

let tenantAToken: string;
let tenantBToken: string;
let channelA: ConnectedChannel;

async function conversationOf(channel: ConnectedChannel) {
  await expect
    .poll(() => e2eDatabase().conversation.count({ where: { providerAccountId: channel.id } }))
    .toBe(1);
  return e2eDatabase().conversation.findFirstOrThrow({
    where: { providerAccountId: channel.id },
    include: { messages: true },
  });
}

test.beforeAll(async () => {
  tenantAToken = await devSessionToken(E2E_USERS.admin);
  tenantBToken = await devSessionToken(E2E_USERS.tenantB);
  channelA = await connectWhatsAppChannel(tenantAToken, {
    name: 'WhatsApp Tenant A',
    phoneNumberId: STUB_PHONES.tenantA.id,
    appSecret: 'e2eTenantAAppSecret0123456789abc',
  });
  const channelB = await connectWhatsAppChannel(tenantBToken, {
    name: 'WhatsApp Tenant B',
    phoneNumberId: STUB_PHONES.tenantB.id,
    appSecret: 'e2eTenantBAppSecret0123456789abc',
  });
  await stub.inbound({
    phoneNumberId: channelA.phoneNumberId,
    from: TENANT_A_CUSTOMER.phone,
    name: TENANT_A_CUSTOMER.name,
    text: 'Pesan rahasia tenant A',
    wamid: 'wamid.E2E-TENANT-A-0001',
  });
  await stub.inbound({
    phoneNumberId: channelB.phoneNumberId,
    from: TENANT_B_CUSTOMER.phone,
    name: TENANT_B_CUSTOMER.name,
    text: 'Halo dari tenant B',
    wamid: 'wamid.E2E-TENANT-B-0001',
  });
  await conversationOf(channelB);
});

test.afterAll(async () => {
  await closeE2eDatabase();
});

test("Tenant B's Inbox lists only Tenant B's conversations", async ({ page }) => {
  await signInAs(page, E2E_USERS.tenantB);
  await page.goto('/inbox');
  await page.getByRole('tab', { name: /^All/ }).click();
  const queue = page.getByRole('listbox', { name: 'Conversations' });
  await expect(
    queue.getByRole('option', { name: new RegExp(TENANT_B_CUSTOMER.name) }),
  ).toBeVisible();
  await expect(queue.getByRole('option')).toHaveCount(1);
  await expect(page.getByText(TENANT_A_CUSTOMER.name)).toHaveCount(0);
});

test("Tenant B gets 404 for Tenant A's records and 403 for Tenant A's workspace", async () => {
  const conversationA = await conversationOf(channelA);
  const messageA = conversationA.messages[0]!;

  const list = await callApi<{ data: { id: string }[] }>(
    tenantBToken,
    'GET',
    '/conversations?status=ALL',
  );
  expect(list.status).toBe(200);
  expect(list.body.data.map((c) => c.id)).not.toContain(conversationA.id);

  const probes: [string, string, unknown?][] = [
    ['GET', `/conversations/${conversationA.id}`],
    ['GET', `/conversations/${conversationA.id}/messages`],
    ['PATCH', `/conversations/${conversationA.id}`, { status: 'RESOLVED' }],
    ['POST', `/conversations/${conversationA.id}/messages`, { text: 'cross-tenant' }],
    ['POST', `/conversations/${conversationA.id}/read`],
    ['POST', `/messages/${messageA.id}/retry`],
    ['GET', `/channels/${channelA.id}`],
  ];
  for (const [method, path, body] of probes) {
    const response = await callApi(tenantBToken, method, path, body);
    expect(response.status, `${method} ${path}`).toBe(404);
  }

  // Tenant A's data is untouched by the attempts.
  const after = await e2eDatabase().conversation.findUniqueOrThrow({
    where: { id: conversationA.id },
    include: { messages: true },
  });
  expect(after.status).toBe('OPEN');
  expect(after.messages).toHaveLength(1);

  // Naming Tenant A's workspace explicitly is refused before any data is read.
  const foreign = await callApi<{ code: string }>(
    tenantBToken,
    'GET',
    '/conversations',
    undefined,
    {
      'x-workspace-id': conversationA.workspaceId,
    },
  );
  expect(foreign.status).toBe(403);
  expect(foreign.body.code).toBe('MEMBERSHIP_NOT_FOUND');
});
