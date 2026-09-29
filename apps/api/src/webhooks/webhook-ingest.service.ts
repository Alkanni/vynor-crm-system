import { Injectable, Logger } from '@nestjs/common';
import type { ChannelType } from '@vynor/contracts';
import type {
  AnyChannelAdapter,
  ExtractedProviderEvent,
  WebhookRequest,
} from '@vynor/channel-adapters';
import { journalProviderEvents, prisma } from '@vynor/database';
import { ChannelRuntimeService } from '../channels/channel-runtime.service.js';

export interface WebhookResponse {
  status: number;
  /** JSON body, or a plain string for verification challenges. */
  body: Record<string, unknown> | string;
}

/** Only harmless headers are journaled; signatures and secrets are never stored. */
const JOURNALED_HEADERS = ['content-type', 'user-agent'];

/**
 * Inbound webhook ingress (FND-041, AD-004, AD-005): verify, journal, acknowledge. All
 * processing happens later in the worker, so responses stay well under provider timeouts.
 */
@Injectable()
export class WebhookIngestService {
  private readonly logger = new Logger(WebhookIngestService.name);

  constructor(private readonly runtime: ChannelRuntimeService) {}

  async handle(
    providerPath: string,
    webhookKey: string,
    request: WebhookRequest,
    correlationId: string,
  ): Promise<WebhookResponse> {
    const adapter = this.runtime.registry.getByWebhookPath(providerPath);
    // Same answer for unknown providers and keys, so valid keys cannot be probed.
    const unknown: WebhookResponse = {
      status: 404,
      body: { received: false, message: 'Unknown webhook.' },
    };
    if (!adapter?.validateWebhook) return unknown;

    const channel = await prisma.providerAccount.findFirst({
      where: { webhookKey, provider: adapter.provider, deletedAt: null },
    });
    if (!channel) return unknown;

    let account;
    try {
      account = this.runtime.account(channel);
    } catch (error) {
      this.logger.error(
        `Cannot decrypt credentials for channel ${channel.id}: ${(error as Error).message}`,
      );
      // 503 makes the provider retry once the key configuration is fixed.
      return {
        status: 503,
        body: { received: false, message: 'Channel temporarily unavailable.' },
      };
    }

    const validation = adapter.validateWebhook(request, account);
    if (!validation.isValid) {
      return {
        status: validation.statusCode ?? 401,
        body: { received: false, message: validation.failureReason ?? 'Invalid webhook request.' },
      };
    }
    if (request.method === 'GET') {
      return validation.challengeResponse !== undefined
        ? { status: 200, body: validation.challengeResponse }
        : { status: 200, body: { ok: true } };
    }

    let payload: unknown;
    try {
      payload = request.rawBody.length ? JSON.parse(request.rawBody.toString('utf8')) : {};
    } catch {
      return { status: 400, body: { received: false, message: 'Malformed request payload.' } };
    }

    const events = adapter.extractEvents?.(payload) ?? [];
    const headers = Object.fromEntries(
      JOURNALED_HEADERS.flatMap((name) => {
        const value = request.headers[name];
        return typeof value === 'string' ? [[name, value]] : [];
      }),
    );

    let accepted = 0;
    let duplicates = 0;
    for (const [targetId, group] of await this.route(adapter, channel, events)) {
      const target =
        targetId === channel.id
          ? channel
          : await prisma.providerAccount.findUnique({ where: { id: targetId } });
      if (!target) continue;
      const result = await journalProviderEvents(prisma, {
        workspaceId: target.workspaceId,
        providerAccountId: target.id,
        provider: target.provider,
        channelType: target.channelType as ChannelType,
        correlationId,
        events: group.map((event) => ({
          providerEventKey: event.providerEventKey,
          isFingerprinted: event.isFingerprinted,
          payload: event.payload,
          headers,
        })),
      });
      accepted += result.acceptedEventIds.length;
      duplicates += result.duplicateCount;
    }

    return { status: 200, body: { received: true, accepted, duplicates } };
  }

  /**
   * One Meta app or LINE callback URL can carry events for several accounts. Events are filed
   * under the channel whose account they belong to (same workspace and provider); events for
   * accounts that are not connected here are dropped.
   */
  private async route(
    adapter: AnyChannelAdapter,
    channel: { id: string; workspaceId: string; accountIdentifier: string },
    events: ExtractedProviderEvent[],
  ): Promise<Map<string, ExtractedProviderEvent[]>> {
    const groups = new Map<string, ExtractedProviderEvent[]>();
    const siblings = new Map<string, string | null>();

    for (const event of events) {
      const routing = event.routingAccountIdentifier;
      let targetId: string | null = channel.id;
      if (routing && routing !== channel.accountIdentifier) {
        if (!siblings.has(routing)) {
          const sibling = await prisma.providerAccount.findFirst({
            where: {
              workspaceId: channel.workspaceId,
              provider: adapter.provider,
              accountIdentifier: routing,
              deletedAt: null,
            },
            select: { id: true },
          });
          siblings.set(routing, sibling?.id ?? null);
          if (!sibling) {
            this.logger.warn(
              `Dropping ${adapter.provider} event for unconnected account ${routing}`,
            );
          }
        }
        targetId = siblings.get(routing) ?? null;
      }
      if (!targetId) continue;
      const group = groups.get(targetId) ?? [];
      group.push(event);
      groups.set(targetId, group);
    }
    return groups;
  }
}
