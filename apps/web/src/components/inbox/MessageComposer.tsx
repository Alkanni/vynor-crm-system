'use client';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { FileText, Paperclip } from 'lucide-react';
import { useUiStore } from '@/lib/store/ui-store';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { TemplatePickerPopover } from './TemplatePickerPopover';
import { AttachmentStagingArea } from './AttachmentStagingArea';
import type { MessageAttachment } from './types';

export interface MessageComposerHandle {
  focus: () => void;
}

interface MessageComposerProps {
  onSendMessage: (content: string, attachments: MessageAttachment[]) => void;
  onAddInternalNote: (content: string) => void;
  isSending?: boolean | undefined;
}

/**
 * Reply / Private Note pill with a sliding chip — port of VYNOR
 * `WootWriter/EditorModeToggle.vue` (`h-8 rounded-full bg-n-alpha-2`).
 */
function EditorModeToggle({ mode, onToggle }: { mode: 'reply' | 'note'; onToggle: () => void }) {
  const replyRef = useRef<HTMLSpanElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);
  const [chip, setChip] = useState({ width: 0, x: 0 });
  const isPrivate = mode === 'note';

  useLayoutEffect(() => {
    const replyWidth = replyRef.current?.offsetWidth ?? 0;
    const noteWidth = noteRef.current?.offsetWidth ?? 0;
    // offsetWidth already includes the `px-2` padding VYNOR adds to the measured text width.
    setChip({ width: isPrivate ? noteWidth : replyWidth, x: isPrivate ? replyWidth : 0 });
  }, [isPrivate]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPrivate}
      aria-label="Toggle between reply and private note (Alt+N)"
      title="Alt+N"
      onClick={onToggle}
      className="group relative z-0 flex h-8 w-auto items-center rounded-full border border-n-weak bg-n-alpha-2 p-1 text-sm text-n-slate-12 transition-all duration-300 ease-in-out active:scale-[0.995] active:duration-75"
    >
      <span ref={replyRef} className="z-20 flex items-center gap-1 px-2">
        Reply
      </span>
      <span ref={noteRef} className="z-20 flex items-center gap-1 px-2">
        Private Note
      </span>
      <span
        aria-hidden="true"
        className="absolute left-1 h-6 rounded-full bg-n-solid-1 shadow-sm transition-all duration-300 ease-in-out"
        style={{ width: chip.width, transform: `translateX(${chip.x}px)` }}
      />
    </button>
  );
}

/**
 * Reply box — port of VYNOR `widgets/conversation/ReplyBox.vue`:
 * `mx-2 mb-2 rounded-xl border-n-weak bg-n-solid-1` (private → `bg-n-solid-amber`),
 * `ReplyTopPanel` (`h-[3.25rem]`, mode toggle), editor, and `ReplyBottomPanel`
 * (faded slate tool buttons + send). Ctrl+Enter sends, Alt+N toggles the note mode.
 */
export const MessageComposer = forwardRef<MessageComposerHandle, MessageComposerProps>(
  function MessageComposer({ onSendMessage, onAddInternalNote, isSending = false }, ref) {
    const { composerMode, setComposerMode, toggleComposerMode } = useUiStore();
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

    // Auto-expand the editor height.
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
      }
    }, [text]);

    const isNote = composerMode === 'note';

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);

      // Slash commands open the canned response picker (reply mode only).
      const lastWord = val.split(/\s+/).pop() || '';
      if (lastWord.startsWith('/') && composerMode === 'reply') {
        setSlashQuery(lastWord);
        setIsSlashOpen(true);
      } else {
        setIsSlashOpen(false);
      }
    };

    const handleSelectTemplate = (templateContent: string) => {
      const words = text.split(/\s+/);
      words.pop();
      const updated = words.length > 0 ? `${words.join(' ')} ${templateContent}` : templateContent;
      setText(updated);
      setIsSlashOpen(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    };

    const canSend = (text.trim().length > 0 || attachments.length > 0) && !isSending;

    const handleSubmit = () => {
      if (!canSend) return;
      if (isNote) {
        onAddInternalNote(text);
      } else {
        onSendMessage(text, attachments);
      }
      setText('');
      setAttachments([]);
      setIsSlashOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape' && !isSlashOpen) {
        textareaRef.current?.blur();
      }
    };

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

    return (
      <div
        className={cn(
          'relative mx-2 mb-2 shrink-0 rounded-xl border transition-colors',
          isNote
            ? 'border-n-amber-12/5 bg-n-solid-amber dark:border-n-amber-3/10'
            : 'border-n-weak bg-n-solid-1',
        )}
      >
        <TemplatePickerPopover
          query={slashQuery}
          isOpen={isSlashOpen}
          onSelect={handleSelectTemplate}
          onClose={() => setIsSlashOpen(false)}
        />

        {/* ReplyTopPanel */}
        <div className="flex h-[3.25rem] items-center justify-between gap-2 pl-3 pr-2">
          <EditorModeToggle mode={composerMode} onToggle={toggleComposerMode} />
          <span className="hidden truncate text-xs text-n-slate-10 sm:inline">
            {isNote ? 'Only visible to your team' : 'Type / for canned responses'}
          </span>
        </div>

        <AttachmentStagingArea attachments={attachments} onRemove={handleRemoveAttachment} />

        {/* Editor */}
        <div className="relative -mt-px px-3">
          <textarea
            ref={textareaRef}
            rows={2}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            aria-label={isNote ? 'Private note' : 'Reply to customer'}
            placeholder={
              isNote
                ? 'This will be visible only to agents'
                : 'Shift + enter for new line. Start with "/" to select a canned response.'
            }
            className={cn(
              'block max-h-40 min-h-12 w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-n-slate-12 outline-none focus-visible:outline-none',
              isNote ? 'placeholder:text-n-amber-12/50' : 'placeholder:text-n-slate-10',
            )}
          />
        </div>

        {/* ReplyBottomPanel */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            {!isNote && (
              <>
                <Button
                  size="sm"
                  color="slate"
                  variant="faded"
                  icon={Paperclip}
                  title="Attach files"
                  aria-label="Attach files"
                  onClick={() => fileInputRef.current?.click()}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  size="sm"
                  color="slate"
                  variant="faded"
                  icon={FileText}
                  title="Insert canned response (/)"
                  aria-label="Insert canned response"
                  onClick={() => {
                    setText((prev) => (prev ? `${prev} /` : '/'));
                    setSlashQuery('/');
                    setIsSlashOpen(true);
                    textareaRef.current?.focus();
                  }}
                />
              </>
            )}
            <button
              type="button"
              onClick={() => setComposerMode(isNote ? 'reply' : 'note')}
              className="hidden text-xs text-n-slate-10 hover:text-n-slate-12 md:inline"
            >
              <kbd className="font-sans">Alt+N</kbd> {isNote ? 'reply' : 'private note'}
            </button>
          </div>

          <Button
            type="submit"
            size="sm"
            color={isNote ? 'amber' : 'blue'}
            disabled={!canSend}
            isLoading={isSending}
            onClick={handleSubmit}
            label={isNote ? 'Add note (Ctrl+↵)' : 'Send (Ctrl+↵)'}
            className="shrink-0"
          />
        </div>
      </div>
    );
  },
);
