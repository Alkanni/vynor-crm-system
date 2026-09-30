import { createHmac, randomBytes } from 'node:crypto';
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiEnvSchema } from '@vynor/contracts';
import {
  createTestPrismaClient,
  generateId,
  type Prisma,
  type PrismaClient,
} from '@vynor/database';
import { sealChannelSecrets } from '@vynor/channel-adapters';
import { CredentialCipher } from '@vynor/shared';
import { ChannelRuntimeService } from '../src/channels/channel-runtime.service.js';
import { WebhookIngestService } from '../src/webhooks/webhook-ingest.service.js';
import { WebhooksController } from '../src/webhooks/webhooks.controller.js';

/**
 * Issue #37: the public webhook endpoint over real HTTP, configured like main.ts (raw body,
 * 5 MB JSON limit, /api/v1 prefix). Signatures must be checked against the exact bytes the
 * provider sent, and dotted query keys like `hub.verify_token` must survive parsing.
 */

const APP_SECRET = 'abcdef0123456789abcdef0123456789';
const VERIFY_TOKEN = 'verify-token-for-http-tests';
const PHONE_ID = '106540352242922';

const env = ApiEnvSchema.parse({
  APP_ENV: 'test',
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unused',
  DIRECT_URL: 'postgresql://unused',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  SUPABASE_JWT_SECRET: 'jwt-secret-for-integration-tests-0123456789',
  STORAGE_ACCESS_KEY_ID: 'key',
  STORAGE_SECRET_ACCESS_KEY: 'secret',
  ENCRYPTION_MASTER_KEY: randomBytes(32).toString('base64'),
  PUBLIC_WEBHOOK_BASE_URL: 'https://crm.vynor.test',
});

const sign = (body: string) =>
  `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`;

/** A Meta delivery formatted the way Meta sends it: pretty-printed, not compact JSON. */
function prettyDelivery(wamid: string): string {
  return JSON.stringify(
    {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '102290129340398',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '6281100001111', phone_number_id: PHONE_ID },
                contacts: [{ profile: { name: 'Siti Aminah' }, wa_id: '6281234567890' }],
                messages: [
                  {
                    from: '6281234567890',
                    id: wamid,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'Halo 👋 ada promo?' },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    null,
    2,
  );
}

describe('Webhook endpoint over HTTP (issue #37)', () => {
  let db: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;
  let workspaceId: string;
  let channelId: string;
  const webhookKey = `http-it-${randomBytes(6).toString('hex')}`;
  const runtime = new ChannelRuntimeService(env);

  beforeAll(async () => {
    db = createTestPrismaClient();
    const workspace = await db.workspace.create({
      data: {
        name: 'Webhook HTTP Integration',
        slug: `webhook-http-it-${randomBytes(4).toString('hex')}`,
      },
    });
    workspaceId = workspace.id;
    channelId = generateId();
    await db.providerAccount.create({
      data: {
        id: channelId,
        workspaceId,
        channelType: 'WHATSAPP',
        provider: 'WHATSAPP_CLOUD',
        name: 'WhatsApp Toko',
        accountIdentifier: PHONE_ID,
        credentials: sealChannelSecrets(CredentialCipher.fromEnv(env)!, {
          provider: 'WHATSAPP_CLOUD',
          providerAccountId: channelId,
          secrets: {
            credentials: {
              accessToken: 'EAAGtestTokenForIntegrationSuite0123456789',
              phoneNumberId: PHONE_ID,
              businessAccountId: '102290129340398',
              appSecret: APP_SECRET,
            },
            generated: { verifyToken: VERIFY_TOKEN },
          },
        }) as unknown as Prisma.InputJsonValue,
        config: { inboundMode: 'WEBHOOK' },
        webhookKey,
      },
    });

    // The worker/API DI graph is not needed: only the webhook controller and its service.
    Reflect.defineMetadata('design:paramtypes', [WebhookIngestService], WebhooksController);
    class WebhookHttpTestModule {}
    Module({
      controllers: [WebhooksController],
      providers: [{ provide: WebhookIngestService, useValue: new WebhookIngestService(runtime) }],
    })(WebhookHttpTestModule);

    const nest = await NestFactory.create<NestExpressApplication>(WebhookHttpTestModule, {
      rawBody: true,
      logger: false,
    });
    nest.useBodyParser('json', { limit: '5mb' });
    nest.setGlobalPrefix('api/v1');
    await nest.listen(0, '127.0.0.1');
    app = nest;
    baseUrl = `${(await nest.getUrl()).replace('[::1]', '127.0.0.1')}/api/v1/webhooks/whatsapp/${webhookKey}`;
  });

  afterAll(async () => {
    await app?.close();
    if (!db) return;
    if (workspaceId) {
      await db.outboxEvent.deleteMany({ where: { workspaceId } });
      await db.providerEvent.deleteMany({ where: { workspaceId } });
      await db.providerAccount.deleteMany({ where: { workspaceId } });
      await db.workspace.delete({ where: { id: workspaceId } });
    }
    await db.$disconnect();
  });

  it('echoes the Meta challenge as plain text when the verify token matches', async () => {
    const url = `${baseUrl}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1158201444`;
    const ok = await fetch(url);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toContain('text/plain');
    await expect(ok.text()).resolves.toBe('1158201444');

    const wrong = await fetch(url.replace(VERIFY_TOKEN, 'nope'));
    expect(wrong.status).toBe(403);
  });

  it('verifies the signature over the exact bytes received', async () => {
    const body = prettyDelivery('wamid.HTTP-1');
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(body) },
      body,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, accepted: 1, duplicates: 0 });

    // Same JSON value, different bytes: a signature over re-serialized JSON must not pass.
    const compact = JSON.stringify(JSON.parse(prettyDelivery('wamid.HTTP-2')));
    const tampered = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': sign(prettyDelivery('wamid.HTTP-2')),
      },
      body: compact,
    });
    expect(tampered.status).toBe(401);

    await expect(
      db.providerEvent.findMany({
        where: { providerAccountId: channelId },
        select: { providerEventKey: true },
      }),
    ).resolves.toEqual([{ providerEventKey: 'msg:wamid.HTTP-1' }]);
  });

  it('rejects unknown webhook keys and bodies over 5 MB', async () => {
    const unknown = await fetch(baseUrl.replace(webhookKey, 'not-a-channel-key'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(unknown.status).toBe(404);

    const huge = JSON.stringify({ padding: 'x'.repeat(5 * 1024 * 1024 + 1) });
    const tooLarge = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(huge) },
      body: huge,
    });
    expect(tooLarge.status).toBe(413);
  });
});
