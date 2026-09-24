import assert from 'node:assert/strict';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';
import { ERROR_CATALOG } from './openapi/error-catalog.js';
import { buildOpenApiDocument } from './openapi/openapi.document.js';
import {
  createRealtimeEvent,
  REALTIME_SCHEMA_VERSION,
  type AttachmentMetadata,
} from '@vynor/contracts';
import { authorizeSignedDownload, createStorageClient } from '@vynor/storage';
import { z } from 'zod';

console.info('--- Verifying VYNOR Backend Core (Section 6.2) ---');

// Test 1: Verify OpenAPI document and error catalog (FND-BE-010)
console.info('1. Checking OpenAPI document and error catalog...');
const doc = buildOpenApiDocument() as Record<string, unknown>;
assert.equal(doc.openapi, '3.1.0', 'OpenAPI version should be 3.1.0');
const paths = doc.paths as Record<string, unknown>;
assert.ok(paths['/health/live'], 'Missing /health/live path');
assert.ok(paths['/health/ready'], 'Missing /health/ready path');
assert.ok(paths['/attachments/{id}/download-url'], 'Missing /attachments/{id}/download-url path');
assert.ok(paths['/openapi.json'], 'Missing /openapi.json path');
assert.ok(paths['/error-catalog'], 'Missing /error-catalog path');

assert.ok(ERROR_CATALOG.length >= 10, 'Error catalog should contain at least 10 canonical errors');
const requiredCodes = [
  'AUTH_TOKEN_MISSING',
  'PERMISSION_DENIED',
  'VALIDATION_FAILED',
  'ATTACHMENT_NOT_FOUND',
  'ATTACHMENT_NOT_CLEAN',
  'ATTACHMENT_QUARANTINED',
];
for (const code of requiredCodes) {
  assert.ok(
    ERROR_CATALOG.some((e) => e.code === code),
    `Error catalog missing code: ${code}`,
  );
}
console.info('   ✓ OpenAPI document and error catalog verified.');

// Test 2: Verify ZodValidationPipe (FND-BE-001)
console.info('2. Checking ZodValidationPipe behavior...');
const testSchema = z.object({
  name: z.string().min(2),
  count: z.number().int().positive(),
});
const pipe = new ZodValidationPipe(testSchema);
const validResult = pipe.transform({ name: 'Alice', count: 5 }, { type: 'body' });
assert.deepEqual(validResult, { name: 'Alice', count: 5 });

let validationThrew = false;
try {
  pipe.transform({ name: 'A', count: -1 }, { type: 'body' });
} catch {
  validationThrew = true;
}
assert.ok(validationThrew, 'ZodValidationPipe should throw on invalid input');
console.info('   ✓ ZodValidationPipe global & schema validation verified.');

// Test 3: Verify RustFS/S3 adapter and signed download authorization (FND-BE-008)
console.info('3. Checking RustFS/S3 adapter and signed download authorization...');
const storageClient = createStorageClient({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'test_access_key',
  secretAccessKey: 'test_secret_key',
  defaultBucket: 'vynor-crm-attachments',
});

// A. Clean attachment in PRIVATE storage zone
const cleanAttachment: AttachmentMetadata = {
  id: 'att_01clean',
  workspaceId: 'ws_test_01',
  purpose: 'MESSAGE_INBOUND',
  storageZone: 'PRIVATE',
  storageBucket: 'vynor-crm-attachments',
  objectKey: 'workspaces/ws_test_01/message-inbound/2026/09/24/att_01clean',
  originalFilename: 'report.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1024,
  checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  scanStatus: 'CLEAN',
  scanEngine: 'clamav',
  scanResult: { status: 'clean' },
  scannedAt: new Date().toISOString(),
  retentionDays: 365,
  purgeAfter: null,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const cleanAuth = authorizeSignedDownload({
  actorWorkspaceId: 'ws_test_01',
  actorPermissions: ['message:read'],
  attachment: cleanAttachment,
  requestedTtlSeconds: 120,
});
assert.ok(cleanAuth.authorized, 'Clean attachment should be authorized for download');
if (cleanAuth.authorized) {
  assert.equal(cleanAuth.expiresInSeconds, 120);
}

const signed = await storageClient.createSignedDownload({
  location: { bucket: cleanAttachment.storageBucket, key: cleanAttachment.objectKey },
  expiresInSeconds: 120,
  downloadFilename: cleanAttachment.originalFilename,
});
assert.ok(signed.url.includes('X-Amz-Signature='), 'Presigned URL must contain SigV4 signature');
assert.ok(
  signed.url.includes('response-content-disposition='),
  'Presigned URL must contain content disposition',
);

// B. Quarantined attachment must be rejected (fail-closed)
const quarantinedAttachment: AttachmentMetadata = {
  ...cleanAttachment,
  id: 'att_02quarantine',
  storageZone: 'QUARANTINE',
  scanStatus: 'PENDING',
};
const quarantinedAuth = authorizeSignedDownload({
  actorWorkspaceId: 'ws_test_01',
  actorPermissions: ['message:read'],
  attachment: quarantinedAttachment,
});
assert.equal(quarantinedAuth.authorized, false);
if (!quarantinedAuth.authorized) {
  assert.equal(quarantinedAuth.reason, 'ATTACHMENT_NOT_PRIVATE');
}

// C. Infected attachment must be rejected
const infectedAttachment: AttachmentMetadata = {
  ...cleanAttachment,
  id: 'att_03infected',
  storageZone: 'PRIVATE',
  scanStatus: 'INFECTED',
};
const infectedAuth = authorizeSignedDownload({
  actorWorkspaceId: 'ws_test_01',
  actorPermissions: ['message:read'],
  attachment: infectedAttachment,
});
assert.equal(infectedAuth.authorized, false);
if (!infectedAuth.authorized) {
  assert.equal(infectedAuth.reason, 'ATTACHMENT_NOT_CLEAN');
}

// D. Missing permission must be rejected
const unauthorizedActor = authorizeSignedDownload({
  actorWorkspaceId: 'ws_test_01',
  actorPermissions: ['contact:read'], // missing message:read
  attachment: cleanAttachment,
});
assert.equal(unauthorizedActor.authorized, false);
if (!unauthorizedActor.authorized) {
  assert.equal(unauthorizedActor.reason, 'PERMISSION_DENIED');
}
console.info('   ✓ RustFS/S3 adapter and fail-closed authorization verified.');

// Test 4: Verify Realtime Event Envelope & Room conventions (FND-BE-009)
console.info('4. Checking Realtime event contracts and publisher boundaries...');
const event = createRealtimeEvent({
  eventId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  eventType: 'conversation.message-created',
  workspaceId: 'ws_test_01',
  rooms: ['workspace:ws_test_01', 'conversation:conv_123'],
  occurredAt: new Date().toISOString(),
  correlationId: 'req_test_correlation',
  payload: {
    messageId: 'msg_999',
    conversationId: 'conv_123',
  },
});
assert.equal(event.schemaVersion, REALTIME_SCHEMA_VERSION);
assert.equal(event.eventType, 'conversation.message-created');
assert.equal(event.workspaceId, 'ws_test_01');
assert.equal(event.rooms.length, 2);
console.info('   ✓ Realtime event contracts and rooms verified.');

console.info('--- ALL Section 6.2 Backend Core Verifications PASSED! ---');
