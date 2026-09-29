import { Injectable, Logger } from '@nestjs/common';
import {
  hasPermission,
  PROVIDER_CHANNEL_TYPES,
  type ActorContext,
  type Channel,
  type ChannelConnectionInput,
  type ChannelTestResult,
  type CreateChannelRequest,
  type ReconnectChannelRequest,
  type UpdateChannelRequest,
  type WorkspaceMember,
} from '@vynor/contracts';
import {
  generateSecretToken,
  isChannelProviderError,
  openChannelSecrets,
  presentCredentials,
  readConnectionConfig,
  sealChannelSecrets,
  type AnyChannelAdapter,
  type ChannelConnectionConfig,
  type GeneratedChannelSecrets,
  type VerifiedAccount,
} from '@vynor/channel-adapters';
import { generateId, notifyRealtime, prisma, Prisma } from '@vynor/database';
import { AuditService } from '../audit/audit.service.js';
import { apiError, notFound } from '../common/errors/api-error.js';
import { presentChannel, readInboxSettings, type ChannelRow } from './channel-presenter.js';
import { ChannelRuntimeService } from './channel-runtime.service.js';
import { assertConnectionEndpointsAllowed } from './endpoint-policy.js';

const CHANNEL_INCLUDE = { members: { select: { membershipId: true } } } as const;
type ChannelRecord = Prisma.ProviderAccountGetPayload<{ include: typeof CHANNEL_INCLUDE }>;

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly runtime: ChannelRuntimeService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async list(actor: ActorContext): Promise<Channel[]> {
    const rows = await prisma.providerAccount.findMany({
      where: { workspaceId: actor.workspace.id, deletedAt: null },
      include: CHANNEL_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.present(row, actor));
  }

  async get(actor: ActorContext, id: string): Promise<Channel> {
    return this.present(await this.findRow(actor, id), actor);
  }

  async listMembers(actor: ActorContext): Promise<WorkspaceMember[]> {
    const memberships = await prisma.workspaceMembership.findMany({
      where: { workspaceId: actor.workspace.id, deletedAt: null, status: 'ACTIVE' },
      include: { userProfile: true, roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships
      .filter((m) => m.userProfile.isActive && !m.userProfile.deletedAt)
      .map((m) => ({
        membershipId: m.id,
        userId: m.userProfile.id,
        displayName: m.userProfile.displayName,
        email: m.userProfile.email,
        avatarUrl: m.userProfile.avatarUrl,
        roles: m.roles.map((r) => r.role.name),
      }));
  }

  // ---------------------------------------------------------------------------
  // Connect / reconnect
  // ---------------------------------------------------------------------------

  async create(
    actor: ActorContext,
    request: CreateChannelRequest,
    correlationId: string,
  ): Promise<Channel> {
    const { connection } = request;
    const adapter = this.runtime.adapterFor(connection.provider);
    const cipher = this.runtime.requireCipher();
    const channelType = PROVIDER_CHANNEL_TYPES[connection.provider];

    await assertConnectionEndpointsAllowed(connection, this.runtime.enforcePublicEndpoints);
    const verified = await this.verify(adapter, connection);

    const accountIdentifier =
      verified.accountIdentifier ?? `${channelType.toLowerCase()}_${generateSecretToken(9)}`;
    const existing = await prisma.providerAccount.findUnique({
      where: {
        workspaceId_channelType_accountIdentifier: {
          workspaceId: actor.workspace.id,
          channelType,
          accountIdentifier,
        },
      },
    });
    if (existing && !existing.deletedAt) {
      throw apiError(
        409,
        'CHANNEL_ALREADY_CONNECTED',
        `${verified.displayIdentifier} is already connected as "${existing.name}".`,
        { channelId: existing.id },
      );
    }

    // A previously deleted channel for the same account is revived so its history reattaches.
    const id = existing?.id ?? generateId();
    const generated = this.generateSecrets(adapter);
    const inboundMode = this.runtime.inboundModeFor(adapter);
    const envelope = sealChannelSecrets(cipher, {
      provider: connection.provider,
      providerAccountId: id,
      secrets: { credentials: connection.credentials, generated },
    });
    const config = this.buildConfig(connection, verified, inboundMode);
    const now = new Date();

    const data = {
      name: request.name,
      description: request.description ?? null,
      provider: connection.provider,
      displayIdentifier: verified.displayIdentifier,
      status: 'ACTIVE' as const,
      credentials: envelope as unknown as Prisma.InputJsonValue,
      config: config as unknown as Prisma.InputJsonValue,
      capabilities: adapter.capabilities as unknown as Prisma.InputJsonValue,
      webhookKey: generateSecretToken(24),
      statusReason: null,
      lastErrorAt: null,
      lastHealthCheckAt: now,
      connectedAt: now,
      syncState: verified.initialCursor
        ? (verified.initialCursor as Prisma.InputJsonValue)
        : Prisma.DbNull,
      deletedAt: null,
    };

    const row = await prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.providerAccount.update({
            where: { id },
            data: {
              ...data,
              settings: readInboxSettings(null) as unknown as Prisma.InputJsonValue,
            },
            include: CHANNEL_INCLUDE,
          })
        : await tx.providerAccount.create({
            data: {
              ...data,
              id,
              workspaceId: actor.workspace.id,
              channelType,
              accountIdentifier,
              settings: readInboxSettings(null) as unknown as Prisma.InputJsonValue,
            },
            include: CHANNEL_INCLUDE,
          });
      await this.audit.recordForActor(
        actor,
        {
          action: 'channel.connected',
          resourceType: 'channel',
          resourceId: saved.id,
          correlationId,
          afterState: {
            provider: connection.provider,
            name: saved.name,
            identifier: verified.displayIdentifier,
          },
        },
        tx,
      );
      return saved;
    });

    const registered = await this.registerInbound(row, adapter, generated);
    return this.present(registered, actor);
  }

  async reconnect(
    actor: ActorContext,
    id: string,
    request: ReconnectChannelRequest,
    correlationId: string,
  ): Promise<Channel> {
    const row = await this.findRow(actor, id);
    const { connection } = request;
    if (connection.provider !== row.provider) {
      throw apiError(
        422,
        'CHANNEL_PROVIDER_MISMATCH',
        'Credentials must be for the same platform as this channel.',
      );
    }
    const adapter = this.runtime.adapterFor(row.provider);
    const cipher = this.runtime.requireCipher();

    await assertConnectionEndpointsAllowed(connection, this.runtime.enforcePublicEndpoints);
    const verified = await this.verify(adapter, connection);
    if (verified.accountIdentifier && verified.accountIdentifier !== row.accountIdentifier) {
      throw apiError(
        409,
        'CHANNEL_ACCOUNT_MISMATCH',
        `These credentials belong to ${verified.displayIdentifier}, not to ${row.displayIdentifier ?? row.accountIdentifier}. Connect it as a new channel instead.`,
      );
    }

    // Keep generated secrets so the provider-side configuration stays valid.
    let generated: GeneratedChannelSecrets = {};
    try {
      generated = openChannelSecrets(cipher, row.credentials, row.id).generated ?? {};
    } catch {
      generated = {};
    }
    generated = { ...this.generateSecrets(adapter), ...generated };

    // Re-evaluated so a newly configured public HTTPS URL moves Telegram from polling to webhook.
    const config = this.buildConfig(connection, verified, this.runtime.inboundModeFor(adapter));
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.providerAccount.update({
        where: { id: row.id },
        data: {
          displayIdentifier: verified.displayIdentifier,
          status: 'ACTIVE',
          statusReason: null,
          lastErrorAt: null,
          lastHealthCheckAt: now,
          connectedAt: row.connectedAt ?? now,
          credentials: sealChannelSecrets(cipher, {
            provider: connection.provider,
            providerAccountId: row.id,
            secrets: { credentials: connection.credentials, generated },
            rotatedAt: now,
          }) as unknown as Prisma.InputJsonValue,
          config: config as unknown as Prisma.InputJsonValue,
          webhookKey: row.webhookKey ?? generateSecretToken(24),
          ...(row.syncState === null && verified.initialCursor
            ? { syncState: verified.initialCursor as Prisma.InputJsonValue }
            : {}),
        },
        include: CHANNEL_INCLUDE,
      });
      await this.audit.recordForActor(
        actor,
        {
          action: 'channel.reconnected',
          resourceType: 'channel',
          resourceId: saved.id,
          correlationId,
          afterState: { provider: saved.provider, identifier: verified.displayIdentifier },
        },
        tx,
      );
      await notifyRealtime(tx, {
        eventType: 'channel.updated',
        workspaceId: saved.workspaceId,
        channelId: saved.id,
      });
      return saved;
    });

    const registered = await this.registerInbound(updated, adapter, generated);
    return this.present(registered, actor);
  }

  // ---------------------------------------------------------------------------
  // Settings, health, delete
  // ---------------------------------------------------------------------------

  async update(
    actor: ActorContext,
    id: string,
    request: UpdateChannelRequest,
    correlationId: string,
  ): Promise<Channel> {
    const row = await this.findRow(actor, id);

    if (request.humanAgentIds) {
      const unique = [...new Set(request.humanAgentIds)];
      const valid = await prisma.workspaceMembership.count({
        where: {
          id: { in: unique },
          workspaceId: actor.workspace.id,
          deletedAt: null,
          status: 'ACTIVE',
        },
      });
      if (valid !== unique.length) {
        throw apiError(
          422,
          'INVALID_HUMAN_AGENTS',
          'One or more selected agents are not active members of this workspace.',
        );
      }
    }

    const settings = request.settings
      ? { ...readInboxSettings(row.settings), ...request.settings }
      : undefined;

    const saved = await prisma.$transaction(async (tx) => {
      if (request.humanAgentIds) {
        await tx.providerAccountMember.deleteMany({ where: { providerAccountId: row.id } });
        if (request.humanAgentIds.length > 0) {
          await tx.providerAccountMember.createMany({
            data: [...new Set(request.humanAgentIds)].map((membershipId) => ({
              providerAccountId: row.id,
              membershipId,
            })),
          });
        }
      }
      const updated = await tx.providerAccount.update({
        where: { id: row.id },
        data: {
          ...(request.name !== undefined ? { name: request.name } : {}),
          ...(request.description !== undefined ? { description: request.description } : {}),
          ...(settings
            ? { settings: readInboxSettings(settings) as unknown as Prisma.InputJsonValue }
            : {}),
        },
        include: CHANNEL_INCLUDE,
      });
      await this.audit.recordForActor(
        actor,
        {
          action: 'channel.updated',
          resourceType: 'channel',
          resourceId: row.id,
          correlationId,
          beforeState: {
            name: row.name,
            settings: readInboxSettings(row.settings),
            humanAgentIds: row.members.map((m) => m.membershipId),
          },
          afterState: {
            name: updated.name,
            settings: readInboxSettings(updated.settings),
            humanAgentIds: updated.members.map((m) => m.membershipId),
          },
        },
        tx,
      );
      await notifyRealtime(tx, {
        eventType: 'channel.updated',
        workspaceId: row.workspaceId,
        channelId: row.id,
      });
      return updated;
    });
    return this.present(saved, actor);
  }

  async test(actor: ActorContext, id: string): Promise<ChannelTestResult> {
    const row = await this.findRow(actor, id);
    const adapter = this.runtime.adapterFor(row.provider);
    const checkedAt = new Date();

    let ok = false;
    let message: string;
    let latencyMs: number | undefined;
    let status: 'ACTIVE' | 'ERROR' | 'DISCONNECTED';
    try {
      const account = this.runtime.account(row);
      const health = await adapter.healthCheck(account);
      ok = health.isHealthy;
      message = health.message;
      latencyMs = health.latencyMs;
      status = health.isHealthy ? 'ACTIVE' : 'ERROR';
    } catch (error) {
      if (isChannelProviderError(error)) {
        status = error.requiresReconnect ? 'DISCONNECTED' : 'ERROR';
        message = error.message;
      } else if (error instanceof Error && error.name === 'CredentialCipherError') {
        status = 'DISCONNECTED';
        message = 'Stored credentials could not be read. Reconnect the channel.';
      } else {
        throw error;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.providerAccount.update({
        where: { id: row.id },
        data: {
          status,
          lastHealthCheckAt: checkedAt,
          statusReason: ok ? null : message,
          ...(ok ? {} : { lastErrorAt: checkedAt }),
        },
      });
      await notifyRealtime(tx, {
        eventType: 'channel.updated',
        workspaceId: row.workspaceId,
        channelId: row.id,
      });
    });

    return {
      ok,
      status,
      message,
      checkedAt: checkedAt.toISOString(),
      ...(latencyMs !== undefined ? { latencyMs } : {}),
    };
  }

  async remove(actor: ActorContext, id: string, correlationId: string): Promise<void> {
    const row = await this.findRow(actor, id);
    const adapter = this.runtime.adapterFor(row.provider);

    if (adapter.unregisterWebhook) {
      try {
        await adapter.unregisterWebhook(this.runtime.account(row));
      } catch (error) {
        // The channel is removed either way; the provider may still hold an old URL.
        this.logger.warn(
          `Could not unregister webhook for channel ${row.id}: ${(error as Error).message}`,
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.providerAccount.update({
        where: { id: row.id },
        data: {
          deletedAt: new Date(),
          status: 'INACTIVE',
          webhookKey: null,
          syncLeaseExpiresAt: null,
        },
      });
      await this.audit.recordForActor(
        actor,
        {
          action: 'channel.deleted',
          resourceType: 'channel',
          resourceId: row.id,
          correlationId,
          beforeState: {
            provider: row.provider,
            name: row.name,
            identifier: row.displayIdentifier,
          },
        },
        tx,
      );
      await notifyRealtime(tx, {
        eventType: 'channel.updated',
        workspaceId: row.workspaceId,
        channelId: row.id,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async findRow(actor: ActorContext, id: string): Promise<ChannelRecord> {
    const row = await prisma.providerAccount.findFirst({
      where: { id, workspaceId: actor.workspace.id, deletedAt: null },
      include: CHANNEL_INCLUDE,
    });
    if (!row) throw notFound('This channel does not exist or was deleted.', 'CHANNEL_NOT_FOUND');
    return row;
  }

  private present(row: ChannelRow, actor: ActorContext): Channel {
    let secrets: GeneratedChannelSecrets | null = null;
    if (
      hasPermission(actor.permissions, 'integration:manage') &&
      this.runtime.encryptionConfigured
    ) {
      try {
        secrets =
          openChannelSecrets(this.runtime.requireCipher(), row.credentials, row.id).generated ?? {};
      } catch {
        secrets = null;
      }
    }
    return presentChannel(row, this.runtime, secrets);
  }

  private async verify(
    adapter: AnyChannelAdapter,
    connection: ChannelConnectionInput,
  ): Promise<VerifiedAccount> {
    try {
      return await adapter.verifyCredentials(connection.credentials);
    } catch (error) {
      if (isChannelProviderError(error)) {
        const unreachable = error.category === 'TRANSIENT';
        throw apiError(
          unreachable ? 502 : 422,
          unreachable ? 'CHANNEL_PROVIDER_UNREACHABLE' : 'CHANNEL_VERIFICATION_FAILED',
          error.message,
          { category: error.category, providerCode: error.code },
        );
      }
      throw error;
    }
  }

  private generateSecrets(adapter: AnyChannelAdapter): GeneratedChannelSecrets {
    const secrets: GeneratedChannelSecrets = {};
    for (const key of adapter.generatedSecrets) secrets[key] = generateSecretToken(24);
    return secrets;
  }

  private buildConfig(
    connection: ChannelConnectionInput,
    verified: VerifiedAccount,
    inboundMode: ChannelConnectionConfig['inboundMode'],
  ): ChannelConnectionConfig {
    return {
      inboundMode,
      webhookRegistered: false,
      setupNote: null,
      displayName: verified.displayName ?? null,
      providerMetadata: verified.metadata ?? {},
      presentation: presentCredentials(
        connection.provider,
        connection.credentials as Record<string, unknown>,
      ),
    };
  }

  /**
   * Points the provider at the channel (or switches Telegram to polling). Failures do not undo
   * the connection; they become a setup note the admin can act on.
   */
  private async registerInbound(
    row: ChannelRecord,
    adapter: AnyChannelAdapter,
    generated: GeneratedChannelSecrets,
  ): Promise<ChannelRecord> {
    const config = readConnectionConfig(row.config);
    let webhookRegistered = false;
    let setupNote: string | null = null;

    if (
      adapter.registerWebhook &&
      (config.inboundMode === 'WEBHOOK' || adapter.inbound === 'WEBHOOK_OR_POLLING')
    ) {
      const url = this.runtime.webhookUrl(adapter, row.webhookKey) ?? '';
      try {
        const result = await adapter.registerWebhook(this.runtime.account(row), {
          url,
          secrets: generated,
        });
        webhookRegistered = result.registered;
        setupNote = result.note ?? null;
      } catch (error) {
        setupNote = `VYNOR could not register the webhook automatically: ${(error as Error).message}`;
      }
    } else if (config.inboundMode === 'WEBHOOK' && adapter.webhookPath) {
      setupNote = 'Send signed requests to the webhook URL below.';
    }

    const saved = await prisma.$transaction(async (tx) => {
      const updated = await tx.providerAccount.update({
        where: { id: row.id },
        data: {
          config: { ...config, webhookRegistered, setupNote } as unknown as Prisma.InputJsonValue,
        },
        include: CHANNEL_INCLUDE,
      });
      await notifyRealtime(tx, {
        eventType: 'channel.updated',
        workspaceId: row.workspaceId,
        channelId: row.id,
      });
      return updated;
    });
    return saved;
  }
}
