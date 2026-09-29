'use client';

import React from 'react';
import type { MessageRecord } from './types';
import { MessageBubble } from './MessageBubble';

interface InternalNoteBubbleProps {
  message: MessageRecord;
  groupWithNext?: boolean | undefined;
  groupWithPrevious?: boolean | undefined;
}

/**
 * Private note (visible to team only) — VYNOR `MESSAGE_VARIANTS.PRIVATE`:
 * right-aligned `bg-n-solid-amber text-n-amber-12` bubble with a lock icon in the meta.
 */
export function InternalNoteBubble({
  message,
  groupWithNext,
  groupWithPrevious,
}: InternalNoteBubbleProps) {
  return (
    <MessageBubble
      message={{ ...message, senderType: 'INTERNAL_NOTE' }}
      groupWithNext={groupWithNext}
      groupWithPrevious={groupWithPrevious}
    />
  );
}
