import { describe, expect, it } from 'vitest';
import { QUEUE_NAMES } from '@vynor/contracts';
import { queueForEventType } from '../src/outbox/outbox-dispatcher.service.js';

describe('outbox event routing (issue #40)', () => {
  it.each([
    ['message.outbound.requested', QUEUE_NAMES.MESSAGES_OUTBOUND],
    ['webhook.received', QUEUE_NAMES.WEBHOOKS_PROCESS],
    ['campaign.launched', QUEUE_NAMES.CAMPAIGNS_DISPATCH],
    ['conversation.assigned', QUEUE_NAMES.CONVERSATIONS_ROUTE],
    ['ai.reply.requested', QUEUE_NAMES.AI_GENERATE],
    ['audit.export.requested', QUEUE_NAMES.AUDIT_EXPORT],
  ])('routes %s to %s', (eventType, queue) => {
    expect(queueForEventType(eventType)).toBe(queue);
  });

  it('matches the domain prefix case-insensitively', () => {
    expect(queueForEventType('Webhook.Received')).toBe(QUEUE_NAMES.WEBHOOKS_PROCESS);
  });

  it('reports event types that no queue handles', () => {
    expect(queueForEventType('workspace.created')).toBeNull();
    expect(queueForEventType('webhook')).toBeNull();
  });
});
