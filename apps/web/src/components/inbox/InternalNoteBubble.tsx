'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import type { MessageRecord } from './types';

interface InternalNoteBubbleProps {
  message: MessageRecord;
}

export function InternalNoteBubble({ message }: InternalNoteBubbleProps) {
  return (
    <div className="w-full my-2">
      <div className="rounded-xs border border-amber-500/30 bg-amber-500/10 p-3 text-xs shadow-2xs select-none">
        {/* Note Header */}
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5 mb-1.5 text-amber-800 dark:text-amber-300 font-medium">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-[11px] tracking-wide uppercase">
              Internal Note (Visible to team only)
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">
            <span>By {message.senderName}</span>
            <span>•</span>
            <span className="font-mono">{message.createdAt}</span>
          </div>
        </div>

        {/* Note Content */}
        <div className="text-amber-950 dark:text-amber-100 whitespace-pre-wrap leading-relaxed select-text font-normal">
          {message.content}
        </div>
      </div>
    </div>
  );
}
