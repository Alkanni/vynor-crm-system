'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Send, Lock, Paperclip, MessageSquare } from 'lucide-react';
import { useUiStore } from '@/lib/store/ui-store';
import { TemplatePickerPopover } from './TemplatePickerPopover';
import { AttachmentStagingArea } from './AttachmentStagingArea';
import type { MessageAttachment } from './types';
import { cn } from '@/lib/utils';

export interface MessageComposerHandle {
  focus: () => void;
}

interface MessageComposerProps {
  onSendMessage: (content: string, attachments: MessageAttachment[]) => void;
  onAddInternalNote: (content: string) => void;
  isSending?: boolean;
}

export const MessageComposer = forwardRef<MessageComposerHandle, MessageComposerProps>(
  function MessageComposer({ onSendMessage, onAddInternalNote, isSending = false }, ref) {
    const { composerMode, setComposerMode } = useUiStore();
    const [text, setText] = useState('');
    const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
    const [slashQuery, setSlashQuery] = useState('');
    const [isSlashOpen, setIsSlashOpen] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    // Auto-expand textarea height
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 160);
        textarea.style.height = `${newHeight}px`;
      }
    }, [text]);

    // Handle Text Change & Slash Commands detection
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);

      // Check if user is typing a slash command (e.g. starts with / or last word starts with /)
      const lastWord = val.split(/\s+/).pop() || '';
      if (lastWord.startsWith('/') && composerMode === 'reply') {
        setSlashQuery(lastWord);
        setIsSlashOpen(true);
      } else {
        setIsSlashOpen(false);
      }
    };

    // Handle inserting template content
    const handleSelectTemplate = (templateContent: string) => {
      // Replace the trailing slash command with the selected template content
      const words = text.split(/\s+/);
      words.pop();
      const updated = words.length > 0 ? `${words.join(' ')} ${templateContent}` : templateContent;
      setText(updated);
      setIsSlashOpen(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    };

    // Handle Submit
    const handleSubmit = () => {
      if (!text.trim() && attachments.length === 0) return;

      if (composerMode === 'note') {
        onAddInternalNote(text);
      } else {
        onSendMessage(text, attachments);
      }

      setText('');
      setAttachments([]);
      setIsSlashOpen(false);
    };

    // Keyboard handlers (Ctrl+Enter or Cmd+Enter to send)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };

    // Mock file upload staging
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newAttachments: MessageAttachment[] = Array.from(files).map((f, i) => ({
        id: `att_${Date.now()}_${i}`,
        name: f.name,
        size: `${Math.round(f.size / 1024)} KB`,
        type: f.type || 'application/octet-stream',
      }));

      setAttachments((prev) => [...prev, ...newAttachments]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveAttachment = (id: string) => {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    };

    const isNote = composerMode === 'note';

    return (
      <div
        className={cn(
          'relative border-t transition-colors bg-card select-none',
          isNote ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card',
        )}
      >
        {/* Template Picker Popover */}
        <TemplatePickerPopover
          query={slashQuery}
          isOpen={isSlashOpen}
          onSelect={handleSelectTemplate}
          onClose={() => setIsSlashOpen(false)}
        />

        {/* Mode Selector Tabs (Customer Reply vs Internal Note) */}
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1 rounded-xs bg-muted/70 p-0.5 font-medium">
            <button
              type="button"
              onClick={() => setComposerMode('reply')}
              className={cn(
                'flex items-center gap-1.5 rounded-xs px-2.5 py-1 transition-all',
                !isNote
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <MessageSquare className="h-3 w-3" />
              <span>Customer Reply</span>
            </button>

            <button
              type="button"
              onClick={() => setComposerMode('note')}
              className={cn(
                'flex items-center gap-1.5 rounded-xs px-2.5 py-1 transition-all',
                isNote
                  ? 'bg-amber-500 text-amber-950 font-bold shadow-xs'
                  : 'text-amber-700/80 dark:text-amber-400 hover:text-foreground',
              )}
            >
              <Lock className="h-3 w-3" />
              <span>Internal Note</span>
              <kbd className="hidden sm:inline-block rounded-xs bg-black/10 px-1 font-mono text-[9px]">
                Alt+N
              </kbd>
            </button>
          </div>

          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Press <kbd className="font-mono text-[10px]">Ctrl+Enter</kbd> to dispatch
          </span>
        </div>

        {/* Staged Attachments */}
        <AttachmentStagingArea attachments={attachments} onRemove={handleRemoveAttachment} />

        {/* Text Input Area */}
        <div className="p-3 select-text">
          <textarea
            ref={textareaRef}
            rows={2}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isNote
                ? 'Type an internal note for team members (visible to team only)...'
                : 'Type a customer reply... (/ for templates, Ctrl+Enter to send)'
            }
            className={cn(
              'w-full resize-none bg-transparent text-xs leading-relaxed outline-hidden placeholder:text-muted-foreground',
              isNote
                ? 'text-amber-950 dark:text-amber-100 placeholder:text-amber-700/60 dark:placeholder:text-amber-400/60'
                : 'text-foreground',
            )}
          />
        </div>

        {/* Bottom Toolbar & Action Dispatch */}
        <div className="flex items-center justify-between border-t border-border/40 px-3 py-2 bg-surface/50">
          <div className="flex items-center gap-2">
            {/* Attachment Button */}
            {!isNote && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file or screenshot"
                  aria-label="Attach file"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </>
            )}

            {/* Quick Slash Template Hint */}
            {!isNote && (
              <button
                type="button"
                onClick={() => {
                  setText((prev) => `${prev} /`);
                  setIsSlashOpen(true);
                  textareaRef.current?.focus();
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
              >
                Insert Template (<kbd className="font-mono text-[10px]">/</kbd>)
              </button>
            )}
          </div>

          {/* Dispatch Button */}
          <button
            type="button"
            disabled={(!text.trim() && attachments.length === 0) || isSending}
            onClick={handleSubmit}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xs px-3 py-1.5 text-xs font-semibold shadow-xs transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
              isNote
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {isNote ? (
              <>
                <Lock className="h-3 w-3" />
                <span>Add Internal Note</span>
              </>
            ) : (
              <>
                <Send className="h-3 w-3" />
                <span>Send Reply</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  },
);
