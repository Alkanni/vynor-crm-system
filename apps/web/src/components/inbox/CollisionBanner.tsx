'use client';

import React from 'react';
import { Eye, PenLine } from 'lucide-react';
import { Banner } from '@/components/ui';

interface CollisionBannerProps {
  viewingAgentName?: string | null | undefined;
  typingAgentName?: string | null | undefined;
}

/** Realtime Collision Shield — shown on top of the messages as a VYNOR amber `Banner`. */
export function CollisionBanner({ viewingAgentName, typingAgentName }: CollisionBannerProps) {
  if (!viewingAgentName && !typingAgentName) return null;

  return (
    <div className="shrink-0 px-3 pt-3">
      <Banner
        color="amber"
        role="status"
        icon={
          typingAgentName ? (
            <PenLine className="size-4 animate-loader-pulse" />
          ) : (
            <Eye className="size-4" />
          )
        }
        className="animate-in fade-in duration-200"
      >
        {typingAgentName ? (
          <span>
            <strong className="font-medium">{typingAgentName}</strong> is typing a reply…
          </span>
        ) : (
          <span>
            <strong className="font-medium">{viewingAgentName}</strong> is also viewing this
            conversation · Collision Shield
          </span>
        )}
      </Banner>
    </div>
  );
}
