import type {
  HealthStatus,
  LivenessReport,
  ReadinessReport,
  SubsystemHealth,
  SystemHealthReport,
} from '@vynor/contracts';

/**
 * Check database connectivity and query latency (FND-049).
 */
export async function checkDatabaseHealth(db: {
  $queryRaw: (query: TemplateStringsArray) => Promise<unknown>;
}): Promise<SubsystemHealth> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    return {
      status: latencyMs > 1000 ? 'DEGRADED' : 'UP',
      latencyMs,
    };
  } catch (err) {
    return {
      status: 'DOWN',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Database query failed',
    };
  }
}

/**
 * Check Outbox table backlog and dead-letter count (FND-050, AD-006).
 */
export async function checkOutboxHealth(db: {
  outboxEvent: {
    count: (args?: { where?: Record<string, unknown> }) => Promise<number>;
  };
}): Promise<SubsystemHealth> {
  const start = Date.now();
  try {
    const oneMinuteAgo = new Date(Date.now() - 60_000);

    const [pendingLagCount, deadLetterCount] = await Promise.all([
      db.outboxEvent.count({
        where: {
          status: 'PENDING',
          scheduledAt: { lt: oneMinuteAgo },
        },
      }),
      db.outboxEvent.count({
        where: { status: 'DEAD_LETTER' },
      }),
    ]);

    const latencyMs = Date.now() - start;
    let status: HealthStatus = 'UP';

    if (deadLetterCount > 0 || pendingLagCount > 100) {
      status = 'DEGRADED';
    }

    return {
      status,
      latencyMs,
      details: {
        pendingLagCount,
        deadLetterCount,
      },
    };
  } catch (err) {
    return {
      status: 'DEGRADED',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Failed to query outbox metrics',
    };
  }
}

/**
 * Construct liveness probe report (FND-049).
 */
export function buildLivenessReport(service: string): LivenessReport {
  return {
    status: 'UP',
    service,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Construct readiness probe report (FND-049).
 */
export function buildReadinessReport(service: string, dbHealth: SubsystemHealth): ReadinessReport {
  return {
    status: dbHealth.status === 'UP' ? 'UP' : 'DOWN',
    service,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealth,
    },
  };
}

/**
 * Construct comprehensive system health indicator report (FND-050).
 */
export function buildSystemHealthReport(params: {
  service: string;
  environment?: string;
  version?: string;
  database: SubsystemHealth;
  outbox?: SubsystemHealth;
  queue?: SubsystemHealth;
  webhooks?: SubsystemHealth;
  storage?: SubsystemHealth;
  providers?: Record<string, SubsystemHealth>;
}): SystemHealthReport {
  const allSubsystems = [
    params.database,
    params.outbox,
    params.queue,
    params.webhooks,
    params.storage,
    ...(params.providers ? Object.values(params.providers) : []),
  ].filter((s): s is SubsystemHealth => s !== undefined);

  let overallStatus: HealthStatus = 'UP';

  if (allSubsystems.some((s) => s.status === 'DOWN')) {
    overallStatus = 'DOWN';
  } else if (allSubsystems.some((s) => s.status === 'DEGRADED')) {
    overallStatus = 'DEGRADED';
  }

  const indicators: SystemHealthReport['indicators'] = {
    database: params.database,
  };

  if (params.outbox) {
    indicators.outbox = params.outbox;
  }
  if (params.queue) {
    indicators.queue = params.queue;
  }
  if (params.webhooks) {
    indicators.webhooks = params.webhooks;
  }
  if (params.storage) {
    indicators.storage = params.storage;
  }
  if (params.providers) {
    indicators.providers = params.providers;
  }

  return {
    status: overallStatus,
    service: params.service,
    environment: params.environment || process.env.NODE_ENV || 'development',
    version: params.version || '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    indicators,
  };
}
