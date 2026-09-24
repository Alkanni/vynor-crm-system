import { z } from 'zod';

export const HealthStatusSchema = z.enum(['UP', 'DOWN', 'DEGRADED']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

/**
 * Health indicator for a single subsystem dependency.
 */
export const SubsystemHealthSchema = z.object({
  status: HealthStatusSchema,
  latencyMs: z.number().nonnegative().optional(),
  error: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type SubsystemHealth = z.infer<typeof SubsystemHealthSchema>;

/**
 * Liveness Probe Response (FND-049)
 * Used by orchestrators (Docker, Kubernetes) to verify event loop responsiveness.
 */
export const LivenessReportSchema = z.object({
  status: HealthStatusSchema,
  service: z.string().min(1),
  uptimeSeconds: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
});

export type LivenessReport = z.infer<typeof LivenessReportSchema>;

/**
 * Readiness Probe Response (FND-049)
 * Used by load balancers / reverse proxies to determine if traffic should be routed.
 */
export const ReadinessReportSchema = z.object({
  status: HealthStatusSchema,
  service: z.string().min(1),
  timestamp: z.string().datetime(),
  checks: z.object({
    database: SubsystemHealthSchema,
  }),
});

export type ReadinessReport = z.infer<typeof ReadinessReportSchema>;

/**
 * Detailed System Health Indicators Report (FND-050)
 * Aggregates database, outbox, queue, webhook, and provider status.
 */
export const SystemHealthReportSchema = z.object({
  status: HealthStatusSchema,
  service: z.string().min(1),
  environment: z.string().min(1),
  version: z.string().min(1),
  uptimeSeconds: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  indicators: z.object({
    database: SubsystemHealthSchema,
    outbox: SubsystemHealthSchema.optional(),
    queue: SubsystemHealthSchema.optional(),
    webhooks: SubsystemHealthSchema.optional(),
    storage: SubsystemHealthSchema.optional(),
    providers: z.record(z.string(), SubsystemHealthSchema).optional(),
  }),
});

export type SystemHealthReport = z.infer<typeof SystemHealthReportSchema>;
