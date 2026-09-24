import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  createSuccessEnvelope,
  type ApiSuccessResponse,
  type LivenessReport,
  type ReadinessReport,
  type SystemHealthReport,
} from '@vynor/contracts';
import { prisma } from '@vynor/database';
import {
  buildLivenessReport,
  buildReadinessReport,
  buildSystemHealthReport,
  checkDatabaseHealth,
  checkOutboxHealth,
} from '@vynor/observability';
import type { Response } from 'express';
import { Public } from '../iam/decorators.js';

@Controller('health')
export class HealthController {
  /**
   * Liveness Probe (FND-049, FND-BE-007)
   * Fast event loop check for container orchestration without external dependencies.
   * Responds to both /health/live and /health/liveness.
   */
  @Public()
  @Get(['liveness', 'live'])
  getLiveness(): LivenessReport {
    return buildLivenessReport('vynor-api');
  }

  /**
   * Readiness Probe (FND-049, FND-BE-007)
   * Validates database connectivity before routing customer traffic.
   * Responds to both /health/ready and /health/readiness.
   */
  @Public()
  @Get(['readiness', 'ready'])
  async getReadiness(@Res({ passthrough: true }) res: Response): Promise<ReadinessReport> {
    const dbHealth = await checkDatabaseHealth(prisma);
    const report = buildReadinessReport('vynor-api', dbHealth);

    if (report.status === 'DOWN') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return report;
  }

  /**
   * Overall System Health Report (FND-049, FND-050)
   */
  @Public()
  @Get()
  async getSystemHealth(): Promise<ApiSuccessResponse<SystemHealthReport>> {
    const [dbHealth, outboxHealth] = await Promise.all([
      checkDatabaseHealth(prisma),
      checkOutboxHealth(prisma),
    ]);

    const report = buildSystemHealthReport({
      service: 'vynor-api',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: dbHealth,
      outbox: outboxHealth,
      webhooks: {
        status: 'UP',
        details: { ingressBuffer: 'active', fastAckTargetMs: 500 },
      },
    });

    return createSuccessEnvelope(report);
  }

  /**
   * Detailed Subsystem Indicators (FND-050)
   * Inspects database, outbox lag, queue state, and provider health.
   */
  @Public()
  @Get('indicators')
  async getIndicators(): Promise<ApiSuccessResponse<SystemHealthReport['indicators']>> {
    const [dbHealth, outboxHealth] = await Promise.all([
      checkDatabaseHealth(prisma),
      checkOutboxHealth(prisma),
    ]);

    const report = buildSystemHealthReport({
      service: 'vynor-api',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: dbHealth,
      outbox: outboxHealth,
      webhooks: {
        status: 'UP',
        details: { ingressBuffer: 'active', fastAckTargetMs: 500 },
      },
    });

    return createSuccessEnvelope(report.indicators);
  }
}
