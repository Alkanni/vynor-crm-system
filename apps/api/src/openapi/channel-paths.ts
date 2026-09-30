import {
  ActorContextSchema,
  ChannelSchema,
  ChannelTestResultSchema,
  ConversationSummarySchema,
  CreateChannelRequestSchema,
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
  MessageSchema,
  ReconnectChannelRequestSchema,
  SendMessageRequestSchema,
  UpdateChannelRequestSchema,
  UpdateConversationRequestSchema,
  WorkspaceMemberSchema,
} from '@vynor/contracts';
import { z } from 'zod';
import { DevSessionRequestSchema } from '../auth/dev-session.schemas.js';
import {
  WebchatMessageRequestSchema,
  WebchatSessionRequestSchema,
} from '../webchat/webchat.schemas.js';

/**
 * OpenAPI paths and schemas for channels, webhooks, conversations, media, web chat and the
 * session endpoints (issue #37). Schemas are generated from the Zod contracts the controllers
 * validate with, so the document cannot drift from the code.
 */

type JsonObject = Record<string, unknown>;

function toSchema(schema: z.ZodType, io: 'input' | 'output'): JsonObject {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, {
    io,
    unrepresentable: 'any',
  }) as JsonObject;
  return rest;
}

const ref = (name: string): JsonObject => ({ $ref: `#/components/schemas/${name}` });

function success(description: string, data: JsonObject, withPageInfo = false): JsonObject {
  const properties: JsonObject = { data };
  if (withPageInfo) {
    properties.meta = {
      type: 'object',
      properties: {
        nextCursor: { type: ['string', 'null'] },
        hasMore: { type: 'boolean' },
      },
    };
  }
  return {
    description,
    content: {
      'application/json': {
        schema: { allOf: [ref('ApiSuccessResponse'), { properties }] },
      },
    },
  };
}

const failure = (description: string): JsonObject => ({
  description,
  content: { 'application/json': { schema: ref('ApiErrorResponse') } },
});

const jsonBody = (name: string): JsonObject => ({
  required: true,
  content: { 'application/json': { schema: ref(name) } },
});

const workspaceHeader: JsonObject = {
  name: 'x-workspace-id',
  in: 'header',
  required: false,
  schema: { type: 'string' },
  description:
    'Target workspace identifier; required when the user belongs to several workspaces (x-workspace-slug is also accepted)',
};

const pathParam = (name: string, description: string): JsonObject => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description,
});

/** Query parameters from a Zod object schema. */
function queryParams(schema: z.ZodType): JsonObject[] {
  const json = toSchema(schema, 'input') as {
    properties?: Record<string, JsonObject>;
    required?: string[];
  };
  return Object.entries(json.properties ?? {}).map(([name, property]) => ({
    name,
    in: 'query',
    required: json.required?.includes(name) ?? false,
    schema: property,
  }));
}

const authErrors: JsonObject = {
  '401': failure('Authentication token missing or invalid'),
  '403': failure('Permission denied or workspace access rejected'),
};

export function channelOpenApiSchemas(): JsonObject {
  return {
    ActorContext: toSchema(ActorContextSchema, 'output'),
    Channel: toSchema(ChannelSchema, 'output'),
    ChannelTestResult: toSchema(ChannelTestResultSchema, 'output'),
    CreateChannelRequest: toSchema(CreateChannelRequestSchema, 'input'),
    UpdateChannelRequest: toSchema(UpdateChannelRequestSchema, 'input'),
    ReconnectChannelRequest: toSchema(ReconnectChannelRequestSchema, 'input'),
    WorkspaceMember: toSchema(WorkspaceMemberSchema, 'output'),
    ConversationSummary: toSchema(ConversationSummarySchema, 'output'),
    UpdateConversationRequest: toSchema(UpdateConversationRequestSchema, 'input'),
    Message: toSchema(MessageSchema, 'output'),
    SendMessageRequest: toSchema(SendMessageRequestSchema, 'input'),
    DevSessionRequest: toSchema(DevSessionRequestSchema, 'input'),
    WebchatSessionRequest: toSchema(WebchatSessionRequestSchema, 'input'),
    WebchatMessageRequest: toSchema(WebchatMessageRequestSchema, 'input'),
  };
}

export function channelOpenApiPaths(): JsonObject {
  return {
    '/auth/me': {
      get: {
        summary: 'Current Actor',
        description: 'The caller, workspace, roles and permissions as resolved by the backend.',
        operationId: 'getCurrentActor',
        parameters: [workspaceHeader],
        responses: { '200': success('Resolved actor', ref('ActorContext')), ...authErrors },
      },
    },
    '/auth/dev-session': {
      get: {
        summary: 'Development Sign-in Availability',
        description: 'Whether the local development sign-in is enabled on this API.',
        operationId: 'getDevSessionStatus',
        security: [],
        responses: {
          '200': success('Availability', {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          }),
        },
      },
      post: {
        summary: 'Development Sign-in',
        description:
          'Issues a session token for a seeded user. Only available when APP_ENV is local or test and AUTH_DEV_SESSION_ENABLED=true; otherwise responds 404.',
        operationId: 'createDevSession',
        security: [],
        requestBody: jsonBody('DevSessionRequest'),
        responses: {
          '200': success('Session issued', {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
              user: { type: 'object' },
            },
          }),
          '404': failure('Development sign-in disabled, or the seeded user does not exist'),
        },
      },
    },
    '/channels': {
      get: {
        summary: 'List Channels',
        description: 'Connected channels of the workspace. Requires integration:read.',
        operationId: 'listChannels',
        parameters: [workspaceHeader],
        responses: {
          '200': success('Channels', { type: 'array', items: ref('Channel') }),
          ...authErrors,
        },
      },
      post: {
        summary: 'Connect a Channel',
        description:
          'Verifies the credentials with the provider, stores them encrypted, and registers the webhook where the provider supports it. Requires integration:manage.',
        operationId: 'createChannel',
        parameters: [workspaceHeader],
        requestBody: jsonBody('CreateChannelRequest'),
        responses: {
          '201': success('Channel connected', ref('Channel')),
          ...authErrors,
          '409': failure('The account is already connected (CHANNEL_ALREADY_CONNECTED)'),
          '422': failure('The provider rejected the credentials (CHANNEL_VERIFICATION_FAILED)'),
          '502': failure('The provider could not be reached (CHANNEL_PROVIDER_UNREACHABLE)'),
          '503': failure('ENCRYPTION_MASTER_KEY is not configured'),
        },
      },
    },
    '/channels/{id}': {
      get: {
        summary: 'Get Channel',
        operationId: 'getChannel',
        parameters: [pathParam('id', 'Channel identifier'), workspaceHeader],
        responses: {
          '200': success('Channel', ref('Channel')),
          ...authErrors,
          '404': failure('Channel not found (CHANNEL_NOT_FOUND)'),
        },
      },
      patch: {
        summary: 'Update Channel Settings',
        description: 'Name, description, inbox settings and human agents.',
        operationId: 'updateChannel',
        parameters: [pathParam('id', 'Channel identifier'), workspaceHeader],
        requestBody: jsonBody('UpdateChannelRequest'),
        responses: {
          '200': success('Updated channel', ref('Channel')),
          ...authErrors,
          '404': failure('Channel not found (CHANNEL_NOT_FOUND)'),
          '422': failure('Invalid settings or human agents'),
        },
      },
      delete: {
        summary: 'Delete Channel',
        description:
          'Soft delete: conversations stay, the webhook URL stops working and the provider webhook is removed where possible.',
        operationId: 'deleteChannel',
        parameters: [pathParam('id', 'Channel identifier'), workspaceHeader],
        responses: {
          '204': { description: 'Channel deleted' },
          ...authErrors,
          '404': failure('Channel not found (CHANNEL_NOT_FOUND)'),
        },
      },
    },
    '/channels/{id}/credentials': {
      put: {
        summary: 'Update Channel Credentials',
        description:
          'Re-verifies and replaces the credentials. The current credentials stay in use when the provider rejects the new ones.',
        operationId: 'reconnectChannel',
        parameters: [pathParam('id', 'Channel identifier'), workspaceHeader],
        requestBody: jsonBody('ReconnectChannelRequest'),
        responses: {
          '200': success('Channel reconnected', ref('Channel')),
          ...authErrors,
          '404': failure('Channel not found (CHANNEL_NOT_FOUND)'),
          '409': failure('Credentials belong to another account (CHANNEL_ACCOUNT_MISMATCH)'),
          '422': failure('The provider rejected the credentials (CHANNEL_VERIFICATION_FAILED)'),
        },
      },
    },
    '/channels/{id}/test': {
      post: {
        summary: 'Test Channel Connection',
        operationId: 'testChannel',
        parameters: [pathParam('id', 'Channel identifier'), workspaceHeader],
        responses: {
          '200': success('Health check result', ref('ChannelTestResult')),
          ...authErrors,
          '404': failure('Channel not found (CHANNEL_NOT_FOUND)'),
        },
      },
    },
    '/workspace/members': {
      get: {
        summary: 'List Workspace Members',
        description: 'Active members, used to pick human agents and assignees.',
        operationId: 'listWorkspaceMembers',
        parameters: [workspaceHeader],
        responses: {
          '200': success('Members', { type: 'array', items: ref('WorkspaceMember') }),
          ...authErrors,
        },
      },
    },
    '/webhooks/{provider}/{webhookKey}': {
      get: {
        summary: 'Provider Webhook Verification',
        description: 'Answers verification handshakes such as the Meta hub.challenge.',
        operationId: 'verifyProviderWebhook',
        security: [],
        parameters: [
          pathParam('provider', 'whatsapp, messenger, instagram, telegram, line or custom'),
          pathParam('webhookKey', 'Per-channel unguessable key'),
        ],
        responses: {
          '200': { description: 'Challenge echoed' },
          '403': failure('Verify token does not match'),
          '404': failure('Unknown webhook'),
        },
      },
      post: {
        summary: 'Provider Webhook Delivery',
        description:
          'Verifies the provider signature on the raw body, journals the events with an outbox record in one transaction and acknowledges immediately. Redeliveries are acknowledged without being journaled again.',
        operationId: 'receiveProviderWebhook',
        security: [],
        parameters: [
          pathParam('provider', 'whatsapp, messenger, instagram, telegram, line or custom'),
          pathParam('webhookKey', 'Per-channel unguessable key'),
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '200': {
            description: 'Accepted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    received: { type: 'boolean' },
                    accepted: { type: 'integer' },
                    duplicates: { type: 'integer' },
                  },
                },
              },
            },
          },
          '401': failure('Invalid or missing signature'),
          '404': failure('Unknown webhook'),
          '503': failure('Channel credentials cannot be decrypted; the provider should retry'),
        },
      },
    },
    '/conversations': {
      get: {
        summary: 'List Conversations',
        operationId: 'listConversations',
        parameters: [workspaceHeader, ...queryParams(ListConversationsQuerySchema)],
        responses: {
          '200': success(
            'Conversations, newest activity first',
            { type: 'array', items: ref('ConversationSummary') },
            true,
          ),
          ...authErrors,
        },
      },
    },
    '/conversations/{id}': {
      get: {
        summary: 'Get Conversation',
        operationId: 'getConversation',
        parameters: [pathParam('id', 'Conversation identifier'), workspaceHeader],
        responses: {
          '200': success('Conversation', ref('ConversationSummary')),
          ...authErrors,
          '404': failure('Conversation not found (CONVERSATION_NOT_FOUND)'),
        },
      },
      patch: {
        summary: 'Update Conversation',
        description: 'Resolve, reopen or reassign.',
        operationId: 'updateConversation',
        parameters: [pathParam('id', 'Conversation identifier'), workspaceHeader],
        requestBody: jsonBody('UpdateConversationRequest'),
        responses: {
          '200': success('Updated conversation', ref('ConversationSummary')),
          ...authErrors,
          '404': failure('Conversation not found (CONVERSATION_NOT_FOUND)'),
          '422': failure('The assignee is not an active member (INVALID_ASSIGNEE)'),
        },
      },
    },
    '/conversations/{id}/read': {
      post: {
        summary: 'Mark Conversation Read',
        operationId: 'markConversationRead',
        parameters: [pathParam('id', 'Conversation identifier'), workspaceHeader],
        responses: { '204': { description: 'Marked as read' }, ...authErrors },
      },
    },
    '/conversations/{id}/messages': {
      get: {
        summary: 'List Messages',
        operationId: 'listMessages',
        parameters: [
          pathParam('id', 'Conversation identifier'),
          workspaceHeader,
          ...queryParams(ListMessagesQuerySchema),
        ],
        responses: {
          '200': success('Messages, oldest first', { type: 'array', items: ref('Message') }, true),
          ...authErrors,
          '404': failure('Conversation not found (CONVERSATION_NOT_FOUND)'),
        },
      },
      post: {
        summary: 'Send Reply or Private Note',
        description:
          'Stores the reply as PENDING with an outbox event; the worker sends it through the channel. Private notes are never sent to the customer.',
        operationId: 'sendMessage',
        parameters: [pathParam('id', 'Conversation identifier'), workspaceHeader],
        requestBody: jsonBody('SendMessageRequest'),
        responses: {
          '201': success('Message stored', ref('Message')),
          ...authErrors,
          '404': failure('Conversation not found (CONVERSATION_NOT_FOUND)'),
          '409': failure('The channel was deleted or needs to be reconnected'),
          '422': failure('The reply target is not in this conversation (INVALID_REPLY_TARGET)'),
        },
      },
    },
    '/messages/{id}/retry': {
      post: {
        summary: 'Retry Failed Reply',
        operationId: 'retryMessage',
        parameters: [pathParam('id', 'Message identifier'), workspaceHeader],
        responses: {
          '201': success('Reply queued again', ref('Message')),
          ...authErrors,
          '404': failure('Message not found (MESSAGE_NOT_FOUND)'),
          '409': failure('Only failed replies can be retried (MESSAGE_NOT_RETRYABLE)'),
        },
      },
    },
    '/media/{messageId}': {
      get: {
        summary: 'Download Message Media',
        description:
          'Streams inbound media from the provider. The URL comes from the Message DTO and is signed and short-lived.',
        operationId: 'downloadMessageMedia',
        security: [],
        parameters: [
          pathParam('messageId', 'Message identifier'),
          { name: 'exp', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'sig', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Media content',
            content: { '*/*': { schema: { type: 'string', format: 'binary' } } },
          },
          '403': failure('Missing, invalid or expired signature'),
          '404': failure('Message or media not found, or expired at the provider'),
          '502': failure('The provider could not deliver the file right now'),
        },
      },
    },
    '/webchat/{widgetKey}/widget.js': {
      get: {
        summary: 'Web Live Chat Widget Script',
        operationId: 'getWebchatWidgetScript',
        security: [],
        parameters: [pathParam('widgetKey', 'Web chat channel key')],
        responses: {
          '200': {
            description: 'Widget script',
            content: { 'application/javascript': { schema: { type: 'string' } } },
          },
          '404': { description: 'Unknown or deleted widget' },
        },
      },
    },
    '/webchat/{widgetKey}/config': {
      get: {
        summary: 'Web Live Chat Widget Settings',
        operationId: 'getWebchatConfig',
        security: [],
        parameters: [pathParam('widgetKey', 'Web chat channel key')],
        responses: {
          '200': success('Widget settings', {
            type: 'object',
            properties: {
              name: { type: 'string' },
              welcomeMessage: { type: ['string', 'null'] },
              accentColor: { type: 'string' },
            },
          }),
          '404': failure('Unknown or deleted widget (WIDGET_NOT_FOUND)'),
        },
      },
    },
    '/webchat/{widgetKey}/sessions': {
      post: {
        summary: 'Start or Resume a Visitor Session',
        operationId: 'createWebchatSession',
        security: [],
        parameters: [pathParam('widgetKey', 'Web chat channel key')],
        requestBody: jsonBody('WebchatSessionRequest'),
        responses: {
          '200': success('Visitor session', {
            type: 'object',
            properties: { visitorId: { type: 'string' }, visitorToken: { type: 'string' } },
          }),
          '404': failure('Unknown or deleted widget (WIDGET_NOT_FOUND)'),
          '429': failure('Too many sessions from this address (RATE_LIMITED)'),
        },
      },
    },
    '/webchat/{widgetKey}/messages': {
      post: {
        summary: 'Send a Visitor Message',
        operationId: 'sendWebchatMessage',
        security: [],
        parameters: [
          pathParam('widgetKey', 'Web chat channel key'),
          { name: 'x-visitor-token', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: jsonBody('WebchatMessageRequest'),
        responses: {
          '202': success('Message accepted', {
            type: 'object',
            properties: { accepted: { type: 'boolean' } },
          }),
          '401': failure('Invalid visitor token (VISITOR_TOKEN_INVALID)'),
          '404': failure('Unknown or deleted widget (WIDGET_NOT_FOUND)'),
          '429': failure('Too many messages from this address (RATE_LIMITED)'),
        },
      },
      get: {
        summary: 'Fetch the Visitor Conversation',
        operationId: 'listWebchatMessages',
        security: [],
        parameters: [
          pathParam('widgetKey', 'Web chat channel key'),
          { name: 'visitorId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'after', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'x-visitor-token', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': success('Messages', {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                direction: { type: 'string', enum: ['INBOUND', 'OUTBOUND'] },
                text: { type: 'string' },
                senderName: { type: ['string', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          }),
          '401': failure('Invalid visitor token (VISITOR_TOKEN_INVALID)'),
          '404': failure('Unknown or deleted widget (WIDGET_NOT_FOUND)'),
        },
      },
    },
  };
}
