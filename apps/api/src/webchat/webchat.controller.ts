import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { createSuccessEnvelope, type ApiSuccessResponse } from '@vynor/contracts';
import type { Request, Response } from 'express';
import { ChannelRuntimeService } from '../channels/channel-runtime.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { Public } from '../iam/decorators.js';
import {
  WebchatMessageRequestSchema,
  WebchatService,
  WebchatSessionRequestSchema,
  type WebchatConfig,
  type WebchatMessage,
  type WebchatMessageRequest,
  type WebchatSessionRequest,
} from './webchat.service.js';
import { renderWidgetScript } from './widget-script.js';

type CorrelatedRequest = Request & { correlationId?: string };

/**
 * Public endpoints for the Web Live Chat widget embedded on customer sites (issue #37).
 * CORS for /api/v1/webchat/* allows any origin without credentials (see main.ts).
 */
@Public()
@Controller('webchat/:widgetKey')
export class WebchatController {
  constructor(
    private readonly webchat: WebchatService,
    private readonly runtime: ChannelRuntimeService,
  ) {}

  @Get('widget.js')
  async script(@Param('widgetKey') widgetKey: string, @Res() res: Response): Promise<void> {
    await this.webchat.config(widgetKey);
    res
      .status(200)
      .type('application/javascript')
      .setHeader('Cache-Control', 'public, max-age=300')
      .send(renderWidgetScript(this.runtime.publicBaseUrl, widgetKey));
  }

  @Get('config')
  async config(@Param('widgetKey') widgetKey: string): Promise<ApiSuccessResponse<WebchatConfig>> {
    return createSuccessEnvelope(await this.webchat.config(widgetKey));
  }

  @Post('sessions')
  @HttpCode(200)
  async session(
    @Param('widgetKey') widgetKey: string,
    @Body(new ZodValidationPipe(WebchatSessionRequestSchema)) body: WebchatSessionRequest,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<{ visitorId: string; visitorToken: string }>> {
    return createSuccessEnvelope(await this.webchat.session(widgetKey, body, req.ip ?? 'unknown'));
  }

  @Post('messages')
  @HttpCode(202)
  async post(
    @Param('widgetKey') widgetKey: string,
    @Body(new ZodValidationPipe(WebchatMessageRequestSchema)) body: WebchatMessageRequest,
    @Headers('x-visitor-token') token: string | undefined,
    @Req() req: CorrelatedRequest,
  ): Promise<ApiSuccessResponse<{ accepted: boolean }>> {
    return createSuccessEnvelope(
      await this.webchat.postMessage(
        widgetKey,
        body,
        token,
        req.ip ?? 'unknown',
        req.correlationId ?? 'webchat',
      ),
    );
  }

  @Get('messages')
  async messages(
    @Param('widgetKey') widgetKey: string,
    @Query('visitorId') visitorId: string,
    @Query('after') after: string | undefined,
    @Headers('x-visitor-token') token: string | undefined,
  ): Promise<ApiSuccessResponse<WebchatMessage[]>> {
    return createSuccessEnvelope(await this.webchat.messages(widgetKey, visitorId, token, after));
  }
}
