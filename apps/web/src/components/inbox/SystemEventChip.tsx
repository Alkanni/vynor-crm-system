'use client';

import React from 'react';
import type { MessageRecord } from './types';
import { ActivityBubble } from './MessageBubble';

interface SystemEventChipProps {
  message: MessageRecord;
}

/** System/activity event — VYNOR `bubbles/Activity.vue` (`bg-n-alpha-1 rounded-xl px-3 py-1`). */
export function SystemEventChip({ message }: SystemEventChipProps) {
  return <ActivityBubble content={message.content} time={message.createdAt} />;
}
