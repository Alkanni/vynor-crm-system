'use client';

import React from 'react';
import { Info } from 'lucide-react';
import type { MessageRecord } from './types';

interface SystemEventChipProps {
  message: MessageRecord;
}

export function SystemEventChip({ message }: SystemEventChipProps) {
  return (
    <div className="flex w-full items-center justify-center my-2 select-none">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
        <Info className="h-3 w-3 text-sky-500" />
        <span>{message.content}</span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          ({message.createdAt})
        </span>
      </div>
    </div>
  );
}
