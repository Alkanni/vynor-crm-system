'use client';

import React from 'react';
import { X, FileText, Image as ImageIcon } from 'lucide-react';
import type { MessageAttachment } from './types';

interface AttachmentStagingAreaProps {
  attachments: MessageAttachment[];
  onRemove: (id: string) => void;
}

export function AttachmentStagingArea({ attachments, onRemove }: AttachmentStagingAreaProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border-t border-border/40 bg-surface">
      {attachments.map((att) => {
        const isImage = att.type.startsWith('image/');
        const Icon = isImage ? ImageIcon : FileText;

        return (
          <div
            key={att.id}
            className="flex items-center gap-1.5 rounded-xs border border-border bg-card px-2 py-1 text-xs shadow-2xs select-none"
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="max-w-[140px] truncate text-[11px] font-medium text-foreground">
              {att.name}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">({att.size})</span>
            <button
              type="button"
              onClick={() => onRemove(att.id)}
              aria-label={`Remove attachment ${att.name}`}
              className="ml-0.5 rounded-xs p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
