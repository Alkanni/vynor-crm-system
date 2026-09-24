import { Injectable } from '@nestjs/common';
import type { ActorContext, AuditEventInput, AuditEventRecord } from '@vynor/contracts';
import { generateUuidV7, prisma, type AnyPrismaClient, type Prisma } from '@vynor/database';

@Injectable()
export class AuditService {
  /**
   * Record an immutable audit log entry scoped to an authenticated ActorContext (FND-BE-006, FND-048).
   */
  async recordForActor(
    actor: ActorContext,
    input: Omit<AuditEventInput, 'workspaceId' | 'actorId' | 'actorType'> & {
      actorType?: AuditEventInput['actorType'];
    },
    client: AnyPrismaClient = prisma,
  ): Promise<AuditEventRecord> {
    return this.record(
      {
        ...input,
        workspaceId: actor.workspace.id,
        actorId: actor.user.id,
        actorType: input.actorType ?? 'USER',
      },
      client,
    );
  }

  /**
   * Record an immutable audit log entry (FND-048).
   * Can execute within an existing database transaction or on the default client.
   */
  async record(
    event: AuditEventInput,
    client: AnyPrismaClient = prisma,
  ): Promise<AuditEventRecord> {
    const id = generateUuidV7();

    const record = await client.auditLog.create({
      data: {
        id,
        workspaceId: event.workspaceId,
        actorId: event.actorId,
        actorType: event.actorType,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        correlationId: event.correlationId,
        ...(event.causationId ? { causationId: event.causationId } : {}),
        ...(event.ipAddress ? { ipAddress: event.ipAddress } : {}),
        ...(event.userAgent ? { userAgent: event.userAgent } : {}),
        ...(event.beforeState ? { beforeState: event.beforeState as Prisma.InputJsonValue } : {}),
        ...(event.afterState ? { afterState: event.afterState as Prisma.InputJsonValue } : {}),
        ...(event.metadata ? { metadata: event.metadata as Prisma.InputJsonValue } : {}),
      },
    });

    const result: AuditEventRecord = {
      id: record.id,
      workspaceId: record.workspaceId,
      actorId: record.actorId,
      actorType: record.actorType as AuditEventRecord['actorType'],
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      correlationId: record.correlationId,
      createdAt: record.createdAt.toISOString(),
    };

    if (record.causationId) {
      result.causationId = record.causationId;
    }
    if (record.ipAddress) {
      result.ipAddress = record.ipAddress;
    }
    if (record.userAgent) {
      result.userAgent = record.userAgent;
    }
    if (record.beforeState) {
      result.beforeState = record.beforeState as Record<string, unknown>;
    }
    if (record.afterState) {
      result.afterState = record.afterState as Record<string, unknown>;
    }
    if (record.metadata) {
      result.metadata = record.metadata as Record<string, unknown>;
    }

    return result;
  }
}
