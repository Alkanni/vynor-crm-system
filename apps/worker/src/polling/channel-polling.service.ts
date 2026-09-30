import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { ChannelProviderType, ChannelType, WorkerEnv } from '@vynor/contracts';
import { toChannelProviderError } from '@vynor/channel-adapters';
import {
  journalProviderEventsInTransaction,
  prisma,
  type Prisma,
  type ProviderAccount,
} from '@vynor/database';
import { createLogger, type Logger } from '@vynor/observability';
import { ChannelHealthRecorder } from '../channels/channel-health.service.js';
import { WorkerChannelRuntime } from '../channels/channel-runtime.service.js';
import { WORKER_ENV } from '../config/worker-env.js';

/** How often the list of polling channels is refreshed. */
const DISCOVERY_INTERVAL_MS = 5_000;
/** Lease a worker holds on a channel while polling it (another worker skips it meanwhile). */
const LEASE_SECONDS = 120;
const MAX_BACKOFF_MS = 5 * 60_000;
const MAX_PARALLEL_POLLS = 10;

interface Schedule {
  nextDueAt: number;
  failures: number;
}

/**
 * Pulls inbound messages for channels without webhooks: IMAP mailboxes, and Telegram bots
 * when no public HTTPS URL is configured. Events go through the same journal + outbox path
 * as webhooks, and the cursor is saved in that same transaction (AD-004, AD-005).
 */
@Injectable()
export class ChannelPollingService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger: Logger = createLogger({
    service: 'vynor-worker',
    environment: process.env.NODE_ENV || 'development',
  });
  private readonly schedules = new Map<string, Schedule>();
  private readonly inFlight = new Set<string>();
  private channels: ProviderAccount[] = [];
  private timer: NodeJS.Timeout | null = null;
  private discoveredAt = 0;
  private stopped = false;

  constructor(
    @Inject(WORKER_ENV) private readonly env: WorkerEnv,
    private readonly runtime: WorkerChannelRuntime,
    private readonly health: ChannelHealthRecorder,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test' || !this.env.CHANNEL_POLLING_ENABLED) return;
    this.timer = setInterval(() => void this.tick(), 1_000);
    this.logger.info({ correlationId: 'polling_start' }, 'Channel polling loop started');
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    for (let i = 0; i < 50 && this.inFlight.size > 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private intervalFor(channel: ProviderAccount): number {
    return (
      (channel.channelType === 'EMAIL'
        ? this.env.EMAIL_POLL_INTERVAL_SECONDS
        : this.env.TELEGRAM_POLL_INTERVAL_SECONDS) * 1000
    );
  }

  async tick(): Promise<void> {
    if (this.stopped) return;
    const now = Date.now();
    if (now - this.discoveredAt > DISCOVERY_INTERVAL_MS) {
      this.discoveredAt = now;
      this.channels = await prisma.providerAccount
        .findMany({
          where: {
            deletedAt: null,
            status: { in: ['ACTIVE', 'ERROR'] },
            config: { path: ['inboundMode'], equals: 'POLLING' },
          },
        })
        .catch((error: unknown) => {
          this.logger.warn(
            { err: { message: (error as Error).message } },
            'Polling discovery failed',
          );
          return this.channels;
        });
    }

    const due = this.channels.filter((channel) => {
      if (this.inFlight.has(channel.id)) return false;
      const schedule = this.schedules.get(channel.id);
      return !schedule || schedule.nextDueAt <= now;
    });
    for (const channel of due.slice(0, Math.max(0, MAX_PARALLEL_POLLS - this.inFlight.size))) {
      this.inFlight.add(channel.id);
      void this.pollChannel(channel).finally(() => this.inFlight.delete(channel.id));
    }
  }

  /** Polls one channel if its lease is free. Returns the number of new events. */
  async pollChannel(channel: ProviderAccount): Promise<number> {
    const leased = await prisma.$queryRaw<{ id: string; sync_state: Prisma.JsonValue }[]>`
      UPDATE provider_accounts
      SET sync_lease_expires_at = NOW() + (${LEASE_SECONDS} * INTERVAL '1 second')
      WHERE id = ${channel.id}
        AND deleted_at IS NULL
        AND (sync_lease_expires_at IS NULL OR sync_lease_expires_at < NOW())
      RETURNING id, sync_state
    `;
    const lease = leased[0];
    if (!lease) return 0;

    const schedule = this.schedules.get(channel.id) ?? { nextDueAt: 0, failures: 0 };
    try {
      const adapter = this.runtime.adapter(channel.provider);
      if (!adapter.pollInbound) throw new Error(`${channel.provider} does not support polling.`);
      const cursor =
        lease.sync_state && typeof lease.sync_state === 'object'
          ? (lease.sync_state as Record<string, unknown>)
          : null;
      const result = await adapter.pollInbound(this.runtime.account(channel), cursor);

      const accepted = await prisma.$transaction(async (tx) => {
        const journal = await journalProviderEventsInTransaction(tx, {
          workspaceId: channel.workspaceId,
          providerAccountId: channel.id,
          provider: channel.provider,
          channelType: channel.channelType as ChannelType,
          correlationId: `poll_${channel.id}_${Date.now()}`,
          events: result.events,
        });
        await tx.providerAccount.update({
          where: { id: channel.id },
          data: {
            syncState: result.cursor as Prisma.InputJsonValue,
            syncLeaseExpiresAt: null,
            lastHealthCheckAt: new Date(),
          },
        });
        return journal.acceptedEventIds.length;
      });

      await this.health.recordSuccess(channel);
      schedule.failures = 0;
      // More mail may be waiting when a batch came back full; poll again soon.
      schedule.nextDueAt =
        Date.now() + (result.events.length >= 10 ? 1_000 : this.intervalFor(channel));
      this.schedules.set(channel.id, schedule);
      if (accepted > 0) {
        this.logger.info(
          { correlationId: 'poll', channelId: channel.id, accepted },
          'Polled new inbound events',
        );
      }
      return accepted;
    } catch (error) {
      await prisma.providerAccount
        .update({ where: { id: channel.id }, data: { syncLeaseExpiresAt: null } })
        .catch(() => undefined);
      const providerError = toChannelProviderError(channel.provider as ChannelProviderType, error);
      schedule.failures += 1;
      schedule.nextDueAt =
        Date.now() + Math.min(MAX_BACKOFF_MS, this.intervalFor(channel) * 2 ** schedule.failures);
      this.schedules.set(channel.id, schedule);
      // Brief network blips are retried quietly; repeated or permanent failures are surfaced.
      if (!providerError.retryable || schedule.failures >= 3) {
        await this.health.recordFailure(channel, providerError);
      }
      this.logger.warn(
        {
          correlationId: 'poll',
          channelId: channel.id,
          failures: schedule.failures,
          err: { message: providerError.message },
        },
        'Channel poll failed',
      );
      return 0;
    }
  }
}
