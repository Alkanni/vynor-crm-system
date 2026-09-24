import { z } from 'zod';

/**
 * Canonical named queues for VYNOR background processing (FND-051, AD-001, AD-002).
 * Formatted as lowercase dot-separated namespace: vynor.<domain>.<action>
 */
export const QUEUE_NAMES = {
  MESSAGES_OUTBOUND: 'vynor.messages.outbound',
  WEBHOOKS_PROCESS: 'vynor.webhooks.process',
  CAMPAIGNS_DISPATCH: 'vynor.campaigns.dispatch',
  CONVERSATIONS_ROUTE: 'vynor.conversations.route',
  AI_GENERATE: 'vynor.ai.generate',
  AUDIT_EXPORT: 'vynor.audit.export',
  MAINTENANCE_OUTBOX_PRUNE: 'vynor.maintenance.outbox-prune',
  MAINTENANCE_LEASE_RECOVER: 'vynor.maintenance.lease-recover',
} as const;

export const QueueNameSchema = z.enum([
  'vynor.messages.outbound',
  'vynor.webhooks.process',
  'vynor.campaigns.dispatch',
  'vynor.conversations.route',
  'vynor.ai.generate',
  'vynor.audit.export',
  'vynor.maintenance.outbox-prune',
  'vynor.maintenance.lease-recover',
]);

export type QueueName = z.infer<typeof QueueNameSchema>;

export interface QueueOptions {
  name: QueueName;
  concurrency: number;
  retentionDays: number;
  teamSize?: number;
  retryLimit: number;
  retryDelaySeconds: number;
}

/**
 * Standard configuration profiles per queue type.
 */
export const QUEUE_CONFIGS: Record<QueueName, QueueOptions> = {
  [QUEUE_NAMES.MESSAGES_OUTBOUND]: {
    name: QUEUE_NAMES.MESSAGES_OUTBOUND,
    concurrency: 10,
    retentionDays: 14,
    retryLimit: 5,
    retryDelaySeconds: 5,
  },
  [QUEUE_NAMES.WEBHOOKS_PROCESS]: {
    name: QUEUE_NAMES.WEBHOOKS_PROCESS,
    concurrency: 20,
    retentionDays: 7,
    retryLimit: 5,
    retryDelaySeconds: 2,
  },
  [QUEUE_NAMES.CAMPAIGNS_DISPATCH]: {
    name: QUEUE_NAMES.CAMPAIGNS_DISPATCH,
    concurrency: 5,
    retentionDays: 30,
    retryLimit: 3,
    retryDelaySeconds: 15,
  },
  [QUEUE_NAMES.CONVERSATIONS_ROUTE]: {
    name: QUEUE_NAMES.CONVERSATIONS_ROUTE,
    concurrency: 10,
    retentionDays: 7,
    retryLimit: 3,
    retryDelaySeconds: 3,
  },
  [QUEUE_NAMES.AI_GENERATE]: {
    name: QUEUE_NAMES.AI_GENERATE,
    concurrency: 5,
    retentionDays: 14,
    retryLimit: 3,
    retryDelaySeconds: 5,
  },
  [QUEUE_NAMES.AUDIT_EXPORT]: {
    name: QUEUE_NAMES.AUDIT_EXPORT,
    concurrency: 2,
    retentionDays: 3,
    retryLimit: 3,
    retryDelaySeconds: 30,
  },
  [QUEUE_NAMES.MAINTENANCE_OUTBOX_PRUNE]: {
    name: QUEUE_NAMES.MAINTENANCE_OUTBOX_PRUNE,
    concurrency: 1,
    retentionDays: 1,
    retryLimit: 2,
    retryDelaySeconds: 60,
  },
  [QUEUE_NAMES.MAINTENANCE_LEASE_RECOVER]: {
    name: QUEUE_NAMES.MAINTENANCE_LEASE_RECOVER,
    concurrency: 1,
    retentionDays: 1,
    retryLimit: 2,
    retryDelaySeconds: 10,
  },
};
