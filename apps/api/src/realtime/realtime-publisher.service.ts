import { Injectable } from '@nestjs/common';
import {
  createRealtimeEvent,
  type CreateRealtimeEventInput,
  type RealtimeEventEnvelope,
} from '@vynor/contracts';
import { createLogger, type Logger } from '@vynor/observability';
import { RealtimeGateway } from './realtime.gateway.js';

@Injectable()
export class RealtimePublisherService {
  private readonly logger: Logger;

  constructor(private readonly gateway: RealtimeGateway) {
    this.logger = createLogger({
      service: 'vynor-api',
      environment: process.env.NODE_ENV || 'development',
    });
  }

  /**
   * Publishes a versioned realtime event to canonical Socket.IO rooms (FND-BE-009, FND-077).
   * Events serve as hints for client cache invalidation and REST refetching.
   */
  publish(input: CreateRealtimeEventInput): RealtimeEventEnvelope {
    const envelope = createRealtimeEvent(input);

    const server = this.gateway.getServer();
    if (server) {
      server.to(envelope.rooms).emit(envelope.eventType, envelope);
      this.logger.debug(
        {
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          rooms: envelope.rooms,
          workspaceId: envelope.workspaceId,
        },
        'Realtime event broadcasted to rooms',
      );
    } else {
      this.logger.warn(
        { eventId: envelope.eventId, eventType: envelope.eventType },
        'Realtime gateway server not available; event broadcast skipped',
      );
    }

    return envelope;
  }
}
