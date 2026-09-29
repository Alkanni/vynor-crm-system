'use client';

import React from 'react';
import { FileText, Image as ImageIcon, X } from 'lucide-react';
import type { MessageAttachment } from './types';

interface AttachmentStagingAreaProps {
  attachments: MessageAttachment[];
  onRemove: (id: string) => void;
}

/** Staged uploads above the editor (VYNOR `ReplyBox` attachment preview chips). */
export function AttachmentStagingArea({ attachments, onRemove }: AttachmentStagingAreaProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pb-2">
      {attachments.map((att) => {
        const Icon = att.type.startsWith('image/') ? ImageIcon : FileText;

        return (
          <div
            key={att.id}
            className="flex h-8 select-none items-center gap-1.5 rounded-lg bg-n-alpha-2 pl-2 pr-1 text-xs text-n-slate-12"
          >
            <Icon className="size-3.5 shrink-0 text-n-slate-11" />
            <span className="max-w-36 truncate font-medium">{att.name}</span>
            <span className="text-n-slate-10">{att.size}</span>
            <button
              type="button"
              onClick={() => onRemove(att.id)}
              aria-label={`Remove attachment ${att.name}`}
              className="grid size-6 place-content-center rounded-md text-n-slate-11 hover:bg-n-alpha-2 hover:text-n-slate-12"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
