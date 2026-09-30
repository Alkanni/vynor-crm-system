import { Module } from '@nestjs/common';
import { ConversationsController, MessagesController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { MediaController } from './media.controller.js';
import { MediaUrlService } from './media-url.service.js';

@Module({
  controllers: [ConversationsController, MessagesController, MediaController],
  providers: [ConversationsService, MediaUrlService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
