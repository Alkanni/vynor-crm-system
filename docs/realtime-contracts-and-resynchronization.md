# Realtime Contracts and REST Resynchronization

This document defines the Socket.IO boundary for FND-076 through FND-078. Realtime delivery is an
ephemeral optimization. PostgreSQL-backed REST resources remain the only authoritative client
state.

## Authentication handshake

The Socket.IO client sends `RealtimeHandshakeAuth` in `socket.handshake.auth`:

```json
{
  "accessToken": "<Supabase access token>",
  "workspaceId": "ws_...",
  "clientVersion": "web/0.1.0",
  "lastSeenEventId": "optional UUID"
}
```

Server requirements:

1. Reject connections without a token or requested workspace.
2. Verify the token through the same Supabase/JWKS verifier used by HTTP.
3. Resolve an active internal user, workspace membership, teams, roles, and permissions.
4. Verify the token identity may enter the requested workspace.
5. Build `RealtimeSocketContext` server-side and attach it to socket data.
6. Never accept actor IDs, roles, permissions, or room names from the client as authority.
7. Never retain the access token in socket context, logs, rooms, events, or error details.
8. Re-evaluate authorization on sensitive room joins; disconnect or evict the socket when
   membership becomes inactive.

Authentication failure uses a stable `RealtimeAuthErrorCode`. Client-visible messages remain safe
and do not disclose whether another workspace or conversation exists.

## Room naming and authorization

Canonical rooms are:

```text
workspace:{workspaceId}
conversation:{conversationId}
```

`workspaceRoomName` and `conversationRoomName` are the only helpers allowed to construct these
names. IDs are validated and cannot contain `:`, `/`, whitespace, or traversal characters.

- Join the workspace room only after the active membership check.
- Join a conversation room only after confirming the conversation belongs to the same workspace
  and the actor has `conversation:read` under the applicable team/assignment policy.
- A client cannot request arbitrary Socket.IO rooms directly.
- Disconnect removes all ephemeral room membership; reconnect repeats authorization.

## Event envelope

All server events use `RealtimeEventEnvelope`:

- `schemaVersion`: currently `1`;
- `eventId`: UUID used for diagnostics and client duplicate suppression, not durable replay;
- `eventType`: lowercase dotted name such as `conversation.message-created`;
- `workspaceId` and one or more canonical target rooms;
- `occurredAt` and `emittedAt` ISO timestamps;
- correlation and optional causation IDs;
- optional monotonic resource version; and
- a JSON payload containing only the minimum data needed to identify/refetch the resource.

Room targets must be unique. Events are published only after the database transaction commits.
Sensitive provider payloads, access tokens, signed URLs, credentials, and unnecessary customer
content are forbidden in the envelope.

Event contracts are additive within a schema version. Removing/renaming a field, changing meaning,
or altering an event type requires a new schema version and a compatibility window.

## Delivery semantics

Socket.IO events are best-effort and may be lost, duplicated, delayed, or observed out of order.
They are not a durable event stream and do not acknowledge a business transaction. Clients use:

- `eventId` for short-lived duplicate suppression;
- `resourceVersion`, when present, to ignore a stale event; and
- REST query invalidation/refetch to obtain authoritative state.

Never derive final message delivery, assignment, unread count, or campaign status solely from
received socket events.

## Reconnect and REST resynchronization

On initial connection and every reconnect:

1. Authenticate again and rebuild server-owned socket context.
2. Re-authorize workspace/conversation room membership.
3. Server emits a `RealtimeResyncInstruction` with reason and affected resources.
4. Client invalidates the corresponding TanStack Query keys.
5. Client fetches authoritative REST list/detail/message state using cursor pagination.
6. Buffer newly received hints while the refetch is in flight, then apply only events newer than
   the fetched resource version.
7. If a gap or stale version is detected later, repeat the same resynchronization flow.

The server does not promise replay from `lastSeenEventId`. That value is diagnostic and may help
detect a gap. Durable replay, if ever required, must use a separate persisted event/read-model
design rather than an in-memory Socket.IO buffer.

## Scaling boundary

Phase 0 assumes a single API instance. Redis is not a dependency. Before adding multiple Socket.IO
instances, record an ADR selecting a room/fan-out adapter and prove ordering, duplicate handling,
connection affinity, deployment drain behavior, and database connection impact. REST recovery rules
remain mandatory regardless of the fan-out mechanism.
