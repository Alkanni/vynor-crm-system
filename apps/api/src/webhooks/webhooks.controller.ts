import { Controller, Get, Param, Post, Req, Res, type RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../iam/decorators.js';
import { WebhookIngestService, type WebhookResponse } from './webhook-ingest.service.js';

type WebhookHttpRequest = RawBodyRequest<Request> & { correlationId?: string };

/**
 * Public provider callbacks: /api/v1/webhooks/:provider/:webhookKey (issue #37).
 * Authentication is the provider signature, checked against the channel's secrets.
 */
@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly ingest: WebhookIngestService) {}

  @Get(':provider/:webhookKey')
  async verify(
    @Param('provider') provider: string,
    @Param('webhookKey') webhookKey: string,
    @Req() req: WebhookHttpRequest,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.ingest.handle(
      provider,
      webhookKey,
      toWebhookRequest('GET', req),
      req.correlationId ?? 'webhook',
    );
    send(res, result);
  }

  @Post(':provider/:webhookKey')
  async receive(
    @Param('provider') provider: string,
    @Param('webhookKey') webhookKey: string,
    @Req() req: WebhookHttpRequest,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.ingest.handle(
      provider,
      webhookKey,
      toWebhookRequest('POST', req),
      req.correlationId ?? 'webhook',
    );
    send(res, result);
  }
}

function toWebhookRequest(method: 'GET' | 'POST', req: WebhookHttpRequest) {
  // Parsed from the raw URL so dotted keys such as `hub.verify_token` survive any query parser.
  const query: Record<string, string> = {};
  for (const [key, value] of new URL(req.originalUrl, 'http://localhost').searchParams) {
    query[key] = value;
  }
  return { method, rawBody: req.rawBody ?? Buffer.alloc(0), headers: req.headers, query };
}

function send(res: Response, result: WebhookResponse): void {
  if (typeof result.body === 'string') {
    // Verification challenges must be echoed as plain text.
    res.status(result.status).type('text/plain').send(result.body);
    return;
  }
  res.status(result.status).json(result.body);
}
