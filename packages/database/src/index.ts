// Re-export Prisma Client, types, and generated enums
export {
  Prisma,
  PrismaClient,
  SystemRoleName,
  MembershipStatus,
  OutboxEventStatus,
  ChannelType,
  ProviderAccountStatus,
  ProviderEventStatus,
  MessageDeliveryStatus,
} from '@prisma/client';

export type {
  Workspace,
  UserProfile,
  WorkspaceMembership,
  Role,
  Permission,
  RolePermission,
  MembershipRole,
  Team,
  TeamMember,
  OutboxEvent,
  AuditLog,
  ProviderAccount,
  ProviderEvent,
} from '@prisma/client';

// Client instantiation and singleton
export {
  createDatabaseClient,
  prisma,
  type DatabaseClient,
  type TransactionClient,
  type AnyPrismaClient,
  type DatabaseClientOptions,
} from './client.js';

// ID generation and validation conventions (CUID2 / UUIDv7)
export { generateId, generateUuidV7, isValidCuid2, isValidUuid } from './id.js';

// Interactive transaction helpers with concurrency retry
export {
  withTransaction,
  isRetryableTransactionError,
  calculateBackoffDelay,
  RETRYABLE_SQLSTATE_CODES,
  PRISMA_DEADLOCK_ERROR_CODE,
  type TransactionOptions,
  type RetryPolicy,
} from './transaction.js';

// Test isolation and cleanup utilities
export {
  cleanDatabase,
  createTestPrismaClient,
  CRM_TABLE_CLEANUP_ORDER,
  type CleanDatabaseOptions,
} from './test-utils.js';

// Transactional Outbox pattern helpers (FND-056, FND-057, FND-058)
export {
  createOutboxEvent,
  withTransactionalOutbox,
  claimPendingOutboxEvents,
  recoverExpiredOutboxLeases,
  type CreateOutboxEventParams,
  type TransactionalOutboxResult,
} from './outbox.js';

// Provider Event journal and deduplication helpers (FND-067, FND-068, FND-069, FND-070)
export {
  persistProviderEvent,
  transitionProviderEventStatus,
  replayProviderEvent,
  type PersistProviderEventParams,
  type PersistProviderEventResult,
} from './provider-events.js';
