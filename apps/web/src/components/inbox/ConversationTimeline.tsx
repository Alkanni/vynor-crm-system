'use client';

import React, { useEffect, useRef } from 'react';
import type { MessageRecord } from './types';
import { MessageBubble, messageVariant } from './MessageBubble';

interface ConversationTimelineProps {
  messages: MessageRecord[];
  onRetryMessage?: ((messageId: string) => void) | undefined;
}

function sameSender(a: MessageRecord | undefined, b: MessageRecord | undefined): boolean {
  if (!a || !b) return false;
  const variantA = messageVariant(a);
  if (variantA === 'activity') return false;
  return variantA === messageVariant(b) && a.senderName === b.senderName;
}

/** Message list — VYNOR `message/MessageList.vue` inside the `bg-n-surface-1` conversation pane. */
export function ConversationTimeline({ messages, onRetryMessage }: ConversationTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  return (
    <div
      role="log"
      aria-label="Conversation messages"
      aria-live="polite"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4"
    >
      <div className="mb-4 flex justify-center">
        <span className="rounded-xl bg-n-alpha-1 px-3 py-1 text-xs font-medium text-n-slate-11">
          Today
        </span>
      </div>

      {messages.map((msg, index) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onRetry={onRetryMessage}
          groupWithNext={sameSender(msg, messages[index + 1])}
          groupWithPrevious={sameSender(messages[index - 1], msg)}
        />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
