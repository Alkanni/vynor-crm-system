import { describe, expect, it } from 'vitest';
import { KnowledgeLinkSchema, type AiAgent, type AiAgentGeneralSettings } from '@vynor/contracts';
import { newAgentRecord, seedAgents } from '../../src/lib/ai-agents/defaults';
import { PIPELINE_STATUSES } from '../../src/lib/ai-agents/options';
import {
  initialConversationState,
  runPreviewEngine,
  type ChatTurn,
  type ConversationState,
  type EngineInput,
} from '../../src/lib/ai-agents/preview-engine';
import { htmlToText, summarizeKnowledge } from '../../src/lib/ai-agents/knowledge';

// 09:00 in Jakarta (UTC+7).
const MORNING_JAKARTA = new Date('2026-09-29T02:00:00Z');

function supportAgent(overrides: Partial<AiAgentGeneralSettings> = {}): AiAgent {
  const agent = seedAgents(MORNING_JAKARTA)[0]!;
  return { ...agent, general: { ...agent.general, ...overrides } };
}

function run(
  agent: AiAgent,
  message: string,
  state: ConversationState = { ...initialConversationState(), welcomed: true },
  history: ChatTurn[] = [],
) {
  const input: EngineInput = {
    settings: agent.general,
    knowledge: agent.knowledge,
    pipeline: PIPELINE_STATUSES.map((s) => s.name),
    state,
    incoming: [message],
    history,
    now: MORNING_JAKARTA,
  };
  return runPreviewEngine(input);
}

describe('AI agent preview engine', () => {
  it('sends the welcome message on the first message and stops at a plain greeting', () => {
    const agent = supportAgent();
    const result = run(agent, 'halo kak', initialConversationState());

    expect(result.replies.map((r) => r.kind)).toEqual(['WELCOME']);
    expect(result.replies[0]?.text).toBe(agent.general.welcomeMessage);
    expect(result.state.welcomed).toBe(true);
    expect(result.state.aiMessageCount).toBe(0);
  });

  it('greets by the time of day in the agent timezone', () => {
    const noWelcome = { welcomeMessage: '' };
    expect(run(supportAgent(noWelcome), 'halo').replies[0]?.text).toContain('Selamat pagi');
    expect(
      run(supportAgent({ ...noWelcome, timezone: 'America/New_York' }), 'halo').replies[0]?.text,
    ).toContain('Selamat malam');
  });

  it('answers from Q&A, text documents and products with their sources', () => {
    const agent = supportAgent({ temperature: 'PRECISE' });

    const qna = run(agent, 'gimana cara retur barang?').replies[0];
    expect(qna?.kind).toBe('ANSWER');
    expect(qna?.text).toContain('maksimal 7 hari');
    expect(qna?.sources[0]).toBe('Q&A: Bagaimana cara retur barang?');

    const text = run(agent, 'jam operasional tokonya kapan?').replies[0];
    expect(text?.text).toContain('Senin sampai Sabtu');
    expect(text?.sources).toContain('Text: Default');

    const product = run(agent, 'berapa harga bantal memory foam?').replies[0];
    expect(product?.text).toContain('Rp245.000');
    expect(product?.sources[0]).toBe('Product: Bantal Memory Foam');
  });

  it('styles answers by temperature', () => {
    const precise = run(supportAgent({ temperature: 'PRECISE' }), 'berapa ongkos kirim?');
    const balanced = run(supportAgent({ temperature: 'BALANCED' }), 'berapa ongkos kirim?');
    expect(precise.replies[0]?.text).not.toContain('Ada lagi');
    expect(balanced.replies[0]?.text).toContain('Ada lagi yang bisa aku bantu');
  });

  it('falls back politely when the knowledge has no answer', () => {
    const result = run(supportAgent(), 'cuaca hari ini gimana?');
    expect(result.replies[0]?.kind).toBe('FALLBACK');
    expect(run(supportAgent(), 'what is the weather today?').replies[0]?.text).toContain(
      "don't have information",
    );
  });

  it('hands off on a transfer condition and then sends the pending messages', () => {
    const agent = supportAgent();
    const handoff = run(agent, 'saya mau bicara dengan admin');
    expect(handoff.replies[0]?.kind).toBe('HANDOFF');
    expect(handoff.events).toContainEqual({ type: 'HANDOFF', silent: false });
    expect(handoff.state.status).toBe('PENDING');

    const unassigned = run(agent, 'halo?', handoff.state);
    expect(unassigned.replies[0]?.text).toBe(agent.general.pendingUnassignedMessage);

    const assigned = run(agent, 'halo?', { ...handoff.state, assigned: true });
    expect(assigned.replies[0]?.text).toBe(agent.general.pendingAssignedMessage);
  });

  it('hands off new agents in English and Indonesian by default', () => {
    const agent = newAgentRecord('New agent', MORNING_JAKARTA);
    expect(run(agent, 'can I talk to a human agent?').state.status).toBe('PENDING');
    expect(run(agent, 'mau bicara dengan admin dong').state.status).toBe('PENDING');
    expect(run(agent, 'apakah admin buka hari minggu?').state.status).toBe('OPEN');
  });

  it('keeps answering after handoff when Stop AI after Handoff is off', () => {
    const agent = supportAgent({ stopAfterHandoff: false });
    const handoff = run(agent, 'saya mau bicara dengan admin');
    const next = run(agent, 'berapa ongkos kirim?', handoff.state);
    expect(next.replies[0]?.kind).toBe('ANSWER');
  });

  it('stays quiet after a silent handoff', () => {
    const agent = supportAgent({ silentHandoff: true, stopAfterHandoff: false });
    const handoff = run(agent, 'barang saya rusak');
    expect(handoff.replies).toEqual([]);
    expect(handoff.events).toContainEqual({ type: 'HANDOFF', silent: true });
    expect(run(agent, 'berapa ongkos kirim?', handoff.state).replies).toEqual([]);
  });

  it('applies allowed labels and moves the pipeline forward only', () => {
    const agent = supportAgent();
    const labelled = run(agent, 'ini bukti transfernya ya');
    expect(labelled.events).toContainEqual({ type: 'LABEL', label: 'Purchased' });

    const hot = run(agent, 'berapa harga sprei katun?');
    expect(hot.state.pipelineStatus).toBe('Hot Leads');

    const payment = run(agent, 'nomor rekening pembayarannya berapa?', hot.state);
    expect(payment.state.pipelineStatus).toBe('Payment');

    const back = run(agent, 'stok sprei masih ada?', payment.state);
    expect(back.state.pipelineStatus).toBe('Payment');
  });

  it('stops at the AI message limit', () => {
    const agent = supportAgent({ messageLimit: 1 });
    const first = run(agent, 'berapa ongkos kirim?');
    const second = run(agent, 'gimana cara retur?', first.state);
    expect(second.replies).toEqual([]);
    expect(second.events).toContainEqual({ type: 'MESSAGE_LIMIT', limit: 1 });
  });

  it('uses remembered messages for an ambiguous follow-up', () => {
    const agent = supportAgent({ temperature: 'PRECISE' });
    const history: ChatTurn[] = [{ role: 'customer', text: 'berapa harga bantal memory foam?' }];
    const result = run(agent, 'stoknya ada?', undefined, history);
    expect(result.replies[0]?.sources[0]).toBe('Product: Bantal Memory Foam');
  });

  it('limits sources to the AI context limit', () => {
    const result = run(supportAgent({ contextLimit: 1 }), 'berapa ongkos kirim pengiriman?');
    expect(result.replies[0]?.sources).toHaveLength(1);
  });
});

describe('knowledge helpers', () => {
  it('converts editor HTML to text with line breaks', () => {
    expect(htmlToText('<div><b>A</b></div><div><br></div><div>B &amp; C</div>')).toBe('A\n\nB & C');
  });

  it('summarises knowledge counts and characters', () => {
    const summary = summarizeKnowledge(supportAgent().knowledge);
    expect(summary.qna).toBe(3);
    expect(summary.products).toBe(3);
    expect(summary.textCharacters).toBeGreaterThan(100);
    expect(summary.totalCharacters).toBeGreaterThan(summary.textCharacters);
  });
});

describe('AI agent contracts', () => {
  it('only accepts web links as website knowledge', () => {
    const link = {
      id: 'lnk_1',
      mode: 'SINGLE',
      status: 'QUEUED',
      characters: 0,
      addedAt: '2026-09-29T02:00:00.000Z',
    };
    expect(KnowledgeLinkSchema.safeParse({ ...link, url: 'https://example.com/faq' }).success).toBe(
      true,
    );
    expect(KnowledgeLinkSchema.safeParse({ ...link, url: 'javascript:alert(1)' }).success).toBe(
      false,
    );
  });
});
