import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  conversationRoomName,
  REALTIME_NOTIFY_CHANNEL,
  RealtimeNotificationSchema,
  workspaceRoomName,
  type ApiEnv,
} from '@vynor/contracts';
import pg from 'pg';
import { API_ENV } from '../config/api-env.js';
import { RealtimePublisherService } from './realtime-publisher.service.js';

/**
 * Relays Postgres NOTIFY hints (written by the worker and API inside their transactions) to
 * Socket.IO rooms. Every API instance listens, so clients on any instance are notified.
 * LISTEN needs a session connection, hence DIRECT_URL rather than the pooled DATABASE_URL.
 */
@Injectable()
export class RealtimeRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeRelayService.name);
  private client: pg.Client | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private attempt = 0;

  constructor(
    private readonly publisher: RealtimePublisherService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  onModuleInit(): void {
    if (this.env.NODE_ENV === 'test') return;
    void this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.client?.end().catch(() => undefined);
    this.client = null;
  }

  private async connect(): Promise<void> {
    const client = new pg.Client({
      connectionString: this.env.DIRECT_URL || this.env.DATABASE_URL,
    });
    client.on('notification', (message) => this.handle(message.payload));
    client.on('error', (error) => {
      this.logger.warn(`Realtime relay connection error: ${error.message}`);
      this.scheduleReconnect();
    });
    client.on('end', () => this.scheduleReconnect());
    try {
      await client.connect();
      await client.query(`LISTEN ${REALTIME_NOTIFY_CHANNEL}`);
      this.client = client;
      this.attempt = 0;
      this.logger.log('Realtime relay listening for database notifications');
    } catch (error) {
      this.logger.warn(`Realtime relay could not connect: ${(error as Error).message}`);
      await client.end().catch(() => undefined);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.client = null;
    const delay = Math.min(30_000, 1000 * 2 ** this.attempt++);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private handle(payload: string | undefined): void {
    if (!payload) return;
    let parsed;
    try {
      parsed = RealtimeNotificationSchema.safeParse(JSON.parse(payload));
    } catch {
      return;
    }
    if (!parsed.success) return;
    const notification = parsed.data;
    try {
      const rooms: string[] = [workspaceRoomName(notification.workspaceId)];
      if (notification.conversationId)
        rooms.push(conversationRoomName(notification.conversationId));
      this.publisher.publish({
        eventId: randomUUID(),
        eventType: notification.eventType,
        workspaceId: notification.workspaceId,
        rooms,
        occurredAt: new Date().toISOString(),
        correlationId: notification.correlationId ?? 'realtime-relay',
        payload: {
          ...(notification.conversationId ? { conversationId: notification.conversationId } : {}),
          ...(notification.messageId ? { messageId: notification.messageId } : {}),
          ...(notification.channelId ? { channelId: notification.channelId } : {}),
        },
      });
    } catch (error) {
      this.logger.warn(`Dropped realtime notification: ${(error as Error).message}`);
    }
  }
}
