import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerEnvSchema } from '@vynor/contracts';
import {
  ChannelProviderError,
  type AnyChannelAdapter,
  type PollResult,
} from '@vynor/channel-adapters';
import {
  createTestPrismaClient,
  type Prisma,
  type PrismaClient,
  type ProviderAccount,
} from '@vynor/database';
import { ChannelHealthRecorder } from '../src/channels/channel-health.service.js';
import { WorkerChannelRuntime } from '../src/channels/channel-runtime.service.js';
import { ChannelPollingService } from '../src/polling/channel-polling.service.js';

/**
 * WU-03 / VYN-03-03: characterization of IMAP/Telegram polling against the test database: the
 * per-channel lease, journaling + cursor in one transaction, lease release and exponential
 * backoff on errors, and when failures are surfaced on the channel. The provider is a fake
 * adapter; everything else (lease SQL, journal, outbox, health recorder) is real.
 */

const env = WorkerEnvSchema.parse({
  APP_ENV: 'test',
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unused',
  DIRECT_URL: 'postgresql://unused',
  STORAGE_ACCESS_KEY_ID: 'key',
  STORAGE_SECRET_ACCESS_KEY: 'secret',
});
const EMAIL_INTERVAL_MS = env.EMAIL_POLL_INTERVAL_SECONDS * 1000;
const TELEGRAM_INTERVAL_MS = env.TELEGRAM_POLL_INTERVAL_SECONDS * 1000;

type Poll = (cursor: Record<string, unknown> | null) => Promise<PollResult>;

const event = (key: string) => ({
  providerEventKey: key,
  isFingerprinted: false,
  payload: { key },
});

describe('Channel polling (WU-03 characterization)', () => {
  let db: PrismaClient;
  let workspaceId: string;
  let email: ProviderAccount;
  let telegram: ProviderAccount;
  let poll: ReturnType<typeof vi.fn<Poll>>;
  let service: ChannelPollingService;
  let health: ChannelHealthRecorder;

  const schedules = () =>
    (service as unknown as { schedules: Map<string, { nextDueAt: number; failures: number }> })
      .schedules;
  const reload = (id: string) => db.providerAccount.findUniqueOrThrow({ where: { id } });

  /**
   * Polls once and checks the next due time is `delayMs` after the moment the poll finished:
   * the schedule is computed between `before` and `after`, so no timing tolerance is needed.
   */
  async function expectNextPollAfter(channel: ProviderAccount, delayMs: number) {
    const before = Date.now();
    const accepted = await service.pollChannel(channel);
    const after = Date.now();
    const schedule = schedules().get(channel.id)!;
    expect(schedule.nextDueAt).toBeGreaterThanOrEqual(before + delayMs);
    expect(schedule.nextDueAt).toBeLessThanOrEqual(after + delayMs);
    return { accepted, schedule };
  }

  beforeAll(async () => {
    db = createTestPrismaClient();
    const workspace = await db.workspace.create({
      data: { name: 'Polling Characterization', slug: `polling-char-${Date.now()}` },
    });
    workspaceId = workspace.id;
    const channel = (data: Partial<Prisma.ProviderAccountUncheckedCreateInput>) =>
      db.providerAccount.create({
        data: {
          workspaceId,
          name: 'Polling channel',
          accountIdentifier: `polling-${Math.random().toString(36).slice(2)}`,
          credentials: {},
          config: { inboundMode: 'POLLING' },
          channelType: 'EMAIL',
          provider: 'EMAIL_SMTP_IMAP',
          ...data,
        },
      });
    email = await channel({ syncState: { uidNext: 10 } });
    telegram = await channel({
      channelType: 'TELEGRAM',
      provider: 'TELEGRAM_BOT',
      syncState: { offset: 100 },
    });
  });

  beforeEach(() => {
    poll = vi.fn<Poll>();
    const runtime = new WorkerChannelRuntime(env);
    vi.spyOn(runtime, 'adapter').mockReturnValue({
      pollInbound: (_account: unknown, cursor: Record<string, unknown> | null) => poll(cursor),
    } as unknown as AnyChannelAdapter);
    vi.spyOn(runtime, 'account').mockImplementation(
      (channel) => ({ id: channel.id }) as unknown as ReturnType<WorkerChannelRuntime['account']>,
    );
    health = new ChannelHealthRecorder();
    vi.spyOn(health, 'recordFailure');
    vi.spyOn(health, 'recordSuccess');
    service = new ChannelPollingService(env, runtime, health);
  });

  afterAll(async () => {
    if (!db) return;
    await db.workspace.delete({ where: { id: workspaceId } });
    await db.$disconnect();
  });

  it('leases the channel, journals new events with the cursor, then releases the lease', async () => {
    let leaseDuringPoll: Date | null = null;
    poll.mockImplementation(async (cursor) => {
      expect(cursor).toEqual({ uidNext: 10 });
      leaseDuringPoll = (await reload(email.id)).syncLeaseExpiresAt;
      return { events: [event('imap:uid:10'), event('imap:uid:11')], cursor: { uidNext: 12 } };
    });

    const before = Date.now();
    expect(await service.pollChannel(email)).toBe(2);

    // The lease runs 120 s from the database clock.
    expect(leaseDuringPoll).not.toBeNull();
    const leaseSeconds = (leaseDuringPoll!.getTime() - before) / 1000;
    expect(leaseSeconds).toBeGreaterThan(110);
    expect(leaseSeconds).toBeLessThan(130);

    const after = await reload(email.id);
    expect(after.syncState).toEqual({ uidNext: 12 });
    expect(after.syncLeaseExpiresAt).toBeNull();
    expect(after.lastHealthCheckAt).not.toBeNull();
    const journal = await db.providerEvent.findMany({
      where: { providerAccountId: email.id },
      orderBy: { providerEventKey: 'asc' },
    });
    expect(journal.map((e) => e.providerEventKey)).toEqual(['imap:uid:10', 'imap:uid:11']);
    expect(
      await db.outboxEvent.count({ where: { workspaceId, eventType: 'webhook.received' } }),
    ).toBe(2);
    expect(health.recordSuccess).toHaveBeenCalledTimes(1);
    expect(schedules().get(email.id)?.failures).toBe(0);
    expect(schedules().get(email.id)!.nextDueAt - before).toBeGreaterThanOrEqual(EMAIL_INTERVAL_MS);
  });

  it('skips duplicates but still advances the cursor', async () => {
    poll.mockResolvedValue({
      events: [event('imap:uid:11'), event('imap:uid:12')],
      cursor: { uidNext: 13 },
    });
    expect(await service.pollChannel(email)).toBe(1);
    expect((await reload(email.id)).syncState).toEqual({ uidNext: 13 });
  });

  it('does not poll while another worker holds an unexpired lease', async () => {
    const held = new Date(Date.now() + 60_000);
    await db.providerAccount.update({
      where: { id: email.id },
      data: { syncLeaseExpiresAt: held },
    });
    expect(await service.pollChannel(email)).toBe(0);
    expect(poll).not.toHaveBeenCalled();
    expect((await reload(email.id)).syncLeaseExpiresAt).toEqual(held);

    // An expired lease (a crashed worker) is taken over.
    await db.providerAccount.update({
      where: { id: email.id },
      data: { syncLeaseExpiresAt: new Date(Date.now() - 1_000) },
    });
    poll.mockResolvedValue({ events: [], cursor: { uidNext: 13 } });
    expect(await service.pollChannel(email)).toBe(0);
    expect(poll).toHaveBeenCalledTimes(1);
    expect((await reload(email.id)).syncLeaseExpiresAt).toBeNull();
  });

  it('releases the lease, keeps the cursor and backs off exponentially on errors', async () => {
    poll.mockRejectedValue(
      new ChannelProviderError({
        provider: 'TELEGRAM_BOT',
        category: 'TRANSIENT',
        code: 'PROVIDER_UNREACHABLE',
        message: 'Could not reach the Telegram API.',
      }),
    );

    // interval × 2^failures: 3 s → 6, 12, 24 s.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { accepted, schedule } = await expectNextPollAfter(
        telegram,
        TELEGRAM_INTERVAL_MS * 2 ** attempt,
      );
      expect(accepted).toBe(0);
      expect(schedule.failures).toBe(attempt);
      // Retryable failures are surfaced on the channel only from the third one on.
      expect(health.recordFailure).toHaveBeenCalledTimes(attempt < 3 ? 0 : 1);
    }

    const after = await reload(telegram.id);
    expect(after.syncLeaseExpiresAt).toBeNull();
    expect(after.syncState).toEqual({ offset: 100 });
    expect(after.status).toBe('ERROR');
    expect(await db.providerEvent.count({ where: { providerAccountId: telegram.id } })).toBe(0);

    // The backoff is capped at five minutes.
    schedules().get(telegram.id)!.failures = 20;
    await expectNextPollAfter(telegram, 5 * 60_000);
  });

  it('surfaces a permanent error at once and resets the backoff after a success', async () => {
    poll.mockRejectedValueOnce(
      new ChannelProviderError({
        provider: 'TELEGRAM_BOT',
        category: 'AUTHENTICATION',
        code: '401',
        message: 'Unauthorized',
      }),
    );
    await service.pollChannel(telegram);
    expect(health.recordFailure).toHaveBeenCalledTimes(1);
    expect((await reload(telegram.id)).status).toBe('DISCONNECTED');

    // A full batch (10 or more events) is followed by another poll one second later.
    const batch = Array.from({ length: 10 }, (_, i) => event(`tg:update:${200 + i}`));
    poll.mockResolvedValueOnce({ events: batch, cursor: { offset: 210 } });
    const { accepted, schedule } = await expectNextPollAfter(telegram, 1_000);
    expect(accepted).toBe(10);
    expect(schedule.failures).toBe(0);
    expect((await reload(telegram.id)).syncState).toEqual({ offset: 210 });
    // A disconnected channel stays disconnected after a successful poll (only ERROR recovers).
    expect((await reload(telegram.id)).status).toBe('DISCONNECTED');
  });

  it('discovers only active polling channels and waits for their next due time', async () => {
    const polled: string[] = [];
    poll.mockImplementation(async () => ({ events: [], cursor: {} }));
    const runtime = (service as unknown as { runtime: WorkerChannelRuntime }).runtime;
    vi.mocked(runtime.account).mockImplementation((channel) => {
      polled.push(channel.id);
      return { id: channel.id } as unknown as ReturnType<WorkerChannelRuntime['account']>;
    });
    await db.providerAccount.update({ where: { id: email.id }, data: { status: 'ACTIVE' } });

    await service.tick();
    await vi.waitFor(() => expect(polled).toContain(email.id));
    // Telegram is DISCONNECTED after the previous test, so discovery leaves it out.
    expect(polled).not.toContain(telegram.id);

    // tick() marks due channels in flight synchronously; email is not due again until its
    // interval has passed, so a second tick leaves it alone.
    const inFlight = (service as unknown as { inFlight: Set<string> }).inFlight;
    await vi.waitFor(() => expect(inFlight.has(email.id)).toBe(false));
    await service.tick();
    expect(inFlight.has(email.id)).toBe(false);
    expect(schedules().get(email.id)!.nextDueAt).toBeGreaterThan(Date.now());
  });
});
