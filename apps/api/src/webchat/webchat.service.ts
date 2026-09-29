import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { WebchatSettings } from '@vynor/contracts';
import { readConnectionConfig, safeEqual, webchatEventFor } from '@vynor/channel-adapters';
import { journalProviderEvents, notifyRealtime, prisma } from '@vynor/database';
import { z } from 'zod';
import { ChannelRuntimeService } from '../channels/channel-runtime.service.js';
import { apiError } from '../common/errors/api-error.js';

export const WebchatSessionRequestSchema = z.object({
  visitorId: z
    .string()
    .regex(/^v_[A-Za-z0-9_-]{8,64}$/)
    .optional(),
  visitorToken: z.string().max(128).optional(),
});
export type WebchatSessionRequest = z.infer<typeof WebchatSessionRequestSchema>;

export const WebchatMessageRequestSchema = z.object({
  visitorId: z.string().regex(/^v_[A-Za-z0-9_-]{8,64}$/),
  clientMessageId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
  text: z.string().trim().min(1).max(4096),
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(255).optional(),
  pageUrl: z.string().url().max(2048).optional(),
});
export type WebchatMessageRequest = z.infer<typeof WebchatMessageRequestSchema>;

export interface WebchatConfig {
  name: string;
  welcomeMessage: string | null;
  accentColor: string;
}

export interface WebchatMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  text: string;
  senderName: string | null;
  createdAt: string;
}

/** Fixed-window limiter per visitor IP and widget, to keep the public endpoints cheap to abuse. */
class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}
  allow(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt < now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) this.hits.clear();
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }
}

@Injectable()
export class WebchatService {
  private readonly messageLimiter = new RateLimiter(30, 60_000);
  private readonly sessionLimiter = new RateLimiter(20, 60_000);

  constructor(private readonly runtime: ChannelRuntimeService) {}

  private async findChannel(widgetKey: string) {
    const channel = await prisma.providerAccount.findFirst({
      where: { webhookKey: widgetKey, provider: 'WEBCHAT_EMBED', deletedAt: null },
    });
    if (!channel) throw apiError(404, 'WIDGET_NOT_FOUND', 'This chat widget is not available.');
    return channel;
  }

  private visitorToken(channelId: string, visitorId: string): string {
    const key = this.runtime.requireCipher().deriveKey('webchat-visitor-v1');
    return createHmac('sha256', key).update(`${channelId}:${visitorId}`).digest('base64url');
  }

  private assertVisitor(channelId: string, visitorId: string, token: string | undefined): void {
    if (!token || !safeEqual(token, this.visitorToken(channelId, visitorId))) {
      throw apiError(
        401,
        'VISITOR_TOKEN_INVALID',
        'Chat session expired. Reload the page to start again.',
      );
    }
  }

  async config(widgetKey: string): Promise<WebchatConfig> {
    const channel = await this.findChannel(widgetKey);
    const details = readConnectionConfig(channel.config).presentation
      .details as Partial<WebchatSettings>;
    return {
      name: channel.name,
      welcomeMessage: details.welcomeMessage ?? null,
      accentColor: details.accentColor ?? '#1F93FF',
    };
  }

  async session(widgetKey: string, request: WebchatSessionRequest, ip: string) {
    if (!this.sessionLimiter.allow(`${ip}:${widgetKey}`)) {
      throw apiError(429, 'RATE_LIMITED', 'Too many chat sessions. Try again in a minute.');
    }
    const channel = await this.findChannel(widgetKey);
    if (request.visitorId && request.visitorToken) {
      try {
        this.assertVisitor(channel.id, request.visitorId, request.visitorToken);
        return { visitorId: request.visitorId, visitorToken: request.visitorToken };
      } catch {
        // Fall through and issue a fresh identity.
      }
    }
    const visitorId = `v_${randomBytes(12).toString('base64url')}`;
    return { visitorId, visitorToken: this.visitorToken(channel.id, visitorId) };
  }

  async postMessage(
    widgetKey: string,
    request: WebchatMessageRequest,
    token: string | undefined,
    ip: string,
    correlationId: string,
  ): Promise<{ accepted: boolean }> {
    if (!this.messageLimiter.allow(`${ip}:${widgetKey}`)) {
      throw apiError(
        429,
        'RATE_LIMITED',
        'You are sending messages too quickly. Please wait a moment.',
      );
    }
    const channel = await this.findChannel(widgetKey);
    this.assertVisitor(channel.id, request.visitorId, token);

    const event = webchatEventFor({
      visitorId: request.visitorId,
      clientMessageId: request.clientMessageId,
      text: request.text,
      sentAt: new Date().toISOString(),
      ...(request.name ? { visitorName: request.name } : {}),
      ...(request.email ? { visitorEmail: request.email } : {}),
      ...(request.pageUrl ? { pageUrl: request.pageUrl } : {}),
    });
    await journalProviderEvents(prisma, {
      workspaceId: channel.workspaceId,
      providerAccountId: channel.id,
      provider: channel.provider,
      channelType: 'WEBCHAT',
      correlationId,
      events: [event],
    });
    return { accepted: true };
  }

  async messages(
    widgetKey: string,
    visitorId: string,
    token: string | undefined,
    after: string | undefined,
  ): Promise<WebchatMessage[]> {
    const channel = await this.findChannel(widgetKey);
    this.assertVisitor(channel.id, visitorId, token);

    const identity = await prisma.contactIdentity.findUnique({
      where: {
        providerAccountId_externalId: { providerAccountId: channel.id, externalId: visitorId },
      },
    });
    if (!identity) return [];

    const since = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : undefined;
    const rows = await prisma.message.findMany({
      where: {
        conversation: { contactIdentityId: identity.id },
        isPrivate: false,
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    // Fetching a reply means the visitor's widget has it: mark it delivered.
    const delivered = rows.filter((m) => m.direction === 'OUTBOUND' && m.status === 'SENT');
    if (delivered.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.message.updateMany({
          where: { id: { in: delivered.map((m) => m.id) }, status: 'SENT' },
          data: { status: 'DELIVERED', deliveredAt: new Date() },
        });
        for (const message of delivered) {
          await notifyRealtime(tx, {
            eventType: 'conversation.message.updated',
            workspaceId: message.workspaceId,
            conversationId: message.conversationId,
            messageId: message.id,
          });
        }
      });
    }

    return rows.map((m) => ({
      id: m.id,
      direction: m.direction,
      text: m.text ?? '',
      senderName: m.direction === 'OUTBOUND' ? m.senderName : null,
      createdAt: m.createdAt.toISOString(),
    }));
  }
}
