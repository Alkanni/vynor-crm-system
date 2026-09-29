'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AI_AGENT_LIMITS, type KnowledgeQna } from '@vynor/contracts';
import { createId } from '@/lib/ai-agents/defaults';
import { CountedTextarea, SECONDARY_BUTTON_CLASS } from '../ui';

interface QnaKnowledgeProps {
  pairs: KnowledgeQna[];
  onChange: (update: (pairs: KnowledgeQna[]) => KnowledgeQna[]) => void;
}

/** A pair is incomplete when exactly one side is filled; fully empty rows are dropped on save. */
export function isIncompletePair(pair: KnowledgeQna): boolean {
  return Boolean(pair.question.trim()) !== Boolean(pair.answer.trim());
}

export function QnaKnowledge({ pairs, onChange }: QnaKnowledgeProps) {
  const update = (id: string, patch: Partial<KnowledgeQna>) =>
    onChange((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-2xl font-semibold text-n-slate-12">Q&amp;A</h3>
        <button
          type="button"
          onClick={() =>
            onChange((prev) => [{ id: createId('qna'), question: '', answer: '' }, ...prev])
          }
          className={SECONDARY_BUTTON_CLASS}
        >
          <Plus className="size-4" />
          Add Q&amp;A
        </button>
      </div>

      {pairs.length === 0 && (
        <p className="rounded-xl border border-dashed border-n-strong px-6 py-10 text-center text-sm text-n-slate-11">
          Add the questions customers ask most, with the exact answer the AI should give.
        </p>
      )}

      {pairs.map((pair, index) => (
        <fieldset
          key={pair.id}
          className="flex flex-col gap-3 rounded-xl bg-n-alpha-black2 p-4 sm:p-5"
        >
          <legend className="sr-only">Q&amp;A {index + 1}</legend>
          <label htmlFor={`${pair.id}-q`} className="text-sm text-n-slate-11">
            Question
          </label>
          <CountedTextarea
            id={`${pair.id}-q`}
            autoFocus={index === 0 && !pair.question && !pair.answer}
            value={pair.question}
            onChange={(question) => update(pair.id, { question })}
            max={AI_AGENT_LIMITS.qnaQuestionMax}
            rows={2}
            className="min-h-16"
          />
          <label htmlFor={`${pair.id}-a`} className="text-sm text-n-slate-11">
            Answer
          </label>
          <CountedTextarea
            id={`${pair.id}-a`}
            value={pair.answer}
            onChange={(answer) => update(pair.id, { answer })}
            max={AI_AGENT_LIMITS.qnaAnswerMax}
            rows={3}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-n-ruby-9">
              {isIncompletePair(pair) &&
                (pair.question.trim()
                  ? 'Add an answer to this question.'
                  : 'Add the question for this answer.')}
            </p>
            <button
              type="button"
              onClick={() => onChange((prev) => prev.filter((p) => p.id !== pair.id))}
              aria-label={`Delete Q&A ${index + 1}`}
              className="cursor-pointer rounded-md p-1.5 text-n-ruby-11 hover:bg-n-ruby-2"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </fieldset>
      ))}
    </div>
  );
}
