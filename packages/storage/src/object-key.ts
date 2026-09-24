import type { AttachmentPurpose } from '@vynor/contracts';

const KEY_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

export const ATTACHMENT_PURPOSE_SEGMENTS = {
  MESSAGE_INBOUND: 'message-inbound',
  MESSAGE_OUTBOUND: 'message-outbound',
  KNOWLEDGE_SOURCE: 'knowledge-source',
  BULK_IMPORT: 'bulk-import',
  REPORT_EXPORT: 'report-export',
  AVATAR: 'avatar',
  AUTOMATION_ARTIFACT: 'automation-artifact',
} as const satisfies Record<AttachmentPurpose, string>;

const PURPOSE_BY_SEGMENT = new Map<string, AttachmentPurpose>(
  Object.entries(ATTACHMENT_PURPOSE_SEGMENTS).map(([purpose, segment]) => [
    segment,
    purpose as AttachmentPurpose,
  ]),
);

export interface BuildObjectKeyInput {
  readonly workspaceId: string;
  readonly purpose: AttachmentPurpose;
  readonly createdAt: Date;
  readonly opaqueObjectId: string;
}

export interface ParsedObjectKey {
  readonly workspaceId: string;
  readonly purpose: AttachmentPurpose;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly opaqueObjectId: string;
}

function assertOpaqueSegment(name: string, value: string): void {
  if (!KEY_SEGMENT_PATTERN.test(value)) {
    throw new Error(
      `${name} must be opaque and contain only letters, numbers, underscores, or hyphens`,
    );
  }
}

/**
 * Builds a filename-free key that cannot leak customer-provided names:
 * workspaces/{workspaceId}/{purpose}/{yyyy}/{mm}/{dd}/{opaqueObjectId}
 */
export function buildObjectKey(input: BuildObjectKeyInput): string {
  assertOpaqueSegment('workspaceId', input.workspaceId);
  assertOpaqueSegment('opaqueObjectId', input.opaqueObjectId);

  if (Number.isNaN(input.createdAt.getTime())) {
    throw new Error('createdAt must be a valid date');
  }

  const year = String(input.createdAt.getUTCFullYear()).padStart(4, '0');
  const month = String(input.createdAt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(input.createdAt.getUTCDate()).padStart(2, '0');
  const purpose = ATTACHMENT_PURPOSE_SEGMENTS[input.purpose];

  return `workspaces/${input.workspaceId}/${purpose}/${year}/${month}/${day}/${input.opaqueObjectId}`;
}

export function parseObjectKey(key: string): ParsedObjectKey {
  const segments = key.split('/');
  if (segments.length !== 7 || segments[0] !== 'workspaces') {
    throw new Error('Object key does not match the VYNOR storage convention');
  }

  const [, workspaceId, purposeSegment, yearSegment, monthSegment, daySegment, opaqueObjectId] =
    segments;

  if (
    workspaceId === undefined ||
    purposeSegment === undefined ||
    yearSegment === undefined ||
    monthSegment === undefined ||
    daySegment === undefined ||
    opaqueObjectId === undefined
  ) {
    throw new Error('Object key is missing required segments');
  }

  assertOpaqueSegment('workspaceId', workspaceId);
  assertOpaqueSegment('opaqueObjectId', opaqueObjectId);

  const purpose = PURPOSE_BY_SEGMENT.get(purposeSegment);
  if (!purpose) {
    throw new Error('Object key contains an unsupported purpose');
  }

  const year = Number(yearSegment);
  const month = Number(monthSegment);
  const day = Number(daySegment);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    !/^\d{4}$/.test(yearSegment) ||
    !/^\d{2}$/.test(monthSegment) ||
    !/^\d{2}$/.test(daySegment) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Object key contains an invalid UTC date partition');
  }

  return { workspaceId, purpose, year, month, day, opaqueObjectId };
}
