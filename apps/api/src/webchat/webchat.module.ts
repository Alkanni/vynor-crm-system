import { Module } from '@nestjs/common';
import { WebchatController } from './webchat.controller.js';
import { WebchatService } from './webchat.service.js';

@Module({
  controllers: [WebchatController],
  providers: [WebchatService],
})
export class WebchatModule {}
