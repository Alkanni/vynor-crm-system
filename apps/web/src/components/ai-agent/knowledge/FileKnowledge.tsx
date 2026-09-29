'use client';

import React, { useRef, useState } from 'react';
import { FileText, LoaderCircle, Trash2, UploadCloud } from 'lucide-react';
import type { KnowledgeFile } from '@vynor/contracts';
import { createId } from '@/lib/ai-agents/defaults';
import { KNOWLEDGE_FILE_ACCEPT, extractFileText } from '@/lib/ai-agents/extract-file-text';
import { cn } from '@/lib/utils';

interface FileKnowledgeProps {
  files: KnowledgeFile[];
  savedFileIds: Set<string>;
  onChange: (update: (files: KnowledgeFile[]) => KnowledgeFile[]) => void;
  onError: (message: string) => void;
}

function FileRow({ file, onRemove }: { file: KnowledgeFile; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <FileText className="size-4 shrink-0 text-n-slate-10" />
      <span className="min-w-0 truncate text-[hsl(var(--foreground))]">{file.name}</span>
      <span className="shrink-0 font-semibold tabular-nums text-n-slate-12">
        {file.content.length.toLocaleString('en-US')} characters
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="shrink-0 cursor-pointer rounded-md p-1 text-[var(--ruby-11)] hover:bg-[var(--ruby-2)]"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

export function FileKnowledge({ files, savedFileIds, onChange, onError }: FileKnowledgeProps) {
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const included = files.filter((f) => savedFileIds.has(f.id));
  const toAdd = files.filter((f) => !savedFileIds.has(f.id));

  const addFiles = async (list: FileList | null) => {
    for (const file of Array.from(list ?? [])) {
      if (files.some((f) => f.name === file.name && f.sizeBytes === file.size)) {
        onError(`${file.name} is already added.`);
        continue;
      }
      setReading((prev) => [...prev, file.name]);
      try {
        const { text, truncated } = await extractFileText(file);
        onChange((prev) => [
          ...prev,
          {
            id: createId('fil'),
            name: file.name,
            sizeBytes: file.size,
            content: text,
            addedAt: new Date().toISOString(),
          },
        ]);
        if (truncated) onError(`${file.name} is long; only the first 500,000 characters are used.`);
      } catch (error) {
        onError(error instanceof Error ? error.message : `${file.name} could not be read.`);
      } finally {
        setReading((prev) => prev.filter((name) => name !== file.name));
      }
    }
  };

  const remove = (id: string) => onChange((prev) => prev.filter((f) => f.id !== id));

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-[hsl(var(--border))] p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-n-slate-12">Files</h3>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(e.dataTransfer.files);
          }}
          className={cn(
            'flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-12 text-center transition-colors',
            dragging
              ? 'border-[#e5484d] bg-[var(--brand-2)]'
              : 'border-[hsl(var(--border-strong))] hover:border-[#e5484d]',
          )}
        >
          <UploadCloud className="size-7 text-n-slate-10" />
          <span className="text-sm font-semibold text-n-slate-12">
            Drag &amp; drop your files here or click to select files
          </span>
          <span className="text-xs text-n-slate-10">
            Supported File Type: .pdf, .txt (max 10 MB)
          </span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={KNOWLEDGE_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="text-xs text-n-slate-11">
          If you are uploading a PDF, make sure you can highlight the text
        </p>
      </div>

      {reading.length > 0 && (
        <ul className="flex flex-col gap-1" role="status">
          {reading.map((name) => (
            <li key={name} className="flex items-center gap-2 text-sm text-n-slate-11">
              <LoaderCircle className="size-4 animate-spin" />
              Reading {name}…
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-n-slate-12">Already Included Files:</h4>
        {included.length === 0 ? (
          <p className="text-sm text-n-slate-11">-</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {included.map((file) => (
              <FileRow key={file.id} file={file} onRemove={() => remove(file.id)} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-n-slate-12">To be added:</h4>
        {toAdd.length === 0 ? (
          <p className="text-sm text-n-slate-11">-</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1.5">
              {toAdd.map((file) => (
                <FileRow key={file.id} file={file} onRemove={() => remove(file.id)} />
              ))}
            </ul>
            <p className="text-xs text-n-slate-10">Save to train the agent with these files.</p>
          </>
        )}
      </div>
    </div>
  );
}
