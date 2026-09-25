'use client';

import React from 'react';
import { Eye, Edit3 } from 'lucide-react';

interface CollisionBannerProps {
  viewingAgentName?: string | null;
  typingAgentName?: string | null;
}

export function CollisionBanner({ viewingAgentName, typingAgentName }: CollisionBannerProps) {
  if (!viewingAgentName && !typingAgentName) return null;

  return (
    <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between animate-in fade-in select-none">
      <div className="flex items-center gap-2">
        {typingAgentName ? (
          <>
            <Edit3 className="h-3.5 w-3.5 animate-pulse text-amber-600" />
            <span className="font-medium">
              <strong className="font-semibold">{typingAgentName}</strong> is typing a reply...
            </span>
          </>
        ) : (
          <>
            <Eye className="h-3.5 w-3.5 text-amber-600" />
            <span>
              Agent <strong className="font-semibold">{viewingAgentName}</strong> is currently
              viewing this conversation.
            </span>
          </>
        )}
      </div>

      <span className="text-[10px] text-amber-700/80 font-mono">Realtime Collision Shield</span>
    </div>
  );
}
