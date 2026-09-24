import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface VerificationCheck {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

export interface SchemaVerificationReport {
  timestamp: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  allPassed: boolean;
  checks: VerificationCheck[];
}

/**
 * Programmatically verifies the VYNOR CRM database schema and migrations
 * against Phase 0 Section 6.1 requirements (FND-DB-001 through FND-DB-007).
 */
export function verifyDatabaseSchema(): SchemaVerificationReport {
  const checks: VerificationCheck[] = [];
  const schemaPath = join(__dirname, '../prisma/schema.prisma');
  const schemaContent = readFileSync(schemaPath, 'utf-8');

  // Load Prisma DMMF
  const models = Prisma.dmmf.datamodel.models;
  const modelMap = new Map(models.map((m) => [m.name, m]));

  // 1. FND-DB-001: Core models existence
  const expectedCoreModels = [
    'Workspace',
    'UserProfile',
    'WorkspaceMembership',
    'Team',
    'TeamMember',
    'Role',
    'Permission',
    'RolePermission',
    'MembershipRole',
  ];

  for (const modelName of expectedCoreModels) {
    const exists = modelMap.has(modelName);
    checks.push({
      category: 'FND-DB-001: Core IAM Models',
      name: `Model ${modelName} exists`,
      passed: exists,
      details: exists
        ? `Found ${modelName} with ${modelMap.get(modelName)?.fields.length} fields`
        : `Model ${modelName} missing in schema`,
    });
  }

  // 2. FND-DB-002: AuditLog append-only policy
  const auditModel = modelMap.get('AuditLog');
  const hasAuditModel = !!auditModel;
  const hasUpdatedAt = auditModel?.fields.some((f) => f.name === 'updatedAt');
  const hasDeletedAt = auditModel?.fields.some((f) => f.name === 'deletedAt');
  checks.push({
    category: 'FND-DB-002: Append-Only AuditLog',
    name: 'AuditLog model exists and is strictly append-only',
    passed: hasAuditModel && !hasUpdatedAt && !hasDeletedAt,
    details:
      hasAuditModel && !hasUpdatedAt && !hasDeletedAt
        ? 'AuditLog exists with immutable schema (no updatedAt, no deletedAt)'
        : 'AuditLog is missing or violates append-only invariant',
  });

  // 3. FND-DB-003: OutboxEvent claiming fields and indexes
  const outboxModel = modelMap.get('OutboxEvent');
  const outboxFields = new Set(outboxModel?.fields.map((f) => f.name) ?? []);
  const hasClaimFields =
    outboxFields.has('claimedAt') &&
    outboxFields.has('claimLeaseExpiresAt') &&
    outboxFields.has('claimedBy') &&
    outboxFields.has('dispatchedAt');

  const hasLeaseIndex = schemaContent.includes('idx_outbox_events_status_lease');
  const hasScheduledIndex = schemaContent.includes('idx_outbox_events_status_scheduled_at');

  checks.push({
    category: 'FND-DB-003: Outbox Claiming & Leases',
    name: 'OutboxEvent has lease fields and operational claiming indexes',
    passed: hasClaimFields && hasLeaseIndex && hasScheduledIndex,
    details: `Claim fields: ${hasClaimFields}, status/lease index: ${hasLeaseIndex}, status/scheduled index: ${hasScheduledIndex}`,
  });

  // 4. FND-DB-004: Channel accounts and ProviderEvent journal with unique constraints
  const hasProviderAccount = modelMap.has('ProviderAccount');
  const hasProviderEvent = modelMap.has('ProviderEvent');
  const hasAccountUnique = schemaContent.includes(
    'uq_provider_accounts_workspace_channel_identifier',
  );
  const hasEventUnique = schemaContent.includes('uq_provider_events_account_event_key');

  checks.push({
    category: 'FND-DB-004: Provider Journal & Deduplication',
    name: 'Provider accounts and events have deduplication unique constraints',
    passed: hasProviderAccount && hasProviderEvent && hasAccountUnique && hasEventUnique,
    details: `ProviderAccount: ${hasProviderAccount}, ProviderEvent: ${hasProviderEvent}, Account uq: ${hasAccountUnique}, Event uq: ${hasEventUnique}`,
  });

  // 5. FND-DB-005: Attachment metadata table without binary columns
  const attachmentModel = modelMap.get('Attachment');
  const hasAttachment = !!attachmentModel;
  const hasBytesField = attachmentModel?.fields.some((f) => f.type === 'Bytes');
  const hasBucketObjectUnique = schemaContent.includes('uq_attachments_bucket_object_key');

  checks.push({
    category: 'FND-DB-005: Attachment Metadata (AD-010)',
    name: 'Attachment table stores metadata without binary columns and enforces objectKey uniqueness',
    passed: hasAttachment && !hasBytesField && hasBucketObjectUnique,
    details:
      hasAttachment && !hasBytesField
        ? 'Attachment table stores metadata only (zero Bytes columns; objectKey unique)'
        : 'Attachment model missing or contains binary Bytes column',
  });

  // 6. FND-DB-006: pgvector and uuid-ossp extension enablement
  const hasVectorExtension = schemaContent.includes('pgvector(map: "vector")');
  const hasUuidExtension = schemaContent.includes('uuidOssp(map: "uuid-ossp")');
  const initMigrationPath = join(
    __dirname,
    '../prisma/migrations/20260924130000_init/migration.sql',
  );
  const initSql = readFileSync(initMigrationPath, 'utf-8');
  const hasSqlVector = initSql.includes('CREATE EXTENSION IF NOT EXISTS "vector"');
  const hasSqlUuid = initSql.includes('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  checks.push({
    category: 'FND-DB-006: PostgreSQL Extensions',
    name: 'pgvector and uuid-ossp enabled in Prisma schema and initial migration',
    passed: hasVectorExtension && hasUuidExtension && hasSqlVector && hasSqlUuid,
    details: `Prisma: vector=${hasVectorExtension}, uuid=${hasUuidExtension} | SQL: vector=${hasSqlVector}, uuid=${hasSqlUuid}`,
  });

  // 7. FND-DB-007: Workspace-scoped foreign keys and indexes
  const workspaceScopedModels = [
    { name: 'WorkspaceMembership', cascade: 'Cascade' },
    { name: 'Team', cascade: 'Cascade' },
    { name: 'Role', cascade: 'Cascade' },
    { name: 'OutboxEvent', cascade: 'Cascade' },
    { name: 'AuditLog', cascade: 'Cascade' },
    { name: 'ProviderAccount', cascade: 'Cascade' },
    { name: 'ProviderEvent', cascade: 'Cascade' },
    { name: 'Attachment', cascade: 'Cascade' },
  ];

  for (const item of workspaceScopedModels) {
    const model = modelMap.get(item.name);
    const hasWorkspaceId = model?.fields.some((f) => f.name === 'workspaceId');
    const workspaceRel = model?.fields.find((f) => f.name === 'workspace');
    const hasCascade = workspaceRel?.relationOnDelete === item.cascade;

    checks.push({
      category: 'FND-DB-007: Workspace Isolation & FKs',
      name: `${item.name} has workspaceId with ${item.cascade} foreign key`,
      passed: !!hasWorkspaceId && hasCascade,
      details: `${item.name}: workspaceId=${hasWorkspaceId}, onDelete=${workspaceRel?.relationOnDelete}`,
    });
  }

  // High-frequency indexes check
  const expectedIndexes = [
    'idx_outbox_events_status_scheduled_at',
    'idx_outbox_events_status_lease',
    'idx_outbox_events_workspace_event_type',
    'idx_outbox_events_correlation_id',
    'idx_audit_logs_workspace_created_at',
    'idx_audit_logs_workspace_action',
    'idx_audit_logs_correlation_id',
    'idx_audit_logs_resource',
    'idx_provider_accounts_workspace_id',
    'idx_provider_accounts_channel_status',
    'idx_provider_events_workspace_status',
    'idx_provider_events_status_created_at',
    'idx_provider_events_correlation_id',
    'idx_provider_events_purge_after',
    'idx_attachments_workspace_purpose_created_at',
    'idx_attachments_workspace_scan_status',
    'idx_attachments_provider_account_id',
    'idx_attachments_purge_after',
  ];

  for (const indexName of expectedIndexes) {
    const hasIndex = schemaContent.includes(indexName);
    checks.push({
      category: 'FND-DB-007: High-Frequency Indexes',
      name: `Index ${indexName} configured`,
      passed: hasIndex,
      details: hasIndex ? 'Present in schema.prisma' : 'Missing in schema.prisma',
    });
  }

  const passedChecks = checks.filter((c) => c.passed).length;
  const failedChecks = checks.length - passedChecks;

  return {
    timestamp: new Date().toISOString(),
    totalChecks: checks.length,
    passedChecks,
    failedChecks,
    allPassed: failedChecks === 0,
    checks,
  };
}

// Standalone execution entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = verifyDatabaseSchema();

  console.info(`\n======================================================`);
  console.info(`  VYNOR CRM Database Schema Verification (Section 6.1)`);
  console.info(`======================================================`);
  console.info(`Timestamp:    ${report.timestamp}`);
  console.info(`Total Checks: ${report.totalChecks}`);
  console.info(`Passed:       ${report.passedChecks}`);
  console.info(`Failed:       ${report.failedChecks}`);
  console.info(`Status:       ${report.allPassed ? 'ALL PASSED [OK]' : 'FAILED'}\n`);

  for (const check of report.checks) {
    const symbol = check.passed ? '✓' : '✗';
    console.info(`  ${symbol} [${check.category}] ${check.name}`);
    if (check.details && !check.passed) {
      console.info(`      Details: ${check.details}`);
    }
  }

  console.info(`\n======================================================\n`);

  if (!report.allPassed) {
    process.exit(1);
  }
}
