import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { loadEnvFileIfPresent, validateEnv, WorkerEnvSchema } from '@vynor/contracts';
import { createLogger, generateCorrelationId } from '@vynor/observability';

import { WorkerModule } from './worker.module.js';

// Load local .env if present
loadEnvFileIfPresent();

// FND-011 / FND-017: Validate environment variables on startup.
const env = validateEnv(WorkerEnvSchema, process.env);

// FND-043: Initialize Pino structured logger
const logger = createLogger({
  service: 'vynor-worker',
  environment: env.NODE_ENV,
});

logger.info(
  { correlationId: generateCorrelationId('boot') },
  'Starting VYNOR background worker daemon...',
);

const app = await NestFactory.createApplicationContext(WorkerModule);

app.enableShutdownHooks();

logger.info(
  { correlationId: generateCorrelationId('boot') },
  'VYNOR background worker daemon initialized successfully',
);
