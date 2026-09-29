'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bot, RotateCcw, SendHorizontal, UserRound } from 'lucide-react';
import type { AiAgentGeneralSettings, AiAgentKnowledge } from '@vynor/contracts';
import { PIPELINE_STATUSES } from '@/lib/ai-agents/options';
import {
  initialConversationState,
  runPreviewEngine,
  type ChatTurn,
  type ConversationState,
  type EngineEvent,
} from '@/lib/ai-agents/preview-engine';
import { cn } from '@/lib/utils';

type Entry =
  | {
      id: string;
      kind: 'message';
      role: 'customer' | 'ai';
      text: string;
      image: string | null;
      sources: string[];
      session: number;
    }
  | { id: string; kind: 'event'; text: string; tone: 'info' | 'warning'; session: number }
  | { id: string; kind: 'divider'; text: string; session: number };

const PIPELINE = PIPELINE_STATUSES.map((s) => s.name);

let entryCounter = 0;
const nextId = () => `entry_${(entryCounter += 1)}`;

function describeEvent(event: EngineEvent): { text: string; tone: 'info' | 'warning' } {
  switch (event.type) {
    case 'HANDOFF':
      return event.silent
        ? { text: 'Silent handoff: chat moved to Pending without a reply.', tone: 'warning' }
        : { text: 'Chat moved to Pending and waits for a human agent.', tone: 'warning' };
    case 'LABEL':
      return { text: `Label added: ${event.label}`, tone: 'info' };
    case 'PIPELINE':
      return { text: `Pipeline: ${event.from ?? 'Start'} → ${event.to}`, tone: 'info' };
    case 'MESSAGE_LIMIT':
      return {
        text: `AI message limit reached (${event.limit}). The AI replies again after the chat is resolved.`,
        tone: 'warning',
      };
    case 'WAITING_FOR_AGENT':
      return { text: 'The AI stays quiet while the chat waits for a human agent.', tone: 'info' };
  }
}

interface AgentTestChatProps {
  agentName: string;
  general: AiAgentGeneralSettings;
  knowledge: AiAgentKnowledge;
  usesUnsavedChanges: boolean;
}

export function AgentTestChat({
  agentName,
  general,
  knowledge,
  usesUnsavedChanges,
}: AgentTestChatProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [conversation, setConversation] = useState<ConversationState>(initialConversationState);
  const [session, setSession] = useState(1);
  const [input, setInput] = useState('');
  const [replyAt, setReplyAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The await timer fires after renders, so it reads the latest values from refs.
  const latest = useRef({ general, knowledge, entries, conversation, session });
  useEffect(() => {
    latest.current = { general, knowledge, entries, conversation, session };
  });
  const queue = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [entries, replyAt]);

  useEffect(() => {
    if (replyAt === null) return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [replyAt]);

  const respond = () => {
    timer.current = null;
    setReplyAt(null);
    const incoming = queue.current;
    queue.current = [];
    const state = latest.current;

    const history: ChatTurn[] = state.entries.flatMap((entry) =>
      entry.kind === 'message' &&
      (!state.general.sessionOnlyMemory || entry.session === state.session)
        ? [{ role: entry.role, text: entry.text }]
        : [],
    );
    // The messages being answered are the latest customer turns, not history.
    const earlier = history.slice(0, Math.max(0, history.length - incoming.length));

    const result = runPreviewEngine({
      settings: state.general,
      knowledge: state.knowledge,
      pipeline: PIPELINE,
      state: state.conversation,
      incoming,
      history: earlier,
      now: new Date(),
    });

    const added: Entry[] = [];
    for (const event of result.events) {
      const { text, tone } = describeEvent(event);
      const previous = [...state.entries, ...added].at(-1);
      // One "waiting" note is enough while the customer keeps writing.
      if (
        event.type === 'WAITING_FOR_AGENT' &&
        previous?.kind === 'event' &&
        previous.text === text
      ) {
        continue;
      }
      added.push({ id: nextId(), kind: 'event', text, tone, session: state.session });
    }
    for (const reply of result.replies) {
      added.push({
        id: nextId(),
        kind: 'message',
        role: 'ai',
        text: reply.text,
        image: reply.image,
        sources: reply.sources,
        session: state.session,
      });
    }
    setEntries((prev) => [...prev, ...added]);
    setConversation(result.state);
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setEntries((prev) => [
      ...prev,
      { id: nextId(), kind: 'message', role: 'customer', text, image: null, sources: [], session },
    ]);
    queue.current.push(text);

    // Message Await: every new message restarts the wait, then all are answered together.
    if (timer.current) clearTimeout(timer.current);
    const delay = Math.max(general.messageAwaitSeconds * 1000, 300);
    setReplyAt(Date.now() + delay);
    setNow(Date.now());
    timer.current = setTimeout(respond, delay);
  };

  const resolve = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    queue.current = [];
    setReplyAt(null);
    setConversation(initialConversationState());
    setSession((s) => s + 1);
    setEntries((prev) =>
      general.sessionOnlyMemory || prev.length === 0
        ? []
        : [
            ...prev,
            {
              id: nextId(),
              kind: 'divider',
              text: 'Chat resolved · new session (previous messages are remembered)',
              session: session + 1,
            },
          ],
    );
  };

  const secondsLeft = replyAt ? Math.max(0, Math.ceil((replyAt - now) / 1000)) : 0;
  const pending = conversation.status === 'PENDING';

  return (
    <aside
      aria-label="Test chat"
      className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-n-weak bg-n-solid-2 shadow-sm lg:sticky lg:top-0 lg:h-[calc(100dvh-20rem)] lg:min-h-[440px]"
    >
      <div className="flex items-center gap-3 border-b border-n-weak px-4 py-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-n-slate-3 text-n-slate-11">
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-n-slate-12">{agentName}</p>
          <p className="text-xs text-n-slate-10">
            Test chat{usesUnsavedChanges ? ' · using unsaved changes' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={resolve}
          aria-label="Resolve chat and start a new session"
          title="Resolve chat and start a new session"
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-n-slate-11 hover:bg-n-slate-3"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-n-weak px-4 py-2 text-xs">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-medium',
            pending ? 'bg-n-ruby-3 text-n-ruby-11' : 'bg-n-teal-9/10 text-n-teal-11',
          )}
        >
          {pending ? 'Pending' : 'Open'}
        </span>
        {pending && (
          <button
            type="button"
            onClick={() => setConversation((c) => ({ ...c, assigned: !c.assigned }))}
            className="cursor-pointer rounded-full border border-n-weak px-2 py-0.5 text-n-slate-11 hover:bg-n-slate-3"
            title="Simulate a human agent picking up the chat"
          >
            {conversation.assigned ? 'Assigned · unassign' : 'Unassigned · assign agent'}
          </button>
        )}
        {conversation.pipelineStatus && (
          <span className="rounded-full bg-n-slate-3 px-2 py-0.5 text-n-slate-11">
            {conversation.pipelineStatus}
          </span>
        )}
        {conversation.labels.map((label) => (
          <span key={label} className="rounded-full bg-n-iris-9/10 px-2 py-0.5 text-n-iris-11">
            {label}
          </span>
        ))}
        <span className="ml-auto tabular-nums text-n-slate-10">
          AI messages {conversation.aiMessageCount}/{general.messageLimit}
        </span>
      </div>

      <div
        ref={scroller}
        aria-live="polite"
        className="flex flex-1 flex-col gap-3 overflow-y-auto bg-n-slate-3 px-4 py-4"
      >
        {entries.length === 0 && (
          <div className="m-auto flex max-w-xs flex-col items-center gap-2 text-center text-sm text-n-slate-11">
            <Bot className="size-8 text-n-slate-10" />
            <p>Send a message as a customer to test {agentName}.</p>
            <p className="text-xs text-n-slate-10">
              Replies are a preview built from your knowledge sources and settings. No customer
              receives them.
            </p>
          </div>
        )}

        {entries.map((entry) => {
          if (entry.kind === 'divider') {
            return (
              <p key={entry.id} className="text-center text-xs text-n-slate-10">
                — {entry.text} —
              </p>
            );
          }
          if (entry.kind === 'event') {
            return (
              <p
                key={entry.id}
                className={cn(
                  'mx-auto max-w-[90%] rounded-full px-3 py-1 text-center text-xs',
                  entry.tone === 'warning'
                    ? 'bg-n-amber-9/15 text-n-amber-11'
                    : 'bg-n-solid-2 text-n-slate-11',
                )}
              >
                {entry.text}
              </p>
            );
          }
          const fromCustomer = entry.role === 'customer';
          return (
            <div
              key={entry.id}
              className={cn(
                'flex max-w-[85%] flex-col gap-1',
                fromCustomer ? 'ml-auto items-end' : 'items-start',
              )}
            >
              <div
                className={cn(
                  'whitespace-pre-wrap break-words rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                  fromCustomer
                    ? 'rounded-br-sm bg-n-solid-blue text-n-slate-12'
                    : 'rounded-bl-sm border border-n-weak bg-n-solid-2 text-n-slate-12',
                )}
              >
                {entry.image && (
                  <img src={entry.image} alt="" className="mb-2 max-h-40 w-auto rounded-lg" />
                )}
                {entry.text}
              </div>
              {entry.sources.length > 0 && (
                <p className="px-1 text-xs text-n-slate-10">From {entry.sources.join(' · ')}</p>
              )}
            </div>
          );
        })}

        {replyAt !== null && (
          <p className="text-xs text-n-slate-10" role="status">
            {secondsLeft > 0 ? `AI replies in ${secondsLeft}s (Message Await)…` : 'AI is typing…'}
          </p>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-n-weak p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          aria-label="Message as customer"
          placeholder="Type your message..."
          className="max-h-32 min-h-10 flex-1 resize-none rounded-lg bg-transparent px-2 py-2 text-sm text-n-slate-12 outline-none placeholder:text-n-slate-11"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Send message"
          className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-n-slate-12 transition-colors hover:bg-n-slate-3 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizontal className="size-5" />
        </button>
      </form>
    </aside>
  );
}
