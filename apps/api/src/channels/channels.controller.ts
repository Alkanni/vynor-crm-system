import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  createSuccessEnvelope,
  CreateChannelRequestSchema,
  ReconnectChannelRequestSchema,
  UpdateChannelRequestSchema,
  type ActorContext,
  type ApiSuccessResponse,
  type Channel,
  type ChannelTestResult,
  type CreateChannelRequest,
  type ReconnectChannelRequest,
  type UpdateChannelRequest,
  type WorkspaceMember,
} from '@vynor/contracts';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CurrentActor, RequirePermissions } from '../iam/decorators.js';
import { ChannelsService } from './channels.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

/** Channels (inboxes): connect, configure and monitor platform accounts (issue #37). */
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  @RequirePermissions('integration:read')
  async list(@CurrentActor() actor: ActorContext): Promise<ApiSuccessResponse<Channel[]>> {
    return createSuccessEnvelope(await this.channels.list(actor));
  }

  @Get(':id')
  @RequirePermissions('integration:read')
  async get(
    @CurrentActor() actor: ActorContext,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<Channel>> {
    return createSuccessEnvelope(await this.channels.get(actor, id));
  }

  @Post()
  @RequirePermissions('integration:manage')
  async create(
    @CurrentActor() actor: ActorContext,
    @Body(new ZodValidationPipe(CreateChannelRequestSchema)) body: CreateChannelRequest,
    @Req() req: CorrelatedRequest,
  ): Promise<ApiSuccessResponse<Channel>> {
    return createSuccessEnvelope(
      await this.channels.create(actor, body, req.correlationId ?? 'unknown'),
    );
  }

  @Patch(':id')
  @RequirePermissions('integration:manage')
  async update(
    @CurrentActor() actor: ActorContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateChannelRequestSchema)) body: UpdateChannelRequest,
    @Req() req: CorrelatedRequest,
  ): Promise<ApiSuccessResponse<Channel>> {
    return createSuccessEnvelope(
      await this.channels.update(actor, id, body, req.correlationId ?? 'unknown'),
    );
  }

  @Put(':id/credentials')
  @RequirePermissions('integration:manage')
  async reconnect(
    @CurrentActor() actor: ActorContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReconnectChannelRequestSchema)) body: ReconnectChannelRequest,
    @Req() req: CorrelatedRequest,
  ): Promise<ApiSuccessResponse<Channel>> {
    return createSuccessEnvelope(
      await this.channels.reconnect(actor, id, body, req.correlationId ?? 'unknown'),
    );
  }

  @Post(':id/test')
  @HttpCode(200)
  @RequirePermissions('integration:manage')
  async test(
    @CurrentActor() actor: ActorContext,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<ChannelTestResult>> {
    return createSuccessEnvelope(await this.channels.test(actor, id));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('integration:manage')
  async remove(
    @CurrentActor() actor: ActorContext,
    @Param('id') id: string,
    @Req() req: CorrelatedRequest,
  ): Promise<void> {
    await this.channels.remove(actor, id, req.correlationId ?? 'unknown');
  }
}

/** Workspace members, used by the Human Agent picker and assignment menus. */
@Controller('workspace')
export class WorkspaceMembersController {
  constructor(private readonly channels: ChannelsService) {}

  @Get('members')
  @RequirePermissions('user:read')
  async members(
    @CurrentActor() actor: ActorContext,
  ): Promise<ApiSuccessResponse<WorkspaceMember[]>> {
    return createSuccessEnvelope(await this.channels.listMembers(actor));
  }
}
