import { Controller, Get } from '@nestjs/common';
import { createSuccessEnvelope, type ApiSuccessResponse } from '@vynor/contracts';
import { prisma } from '@vynor/database';
import { Public } from '../iam/decorators.js';

export interface HealthCheckData {
  status: 'ok' | 'degraded';
  version: string;
  uptimeSeconds: number;
  database: 'connected' | 'disconnected';
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  async check(): Promise<ApiSuccessResponse<HealthCheckData>> {
    let dbStatus: 'connected' | 'disconnected';

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    const data: HealthCheckData = {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      version: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };

    return createSuccessEnvelope(data, {
      service: 'vynor-api',
      environment: process.env.NODE_ENV || 'development',
    });
  }
}
