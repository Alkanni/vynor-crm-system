import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { ApiEnvSchema, loadEnvFileIfPresent, validateEnv } from '@vynor/contracts';
import { createLogger, generateCorrelationId } from '@vynor/observability';

import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor.js';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';

// Load local .env if present
loadEnvFileIfPresent();

// FND-011 / FND-017: Validate environment variables on startup.
// Crashes immediately with descriptive diagnostics if configuration is invalid or missing.
const env = validateEnv(ApiEnvSchema, process.env);

const app = await NestFactory.create(AppModule);

// FND-036: Set global API prefix to /api/v1
app.setGlobalPrefix('api/v1');

// FND-BE-001 / FND-039: Register global Zod validation pipe
app.useGlobalPipes(new ZodValidationPipe());

// FND-037: Register global RFC-7807 compliant API exception filter
app.useGlobalFilters(new ApiExceptionFilter());

// FND-037 / FND-040: Register correlation ID and idempotency interceptors
app.useGlobalInterceptors(new CorrelationIdInterceptor(), new IdempotencyInterceptor());

// Configure CORS
app.enableCors({
  origin: env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
  credentials: true,
});

app.enableShutdownHooks();

await app.listen(env.PORT);

const logger = createLogger({
  service: 'vynor-api',
  environment: env.NODE_ENV,
});

logger.info(
  { correlationId: generateCorrelationId('boot') },
  `VYNOR API server successfully listening on port ${env.PORT} with prefix /api/v1`,
);
