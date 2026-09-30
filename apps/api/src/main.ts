import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
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

// rawBody keeps the exact request bytes that provider webhook signatures are computed over.
const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
app.useBodyParser('json', { limit: '5mb' });
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

// FND-036: Set global API prefix to /api/v1
app.setGlobalPrefix('api/v1');

// FND-BE-001 / FND-039: Register global Zod validation pipe
app.useGlobalPipes(new ZodValidationPipe());

// FND-037: Register global RFC-7807 compliant API exception filter
app.useGlobalFilters(new ApiExceptionFilter());

// FND-037 / FND-040: Register correlation ID and idempotency interceptors
app.useGlobalInterceptors(new CorrelationIdInterceptor(), new IdempotencyInterceptor());

// Configure CORS. The embeddable web chat widget runs on customer sites, so its public
// endpoints accept any origin (without credentials); everything else is restricted.
const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
app.enableCors((req: { url?: string }, callback) => {
  const isWidgetRoute = (req.url ?? '').startsWith('/api/v1/webchat/');
  callback(
    null,
    isWidgetRoute
      ? { origin: true, credentials: false }
      : { origin: allowedOrigins, credentials: true },
  );
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
