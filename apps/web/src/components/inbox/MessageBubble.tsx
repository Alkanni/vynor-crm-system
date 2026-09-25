'use client';

import React from 'react';
import { Check, CheckCheck, Bot, AlertCircle, RefreshCw, Paperclip } from 'lucide-react';
import type { MessageRecord } from './types';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: MessageRecord;
  onRetry?: ((messageId: string) => void) | undefined;
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isCustomer = message.senderType === 'CUSTOMER';
  const isAi = message.senderType === 'AI';
  const isFailed = message.deliveryStatus === 'FAILED';

  // Delivery status tick icons
  const renderDeliveryIcon = () => {
    switch (message.deliveryStatus) {
      case 'QUEUED':
        return <span className="text-[10px] text-muted-foreground font-mono">queued</span>;
      case 'SENT':
        return (
          <span title="Sent to provider">
            <Check className="h-3 w-3 text-muted-foreground" />
          </span>
        );
      case 'DELIVERED':
        return (
          <span title="Delivered to device">
            <CheckCheck className="h-3 w-3 text-muted-foreground" />
          </span>
        );
      case 'READ':
        return (
          <span title="Read by customer">
            <CheckCheck className="h-3 w-3 text-sky-500" />
          </span>
        );
      case 'FAILED':
        return (
          <span title="Delivery failed">
            <AlertCircle className="h-3 w-3 text-rose-500" />
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn('flex w-full flex-col gap-1', isCustomer ? 'items-start' : 'items-end')}>
      {/* Sender Header info */}
      <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground select-none">
        {isAi && (
          <span className="inline-flex items-center gap-1 rounded-xs border border-border bg-muted/60 px-1 py-0.2 text-[10px] font-semibold text-foreground">
            <Bot className="h-3 w-3 text-sky-500" />
            <span>AI Assistant</span>
          </span>
        )}
        <span className="font-medium text-foreground">{message.senderName}</span>
        <span>•</span>
        <span className="font-mono">{message.createdAt}</span>
      </div>

      {/* Bubble Container */}
      <div
        className={cn(
          'relative max-w-lg rounded-sm px-3.5 py-2 text-xs leading-relaxed shadow-2xs',
          isCustomer
            ? 'bg-card text-foreground border border-border/80'
            : isAi
              ? 'bg-surface text-foreground border border-border/90'
              : 'bg-primary/10 text-foreground border border-primary/20',
          isFailed && 'border-rose-500/80 bg-rose-500/5',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        {/* Attachments preview */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 border-t border-border/50 pt-1.5">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 rounded-xs border border-border bg-background/50 px-2 py-1 text-[11px]"
              >
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="truncate font-medium">{att.name}</span>
                <span className="text-muted-foreground">({att.size})</span>
              </div>
            ))}
          </div>
        )}

        {/* Failure Message & Actionable Retry */}
        {isFailed && (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-rose-500/30 pt-1.5 text-[11px] text-rose-700 dark:text-rose-400">
            <span className="truncate">
              {message.errorMessage || 'Failed to deliver: Provider connection error'}
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400 hover:underline shrink-0"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        {/* Delivery Tick on Outbound Messages */}
        {!isCustomer && !isFailed && (
          <div className="mt-1 flex justify-end items-center gap-1 text-[10px]">
            {renderDeliveryIcon()}
          </div>
        )}
      </div>
    </div>
  );
}
