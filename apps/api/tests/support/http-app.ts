import { randomBytes } from 'node:crypto';
import 'reflect-metadata';
import {
  Global,
  Module,
  type Abstract,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
  type Provider,
  type Type,
} from '@nestjs/common';
import { APP_GUARD, NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiEnvSchema, type ApiEnv } from '@vynor/contracts';
import * as jose from 'jose';
import { AuditService } from '../../src/audit/audit.service.js';
import { ChannelRuntimeService } from '../../src/channels/channel-runtime.service.js';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter.js';
import { CorrelationIdInterceptor } from '../../src/common/interceptors/correlation-id.interceptor.js';
import { IdempotencyInterceptor } from '../../src/common/interceptors/idempotency.interceptor.js';
import { CorrelationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware.js';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe.js';
import { API_ENV } from '../../src/config/api-env.js';
import {
  ConversationsController,
  MessagesController,
} from '../../src/conversations/conversations.controller.js';
import { ConversationsService } from '../../src/conversations/conversations.service.js';
import { MediaController } from '../../src/conversations/media.controller.js';
import { MediaUrlService } from '../../src/conversations/media-url.service.js';
import { HealthController } from '../../src/health/health.controller.js';
import { ActorContextService } from '../../src/iam/actor-context.service.js';
import { AuthGuard } from '../../src/iam/auth.guard.js';
import { JwtVerifierService } from '../../src/iam/jwt-verifier.service.js';
import { PermissionGuard } from '../../src/iam/permission.guard.js';
import { IdempotencyStore } from '../../src/redis/idempotency-store.js';
import { RateLimitStore } from '../../src/redis/rate-limit-store.js';
import { RedisHealthIndicator, RedisModule } from '../../src/redis/redis.module.js';
import { WebchatController } from '../../src/webchat/webchat.controller.js';
import { WebchatService } from '../../src/webchat/webchat.service.js';

/**
 * Real HTTP servers for the WU-03 characterization specs: the API's own controllers, guards,
 * pipes, filter and interceptors, set up the way main.ts sets them up, on a random port.
 *
 * Vitest compiles with esbuild, which emits no decorator metadata, so the constructor
 * dependencies Nest would read from `design:paramtypes` are declared here.
 */
const CONSTRUCTOR_DEPENDENCIES: [Type, (Type | Abstract<unknown>)[]][] = [
  [AuthGuard, [Reflector, JwtVerifierService, ActorContextService]],
  [PermissionGuard, [Reflector, AuditService]],
  [ConversationsController, [ConversationsService]],
  [MessagesController, [ConversationsService]],
  [ConversationsService, [ChannelRuntimeService, MediaUrlService, AuditService]],
  [MediaUrlService, [ChannelRuntimeService]],
  [MediaController, [ChannelRuntimeService, MediaUrlService]],
  [WebchatController, [WebchatService, ChannelRuntimeService]],
  [WebchatService, [ChannelRuntimeService, RateLimitStore]],
  [HealthController, [RedisHealthIndicator]],
];
for (const [type, dependencies] of CONSTRUCTOR_DEPENDENCIES) {
  Reflect.defineMetadata('design:paramtypes', dependencies, type);
}

/**
 * Redis for the specs (TEST_REDIS_URL), like the test database a disposable local instance:
 * CI runs a Redis service container. Specs only write keys with a TTL under `vynor:` and
 * never flush, but a Redis outside this machine is refused all the same.
 */
export function testRedisUrl(): string {
  const url = process.env.TEST_REDIS_URL;
  if (!url) {
    throw new Error(
      'No test Redis configured. Set TEST_REDIS_URL to a disposable local Redis ' +
        '(for example redis://127.0.0.1:56379/0) before running the API integration tests.',
    );
  }
  const { hostname } = new URL(url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) {
    throw new Error(`TEST_REDIS_URL must point at a local Redis, got host ${hostname}`);
  }
  return url;
}

/**
 * API environment for the specs; the database comes from the test runner's own env and the
 * shared state from TEST_REDIS_URL, as in a deployment.
 */
export function testApiEnv(overrides: Record<string, string> = {}): ApiEnv {
  return ApiEnvSchema.parse({
    APP_ENV: 'test',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused',
    DIRECT_URL: 'postgresql://unused',
    ...('REDIS_URL' in overrides || overrides.SHARED_STATE_STORE === 'memory'
      ? {}
      : { REDIS_URL: testRedisUrl() }),
    // A closed port: tokens that fail the local secret are never checked against a real JWKS.
    SUPABASE_URL: 'http://127.0.0.1:9',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    SUPABASE_JWT_SECRET: 'jwt-secret-for-characterization-tests-0123456789',
    STORAGE_ACCESS_KEY_ID: 'key',
    STORAGE_SECRET_ACCESS_KEY: 'secret',
    ENCRYPTION_MASTER_KEY: randomBytes(32).toString('base64'),
    APP_URL: 'https://api.vynor.test',
    ...overrides,
  });
}

/** An access token the API accepts for `supabaseAuthId`, like a Supabase session token. */
export async function accessToken(env: ApiEnv, supabaseAuthId: string): Promise<string> {
  return new jose.SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(supabaseAuthId)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(env.SUPABASE_JWT_SECRET));
}

export interface HttpApp {
  baseUrl: string;
  close(): Promise<void>;
}

export async function startHttpApp(options: {
  env: ApiEnv;
  controllers: Type[];
  providers?: Provider[];
  /** Registers the AuthGuard and PermissionGuard globally, as IamModule does. */
  withIam?: boolean;
}): Promise<HttpApp> {
  const providers: Provider[] = [ChannelRuntimeService, AuditService, ...(options.providers ?? [])];
  if (options.withIam) {
    providers.push(
      JwtVerifierService,
      ActorContextService,
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: PermissionGuard },
    );
  }

  // Global like ConfigModule, so RedisModule builds its store from this environment.
  class TestConfigModule {}
  Module({ providers: [{ provide: API_ENV, useValue: options.env }], exports: [API_ENV] })(
    TestConfigModule,
  );
  Global()(TestConfigModule);

  class CharacterizationModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
      consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    }
  }
  Module({
    imports: [TestConfigModule, RedisModule],
    controllers: options.controllers,
    providers,
  })(CharacterizationModule);

  // Same setup as main.ts.
  const app = await NestFactory.create<NestExpressApplication>(
    CharacterizationModule as unknown as DynamicModule,
    { rawBody: true, logger: false },
  );
  app.useBodyParser('json', { limit: '5mb' });
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new IdempotencyInterceptor(app.get(IdempotencyStore)),
  );
  await app.listen(0, '127.0.0.1');

  const baseUrl = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/api/v1`;
  return { baseUrl, close: () => app.close() };
}

export interface HttpResult<T = Record<string, unknown>> {
  status: number;
  headers: Headers;
  body: T;
}

export async function http<T = Record<string, unknown>>(
  url: string,
  init: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<HttpResult<T>> {
  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: (text ? JSON.parse(text) : null) as T,
  };
}
