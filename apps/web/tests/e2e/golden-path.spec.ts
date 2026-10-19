import type { Locator, Page } from '@playwright/test';
import { expect, test } from './support/local-only';
import { E2E_USERS, STUB_PHONES } from './support/e2e-env';
import {
  attachProviderTrace,
  closeE2eDatabase,
  connectWhatsAppChannel,
  devSessionToken,
  e2eDatabase,
  signInWithDevSession,
  stub,
  type ConnectedChannel,
} from './support/stack';

/**
 * WU-03 golden path (VYN-03-04) on the current stack (pg-boss, Next.js), with the WhatsApp
 * Cloud API replaced by the provider stub:
 * dev-session login → signed webhook → provider journal → outbox → pg-boss → worker → Inbox,
 * webhook replay without duplicates, agent reply → stub → SENT/DELIVERED/READ, transient retry,
 * permanent failure + Retry, and claim/resolve/reopen with audit entries.
 */

const CUSTOMER = { phone: '6281299990001', name: 'Siti Golden' };
const FIRST_TEXT = 'Halo, pesanan #1001 saya belum sampai';
const INBOUND_WAMID = 'wamid.E2E-INBOUND-0001';

test.describe.configure({ mode: 'serial' });

let channel: ConnectedChannel;
let conversationId: string;
let inboundDeliveryId: number;

test.beforeAll(async () => {
  const token = await devSessionToken(E2E_USERS.admin);
  channel = await connectWhatsAppChannel(token, {
    name: 'WhatsApp Golden Path',
    phoneNumberId: STUB_PHONES.golden.id,
    appSecret: 'e2eGoldenPathAppSecret0123456789',
  });
});

// Playwright requires a destructuring pattern as the first argument, even without fixtures.
// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  await attachProviderTrace(testInfo);
});

test.afterAll(async () => {
  await closeE2eDatabase();
});

async function openGoldenConversation(page: Page): Promise<Locator> {
  await signInWithDevSession(page, '/inbox');
  // The queue opens on "Mine"; "All" lists every open conversation.
  await page.getByRole('tab', { name: /^All/ }).click();
  const row = page.getByRole('listbox', { name: 'Conversations' }).getByRole('option', {
    name: new RegExp(CUSTOMER.name),
  });
  await row.click();
  return page.getByRole('log', { name: 'Conversation messages' });
}

/** The message bubble that contains `text` in the open conversation. */
function bubble(timeline: Locator, text: string): Locator {
  return timeline.locator('[data-message-id]').filter({ hasText: text });
}

async function lastStubSeq(): Promise<number> {
  const calls = await stub.calls();
  return calls.at(-1)?.seq ?? 0;
}

async function sendOutcomesSince(seq: number): Promise<(string | undefined)[]> {
  return (await stub.calls())
    .filter((call) => call.seq > seq && call.to === CUSTOMER.phone)
    .map((call) => call.outcome);
}

async function reply(page: Page, text: string): Promise<void> {
  const composer = page.getByRole('textbox', { name: 'Reply to customer' });
  await composer.fill(text);
  await page.getByRole('button', { name: /^Send/ }).click();
}

async function outboundMessage(text: string) {
  return e2eDatabase().message.findFirstOrThrow({
    where: { conversationId, direction: 'OUTBOUND', text },
  });
}

test('a signed webhook reaches the Inbox through journal, outbox, pg-boss and the worker', async ({
  page,
}) => {
  await signInWithDevSession(page, '/inbox');
  // Connected to the real API: an empty workspace shows the empty state, not sample data.
  await expect(page.getByRole('heading', { name: 'No conversations yet' })).toBeVisible();
  const queue = page.getByRole('listbox', { name: 'Conversations' });

  const delivery = await stub.inbound({
    phoneNumberId: channel.phoneNumberId,
    from: CUSTOMER.phone,
    name: CUSTOMER.name,
    text: FIRST_TEXT,
    wamid: INBOUND_WAMID,
  });
  inboundDeliveryId = delivery.id;
  expect(delivery.status).toBe(200);
  expect(delivery.response).toEqual({ received: true, accepted: 1, duplicates: 0 });

  const db = e2eDatabase();
  const journal = await db.providerEvent.findFirstOrThrow({
    where: { providerAccountId: channel.id, providerEventKey: `msg:${INBOUND_WAMID}` },
  });
  const outbox = await db.outboxEvent.findFirstOrThrow({
    where: { eventType: 'webhook.received', payload: { equals: { providerEventId: journal.id } } },
  });
  // The worker claims the outbox row, pg-boss runs the job, the journal entry is processed.
  await expect
    .poll(async () => (await db.outboxEvent.findUnique({ where: { id: outbox.id } }))?.status)
    .toBe('COMPLETED');
  await expect
    .poll(async () => {
      const [job] = await db.$queryRaw<{ state: string }[]>`
        SELECT state::text FROM pgboss.job WHERE singleton_key = ${`outbox:${outbox.id}`}
      `;
      return job?.state;
    })
    .toBe('completed');
  await expect
    .poll(async () => (await db.providerEvent.findUnique({ where: { id: journal.id } }))?.status)
    .toBe('PROCESSED');

  // Realtime pushes the new conversation and the Inbox opens it; the queue still shows "Mine"
  // (empty), and the conversation is counted under Unassigned and All.
  await expect(page.getByRole('log', { name: 'Conversation messages' })).toContainText(FIRST_TEXT);
  await expect(page.getByRole('tab', { name: /^Unassigned\s*1$/ })).toBeVisible();
  await page.getByRole('tab', { name: /^All/ }).click();
  await expect(queue.getByRole('option', { name: new RegExp(CUSTOMER.name) })).toBeVisible();

  const conversation = await db.conversation.findFirstOrThrow({
    where: { providerAccountId: channel.id, contactIdentity: { externalId: CUSTOMER.phone } },
  });
  conversationId = conversation.id;
});

test('replaying the same signed webhook creates no duplicate contact, conversation or message', async ({
  page,
}) => {
  const db = e2eDatabase();
  const scope = { providerAccountId: channel.id };
  const before = {
    identities: await db.contactIdentity.count({ where: scope }),
    conversations: await db.conversation.count({ where: scope }),
    messages: await db.message.count({ where: scope }),
    journal: await db.providerEvent.count({ where: scope }),
  };
  expect(before).toEqual({ identities: 1, conversations: 1, messages: 1, journal: 1 });

  const replay = await stub.replay(inboundDeliveryId);
  expect(replay.status).toBe(200);
  expect(replay.response).toEqual({ received: true, accepted: 0, duplicates: 1 });

  const after = {
    identities: await db.contactIdentity.count({ where: scope }),
    conversations: await db.conversation.count({ where: scope }),
    messages: await db.message.count({ where: scope }),
    journal: await db.providerEvent.count({ where: scope }),
  };
  expect(after).toEqual(before);

  const timeline = await openGoldenConversation(page);
  await expect(timeline.getByText(FIRST_TEXT)).toHaveCount(1);
});

test('an agent reply reaches the stub and receipts move it SENT → DELIVERED → READ, never back', async ({
  page,
}) => {
  const timeline = await openGoldenConversation(page);
  const since = await lastStubSeq();
  const text = 'Pesanan #1001 sedang dikirim hari ini.';

  await reply(page, text);
  await expect(bubble(timeline, text).getByLabel('Sent')).toBeVisible();
  expect(await sendOutcomesSince(since)).toEqual(['success']);

  const sent = await outboundMessage(text);
  expect(sent.status).toBe('SENT');
  expect(sent.providerMessageId).toMatch(/^wamid\.E2E\d+$/);
  const wamid = sent.providerMessageId!;

  expect((await stub.receipt(wamid, 'delivered')).status).toBe(200);
  await expect(bubble(timeline, text).getByLabel('Delivered')).toBeVisible();
  expect((await stub.receipt(wamid, 'read')).status).toBe(200);
  await expect(bubble(timeline, text).getByLabel('Read')).toBeVisible();

  // A late "delivered" after "read" must not move the status backwards.
  expect((await stub.receipt(wamid, 'delivered')).status).toBe(200);
  const statusKey = `status:${wamid}:delivered`;
  await expect
    .poll(async () => {
      const events = await e2eDatabase().providerEvent.findMany({
        where: { providerAccountId: channel.id, providerEventKey: statusKey },
      });
      return events.map((event) => event.status);
    })
    .toEqual(['PROCESSED']);
  const final = await outboundMessage(text);
  expect(final.status).toBe('READ');
  expect(final.deliveredAt).not.toBeNull();
  expect(final.readAt).not.toBeNull();
  await expect(bubble(timeline, text).getByLabel('Read')).toBeVisible();
});

test('a transient provider failure is retried by the queue and then succeeds', async ({ page }) => {
  test.setTimeout(90_000);
  const timeline = await openGoldenConversation(page);
  const since = await lastStubSeq();
  const text = 'Mohon ditunggu, kami cek ulang.';
  await stub.queueOutcomes(CUSTOMER.phone, ['transient']);

  await reply(page, text);
  // pg-boss retries the send after its retry delay (5 s for the outbound queue).
  await expect(bubble(timeline, text).getByLabel('Sent')).toBeVisible({ timeout: 45_000 });
  expect(await sendOutcomesSince(since)).toEqual(['transient', 'success']);

  const sent = await outboundMessage(text);
  expect(sent.status).toBe('SENT');
  expect(sent.errorCode).toBeNull();
});

test('a permanent provider failure marks the reply FAILED and Retry sends it again', async ({
  page,
}) => {
  const timeline = await openGoldenConversation(page);
  const since = await lastStubSeq();
  const text = 'Balasan ini gagal sekali.';
  await stub.queueOutcomes(CUSTOMER.phone, ['permanent']);

  await reply(page, text);
  const failed = bubble(timeline, text);
  await expect(failed.getByText('Failed to send')).toBeVisible();
  const message = await outboundMessage(text);
  expect(message.status).toBe('FAILED');
  expect(message.errorCode).toBe('131026');
  expect(await sendOutcomesSince(since)).toEqual(['permanent']);

  await failed.getByRole('button', { name: 'Retry' }).click();
  await expect(bubble(timeline, text).getByLabel('Sent')).toBeVisible();
  expect(await sendOutcomesSince(since)).toEqual(['permanent', 'success']);
  expect((await outboundMessage(text)).status).toBe('SENT');
});

test('claim, resolve and reopen are recorded in the timeline and the audit log', async ({
  page,
}) => {
  const timeline = await openGoldenConversation(page);
  const db = e2eDatabase();
  const auditCount = () =>
    db.auditLog.count({ where: { resourceType: 'conversation', resourceId: conversationId } });
  expect(await auditCount()).toBe(0);

  await page.getByRole('button', { name: 'Claim' }).click();
  await expect(timeline.getByText('Dev Administrator took this conversation')).toBeVisible();
  await page.getByRole('button', { name: 'Resolve' }).click();
  await expect(timeline.getByText('Resolved by Dev Administrator')).toBeVisible();
  await page.getByRole('button', { name: 'Reopen' }).click();
  await expect(timeline.getByText('Reopened by Dev Administrator')).toBeVisible();

  const admin = await db.workspaceMembership.findFirstOrThrow({
    where: { userProfile: { email: E2E_USERS.admin } },
  });
  const audit = await db.auditLog.findMany({
    where: { resourceType: 'conversation', resourceId: conversationId },
    orderBy: { createdAt: 'asc' },
    select: { action: true, beforeState: true, afterState: true },
  });
  expect(audit).toEqual([
    {
      action: 'conversation.updated',
      beforeState: { status: 'OPEN', assigneeMembershipId: null },
      afterState: { status: 'OPEN', assigneeMembershipId: admin.id },
    },
    {
      action: 'conversation.updated',
      beforeState: { status: 'OPEN', assigneeMembershipId: admin.id },
      afterState: { status: 'RESOLVED', assigneeMembershipId: admin.id },
    },
    {
      action: 'conversation.updated',
      beforeState: { status: 'RESOLVED', assigneeMembershipId: admin.id },
      afterState: { status: 'OPEN', assigneeMembershipId: admin.id },
    },
  ]);
  const conversation = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  expect(conversation.status).toBe('OPEN');
  expect(conversation.assigneeMembershipId).toBe(admin.id);
});
