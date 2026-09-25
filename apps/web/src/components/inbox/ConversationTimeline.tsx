'use client';

import React, { useEffect, useRef } from 'react';
import type { MessageRecord } from './types';
import { MessageBubble } from './MessageBubble';
import { InternalNoteBubble } from './InternalNoteBubble';
import { SystemEventChip } from './SystemEventChip';

interface ConversationTimelineProps {
  messages: MessageRecord[];
  onRetryMessage?: ((messageId: string) => void) | undefined;
}

export function ConversationTimeline({ messages, onRetryMessage }: ConversationTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50">
      {/* Date Header Marker */}
      <div className="flex items-center justify-center my-3 select-none">
        <span className="rounded-full border border-border/70 bg-card px-3 py-0.5 font-mono text-[10px] text-muted-foreground">
          Today, September 25, 2026
        </span>
      </div>

      {/* Message Stream */}
      {messages.map((msg) => {
        if (msg.senderType === 'INTERNAL_NOTE') {
          return <InternalNoteBubble key={msg.id} message={msg} />;
        }
        if (msg.senderType === 'SYSTEM') {
          return <SystemEventChip key={msg.id} message={msg} />;
        }
        return <MessageBubble key={msg.id} message={msg} onRetry={onRetryMessage} />;
      })}

      <div ref={bottomRef} />
    </div>
  );
}
