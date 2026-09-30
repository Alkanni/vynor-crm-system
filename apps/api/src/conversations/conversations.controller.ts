import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  createSuccessEnvelope,
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
  SendMessageRequestSchema,
  UpdateConversationRequestSchema,
  type ActorContext,
  type ApiSuccessResponse,
  type ConversationSummary,
  type ListConversationsQuery,
  type ListMessagesQuery,
  type Message,
  type SendMessageRequest,
  type UpdateConversationRequest,
} from '@vynor/contracts';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CurrentActor, RequirePermissions } from '../iam/decorators.js';
import { ConversationsService } from './conversations.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

/** Unified Inbox: conversations and messages across every connected channel (issue #37). */
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @RequirePermissions('conversation:read')
  async list(
    @CurrentActor() actor: ActorContext,
    @Query(new ZodValidationPipe(ListConversationsQuerySchema)) query: ListConversationsQuery,
  ): Promise<ApiSuccessResponse<ConversationSummary[]>> {
    const { data, nextCursor } = await this.conversations.list(actor, query);
    return createSuccessEnvelope(data, { nextCursor, hasMore: nextCursor !== null });
  }

  @Get(':id')
  @RequirePermissions('conversation:read')
  async get(
    @CurrentActor() actor: ActorContext,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<ConversationSummary>> {
    return createSuccessEnvelope(await this.conversations.get(actor, id));
  }

  @Patch(':id')
  @RequirePermissions('conversation:write')
  async update(
    @CurrentActor() actor: ActorContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateConversationRequestSchema)) body: UpdateConversationRequest,
    @Req() req: CorrelatedRequest,
  ): Promise<ApiSuccessResponse<ConversationSummary>> {
    return createSuccessEnvelope(
      await this.conversations.update(actor, id, body, req.correlationId ?? 'unknown'),
    );
  }

  @Post(':id/read')
  @HttpCode(204)
  @RequirePermissions('conversation:read')
  async markRead(@CurrentActor() actor: ActorContext, @Param('id') id: string): Promise<void> {
    await this.conversations.markRead(actor, id);
  }

  @Get(':id/messages')
  @RequirePermissions('message:read')
  async messages(
    @CurrentActor() actor: ActorContext,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(ListMessagesQuerySchema)) query: ListMessagesQuery,
  ): Promise<ApiSuccessResponse<Message[]>> {
    const { data, nextCursor } = await this.conversations.listMessages(actor, id, query);
    return createSuccessEnvelope(data, { nextCursor, hasMore: nextCursor !== null });
  }

  @Post(':id/messages')
  @RequirePermissions('message:send')
  async send(
    @CurrentActor() actor: ActorContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SendMessageRequestSchema)) body: SendMessageRequest,
    @Req() req: CorrelatedRequest,
  ): Promise<ApiSuccessResponse<Message>> {
    return createSuccessEnvelope(
      await this.conversations.sendMessage(actor, id, body, req.correlationId ?? 'unknown'),
    );
  }
}

@Controller('messages')
export class MessagesController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post(':id/retry')
  @RequirePermissions('message:send')
  async retry(
    @CurrentActor() actor: ActorContext,
    @Param('id') id: string,
    @Req() req: CorrelatedRequest,
  ): Promise<ApiSuccessResponse<Message>> {
    return createSuccessEnvelope(
      await this.conversations.retryMessage(actor, id, req.correlationId ?? 'unknown'),
    );
  }
}
