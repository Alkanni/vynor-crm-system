'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  Redo2,
  Undo2,
} from 'lucide-react';
import { htmlToText } from '@/lib/ai-agents/knowledge';
import { cn } from '@/lib/utils';

const MAX_INLINE_IMAGE_BYTES = 500_000;
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'SPAN', 'IMG']);
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);

/**
 * Keeps only the formatting this editor can produce. Stored HTML comes from
 * the browser, so it is cleaned again before it is put back into the page.
 */
export function sanitizeEditorHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const clean = (node: Element) => {
    for (const child of [...node.children]) {
      clean(child);
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        continue;
      }
      const src = child.getAttribute('src');
      const align = (child as HTMLElement).style.textAlign;
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
      if (child.tagName === 'IMG') {
        if (src?.startsWith('data:image/')) child.setAttribute('src', src);
        else child.remove();
      } else if (ALIGNMENTS.has(align)) {
        child.setAttribute('style', `text-align: ${align};`);
      }
    }
  };
  clean(root);
  return root.innerHTML;
}

type Command =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'justifyFull';

const STATE_COMMANDS: Command[] = [
  'bold',
  'italic',
  'justifyLeft',
  'justifyCenter',
  'justifyRight',
  'justifyFull',
];

interface RichTextEditorProps {
  /** Loaded once on mount; remount the editor (via `key`) to show another document. */
  html: string;
  onChange: (html: string) => void;
  onError: (message: string) => void;
}

export function RichTextEditor({ html, onChange, onError }: RichTextEditorProps) {
  const editor = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const initialHtml = useRef(html);
  const [active, setActive] = useState<Partial<Record<Command, boolean>>>({});

  // The DOM owns the content while typing; writing `html` back would reset the caret.
  useEffect(() => {
    if (editor.current) editor.current.innerHTML = sanitizeEditorHtml(initialHtml.current);
  }, []);

  const emit = () => {
    if (editor.current) onChange(editor.current.innerHTML);
  };

  const refreshActive = () => {
    const next: Partial<Record<Command, boolean>> = {};
    for (const command of STATE_COMMANDS) {
      try {
        next[command] = document.queryCommandState(command);
      } catch {
        next[command] = false;
      }
    }
    setActive(next);
  };

  // execCommand is deprecated but remains the only built-in way to edit
  // contentEditable with native undo history, and every browser supports it.
  const run = (command: Command | 'insertImage' | 'insertText', value?: string) => {
    editor.current?.focus();
    document.execCommand(command, false, value);
    emit();
    refreshActive();
  };

  const insertImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError('Only images can be inserted.');
      return;
    }
    if (file.size > MAX_INLINE_IMAGE_BYTES) {
      onError('Images in knowledge text must be 500 KB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => run('insertImage', String(reader.result));
    reader.readAsDataURL(file);
  };

  const tool = (
    command: Command,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
  ) => (
    <button
      key={command}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={STATE_COMMANDS.includes(command) ? Boolean(active[command]) : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => run(command)}
      className={cn(
        'inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-n-slate-11 transition-colors hover:bg-[hsl(var(--muted))]',
        active[command] && 'bg-[var(--brand-2)] text-[var(--brand-11)]',
      )}
    >
      <Icon className="size-4" />
    </button>
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-1 border-b border-[hsl(var(--border))] px-3 py-2"
      >
        {tool('undo', 'Undo', Undo2)}
        {tool('redo', 'Redo', Redo2)}
        <span className="mx-1 h-5 w-px bg-[hsl(var(--border))]" />
        {tool('bold', 'Bold', Bold)}
        {tool('italic', 'Italic', Italic)}
        <span className="mx-1 h-5 w-px bg-[hsl(var(--border))]" />
        <button
          type="button"
          aria-label="Insert image"
          title="Insert image"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => imageInput.current?.click()}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-n-slate-11 hover:bg-[hsl(var(--muted))]"
        >
          <ImagePlus className="size-4" />
        </button>
        <input
          ref={imageInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            insertImage(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <span className="mx-1 h-5 w-px bg-[hsl(var(--border))]" />
        {tool('justifyLeft', 'Align left', AlignLeft)}
        {tool('justifyCenter', 'Align center', AlignCenter)}
        {tool('justifyRight', 'Align right', AlignRight)}
        {tool('justifyFull', 'Justify', AlignJustify)}
      </div>

      <div
        ref={editor}
        role="textbox"
        aria-multiline="true"
        aria-label="Knowledge text"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onPaste={(e) => {
          // Paste as plain text so foreign markup and scripts never enter the document.
          e.preventDefault();
          run('insertText', e.clipboardData.getData('text/plain'));
        }}
        onDrop={(e) => e.preventDefault()}
        className="min-h-[420px] overflow-y-auto px-5 py-4 text-sm leading-relaxed text-[hsl(var(--foreground))] outline-none empty:before:text-[hsl(var(--muted-foreground))] empty:before:content-['Write_what_the_AI_should_know,_for_example_opening_hours,_address,_and_policies.'] [&_img]:my-2 [&_img]:max-h-64 [&_img]:rounded-lg"
      />

      <div className="border-t border-[hsl(var(--border))] px-5 py-2.5 text-sm tabular-nums text-n-slate-11">
        {htmlToText(html).length.toLocaleString('en-US')} Characters
      </div>
    </div>
  );
}
