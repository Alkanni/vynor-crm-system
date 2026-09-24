import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { ApiEnvSchema, loadEnvFileIfPresent, validateEnv } from '@vynor/contracts';

import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor.js';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor.js';

// Load local .env if present
loadEnvFileIfPresent();

// FND-011 / FND-017: Validate environment variables on startup.
// Crashes immediately with descriptive diagnostics if configuration is invalid or missing.
const env = validateEnv(ApiEnvSchema, process.env);

const app = await NestFactory.create(AppModule);

// FND-036: Set global API prefix to /api/v1
app.setGlobalPrefix('api/v1');

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
