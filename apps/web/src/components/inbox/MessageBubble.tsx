'use client';

import React from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCheck,
  Clock3,
  LockKeyhole,
  Paperclip,
  RefreshCcw,
} from 'lucide-react';
import type { MessageAttachment, MessageRecord } from './types';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';

export type MessageVariant = 'user' | 'agent' | 'bot' | 'private' | 'error' | 'activity';

/** Bubble colors from VYNOR `components-next/message/bubbles/Base.vue`. */
const VARIANT_CLASSES: Record<Exclude<MessageVariant, 'activity'>, string> = {
  agent: 'bg-n-solid-blue text-n-slate-12',
  private: 'bg-n-solid-amber text-n-amber-12',
  user: 'bg-n-slate-4 text-n-slate-12',
  bot: 'bg-n-solid-iris text-n-slate-12',
  error: 'bg-n-ruby-4 text-n-ruby-12',
};

export function messageVariant(message: MessageRecord): MessageVariant {
  switch (message.senderType) {
    case 'SYSTEM':
      return 'activity';
    case 'INTERNAL_NOTE':
      return 'private';
    case 'AI':
      return 'bot';
    case 'CUSTOMER':
      return 'user';
    default:
      return message.deliveryStatus === 'FAILED' ? 'error' : 'agent';
  }
}

/** Port of VYNOR `message/MessageStatus.vue`. */
function MessageStatus({ status }: { status: MessageRecord['deliveryStatus'] }) {
  switch (status) {
    case 'QUEUED':
      return <Clock3 className="size-3.5 text-n-slate-10" aria-label="Sending" />;
    case 'SENT':
      return <Check className="size-3.5 text-n-slate-10" aria-label="Sent" />;
    case 'DELIVERED':
      return <CheckCheck className="size-3.5 text-n-slate-10" aria-label="Delivered" />;
    case 'READ':
      return <CheckCheck className="size-3.5 text-[#7EB6FF]" aria-label="Read" />;
    default:
      return null;
  }
}

/** Port of VYNOR `message/MessageError.vue`. */
function MessageError({ error, onRetry }: { error: string; onRetry?: (() => void) | undefined }) {
  return (
    <div className="flex items-center justify-end gap-1.5 text-xs text-n-ruby-11">
      <span>Failed to send</span>
      <span className="group relative">
        <span
          tabIndex={0}
          aria-label={error}
          className="grid size-5 cursor-pointer place-content-center rounded-md bg-n-alpha-2"
        >
          <AlertTriangle className="size-3.5 text-n-ruby-11" />
        </span>
        <span className="invisible absolute bottom-6 right-0 z-10 w-52 break-words rounded-xl border border-n-strong bg-n-alpha-3 px-4 py-3 text-xs text-n-slate-12 opacity-0 shadow-[0px_0px_24px_0px_rgba(0,0,0,0.12)] backdrop-blur-[100px] transition-all group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
          {error}
        </span>
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry"
          title="Retry"
          className="grid size-5 cursor-pointer place-content-center rounded-md bg-n-alpha-2"
        >
          <RefreshCcw className="size-3.5 text-n-ruby-11" />
        </button>
      )}
    </div>
  );
}

/**
 * Inbound media: images, audio and video play inline from the short-lived signed URL; other
 * files open or download. Files without a URL (e.g. email attachments) are listed only.
 */
function AttachmentView({ attachment }: { attachment: MessageAttachment }) {
  const { url, type, name, size } = attachment;
  if (url && type.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer noopener" className="block max-w-full">
        {/* Plain <img>: the signed, short-lived API URL must not go through image optimisation. */}
        <img
          src={url}
          alt={name}
          loading="lazy"
          className="max-h-72 max-w-full rounded-lg object-contain"
        />
      </a>
    );
  }
  if (url && type.startsWith('audio/')) {
    return <audio controls preload="none" src={url} className="max-w-full" aria-label={name} />;
  }
  if (url && type.startsWith('video/')) {
    return (
      <video controls preload="metadata" src={url} className="max-h-72 max-w-full rounded-lg" />
    );
  }
  const chip = (
    <>
      <Paperclip className="size-3.5 shrink-0" />
      <span className="truncate font-medium">{name}</span>
      {size && <span className="shrink-0 opacity-70">{size}</span>}
    </>
  );
  const chipClass =
    'inline-flex max-w-full items-center gap-1.5 rounded-lg bg-n-alpha-black1 px-2 py-1 text-xs';
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(chipClass, 'hover:underline')}
    >
      {chip}
    </a>
  ) : (
    <span className={chipClass} title="Open the original message to download this file">
      {chip}
    </span>
  );
}

/** Port of VYNOR `message/bubbles/Activity.vue`. */
export function ActivityBubble({ content, time }: { content: string; time?: string | undefined }) {
  return (
    <div className="mb-2 flex w-full justify-center">
      <div
        title={time}
        className="flex min-w-0 items-center gap-2 rounded-xl bg-n-alpha-1 px-3 py-1 text-sm text-n-slate-11"
      >
        <span className="truncate" title={content}>
          {content}
        </span>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: MessageRecord;
  onRetry?: ((messageId: string) => void) | undefined;
  /** The next message comes from the same sender (VYNOR `group-with-next`). */
  groupWithNext?: boolean | undefined;
  /** The previous message came from the same sender (tightens the top corner). */
  groupWithPrevious?: boolean | undefined;
}

/**
 * Message row — port of VYNOR `message/Message.vue` + `bubbles/Base.vue` +
 * `bubbles/Text/Index.vue`: incoming messages sit on the left without an
 * avatar, outgoing ones on the right with a 24px avatar; bubbles are
 * `px-4 py-3 rounded-xl` with the corner next to the sender tightened.
 */
export function MessageBubble({
  message,
  onRetry,
  groupWithNext = false,
  groupWithPrevious = false,
}: MessageBubbleProps) {
  const variant = messageVariant(message);

  if (variant === 'activity') {
    return <ActivityBubble content={message.content} time={message.createdAt} />;
  }

  const isRight = variant !== 'user';
  const isFailed = message.deliveryStatus === 'FAILED';
  const metaColor = variant === 'private' ? 'text-n-amber-12/50' : 'text-n-slate-11';

  return (
    <div
      className={cn(
        'flex w-full',
        groupWithNext ? 'mb-1' : 'mb-2',
        isRight ? 'justify-end' : 'justify-start',
      )}
      data-message-id={message.id}
    >
      <div
        className={cn(
          'grid gap-x-2',
          isRight ? 'grid-cols-[1fr_24px]' : 'grid-cols-1',
          isFailed && 'gap-y-2',
        )}
        style={{
          gridTemplateAreas: isRight ? '"bubble avatar" "meta spacer"' : '"bubble" "meta"',
        }}
      >
        {isRight && !groupWithNext && (
          <div className="flex items-end [grid-area:avatar]">
            <Avatar
              name={message.senderName}
              size={24}
              roundedFull
              icon={variant === 'bot' ? Bot : undefined}
              title={message.senderName}
            />
          </div>
        )}

        <div
          className={cn('flex min-w-0 [grid-area:bubble]', isRight ? 'ml-8 justify-end' : 'mr-8')}
        >
          <div
            data-bubble-name="text"
            className={cn(
              'min-w-0 max-w-lg rounded-xl px-4 py-3 text-sm',
              VARIANT_CLASSES[variant],
              isRight ? 'rounded-br-xs' : 'rounded-bl-xs',
              groupWithPrevious && (isRight ? 'rounded-tr-xs' : 'rounded-tl-xs'),
            )}
          >
            <div className="flex flex-col gap-3">
              {message.content && (
                <p className="mb-0 whitespace-pre-wrap break-words leading-[1.6]">
                  {message.content}
                </p>
              )}
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {message.attachments.map((att) => (
                    <AttachmentView key={att.id} attachment={att} />
                  ))}
                </div>
              )}
            </div>

            <div
              className={cn(
                'mt-2 flex items-center gap-1.5 text-xs',
                metaColor,
                isRight ? 'justify-end' : 'justify-start',
              )}
            >
              {variant === 'bot' && (
                <span className="inline-flex items-center gap-1 font-medium">
                  <Bot className="size-3" />
                  AI Assistant
                </span>
              )}
              {variant === 'private' && <span className="font-medium">{message.senderName}</span>}
              <time>{message.createdAt}</time>
              {variant === 'private' && (
                <LockKeyhole className="size-3" aria-label="Private note, visible to team only" />
              )}
              {isRight && variant !== 'private' && !isFailed && (
                <MessageStatus status={message.deliveryStatus} />
              )}
            </div>
          </div>
        </div>

        {isFailed && (
          <div className="[grid-area:meta]">
            <MessageError
              error={message.errorMessage || 'Failed to deliver: provider connection error'}
              onRetry={onRetry ? () => onRetry(message.id) : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
