import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ChannelRuntimeService } from './channel-runtime.service.js';
import { ChannelsController, WorkspaceMembersController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';

@Global()
@Module({
  imports: [AuditModule],
  controllers: [ChannelsController, WorkspaceMembersController],
  providers: [ChannelRuntimeService, ChannelsService],
  exports: [ChannelRuntimeService, ChannelsService],
})
export class ChannelsModule {}
