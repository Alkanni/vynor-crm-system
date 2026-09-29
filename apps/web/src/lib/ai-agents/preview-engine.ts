import type { AiAgentGeneralSettings, AiAgentKnowledge } from '@vynor/contracts';
import { formatRupiah, htmlToText } from './knowledge';

/**
 * Deterministic stand-in for the AI runtime, used by the settings test chat.
 *
 * It applies the agent's settings the way the live runtime will (welcome
 * message, transfer conditions, handoff rules, AI actions, limits, memory)
 * and answers from the knowledge sources by keyword retrieval. It does not
 * generate language, so free-text behaviour instructions are not followed.
 */

export type ChatLanguage = 'id' | 'en';

export interface ConversationState {
  status: 'OPEN' | 'PENDING';
  /** Set once a silent handoff happened; the AI stays quiet for the rest of the session. */
  silenced: boolean;
  /** Whether a human agent picked up the pending chat (drives which pending message is sent). */
  assigned: boolean;
  aiMessageCount: number;
  welcomed: boolean;
  labels: string[];
  pipelineStatus: string | null;
}

export interface ChatTurn {
  role: 'customer' | 'ai';
  text: string;
}

export interface EngineInput {
  settings: AiAgentGeneralSettings;
  knowledge: AiAgentKnowledge;
  /** Workspace pipeline in order; the AI may only move forward. */
  pipeline: string[];
  state: ConversationState;
  /** Customer messages collected during the Message Await window, oldest first. */
  incoming: string[];
  /** Earlier turns the AI may remember, oldest first. */
  history: ChatTurn[];
  now: Date;
}

export type EngineEvent =
  | { type: 'HANDOFF'; silent: boolean }
  | { type: 'LABEL'; label: string }
  | { type: 'PIPELINE'; from: string | null; to: string }
  | { type: 'MESSAGE_LIMIT'; limit: number }
  | { type: 'WAITING_FOR_AGENT' };

export type ReplyKind = 'WELCOME' | 'GREETING' | 'ANSWER' | 'HANDOFF' | 'PENDING' | 'FALLBACK';

export interface EngineReply {
  kind: ReplyKind;
  text: string;
  image: string | null;
  /** Knowledge entries the answer came from. */
  sources: string[];
}

export interface EngineResult {
  replies: EngineReply[];
  events: EngineEvent[];
  state: ConversationState;
}

export function initialConversationState(): ConversationState {
  return {
    status: 'OPEN',
    silenced: false,
    assigned: false,
    aiMessageCount: 0,
    welcomed: false,
    labels: [],
    pipelineStatus: null,
  };
}

// ---------------------------------------------------------------------------
// Text matching
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  // Indonesian
  (
    'yang dan di ke dari untuk dengan atau ini itu ada saya aku kamu kita kami dia mereka kak kakak ' +
    'customer pelanggan pembeli user pengguna ketika saat jika kalau apabila bila ingin mau meminta minta ' +
    'menanyakan tanya bertanya nanya apa apakah berapa bagaimana gimana kapan dimana mana siapa kenapa ' +
    'bisa boleh tolong mohon dong ya sih nih deh kah lah juga sudah belum akan lagi saja aja pun oleh ' +
    'pada dalam agar supaya tapi tetapi karena jadi label pindahkan ubah status nya ' +
    'hari sekarang besok kemarin nanti tadi ' +
    // English
    'the a an and or to of in on at for with from by is are was were be been it this that these those ' +
    'i you he she we they my your our their me us asks ask asking wants want when if then please can ' +
    'could would should do does did what how where which who why much many any some move set apply ' +
    'today now tomorrow yesterday'
  ).split(/\s+/),
);

const GREETINGS = new Set(
  'halo hallo helo hai hi hello hey pagi siang sore malam selamat permisi assalamualaikum salam p min gan sis kak good morning afternoon evening'.split(
    ' ',
  ),
);
const THANKS = /\b(terima ?kasih|makasih|thanks|thank you|thx|tq)\b/i;

const ID_MARKERS = new Set(
  'apa apakah berapa bagaimana gimana bisa saya aku kak mau ingin dong ya yang dan ini itu ada tidak gak nggak enggak harga kirim terima kasih makasih halo selamat pagi siang sore malam barang beli bayar sama'.split(
    ' ',
  ),
);
const EN_MARKERS = new Set(
  'what how when where can could would is are do does the you your my i price hello hi thanks thank please want need'.split(
    ' ',
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2);
}

function contentTokens(text: string): string[] {
  return [...new Set(tokenize(text).filter((t) => !STOPWORDS.has(t) && !GREETINGS.has(t)))];
}

/** Loose match so "transfernya" hits "transfer" and "bicara" hits "berbicara". */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  return a.includes(b) || b.includes(a);
}

function hasToken(tokens: string[], keyword: string): boolean {
  return tokens.some((t) => tokensMatch(t, keyword));
}

export function detectLanguage(text: string): ChatLanguage {
  let id = 0;
  let en = 0;
  for (const token of tokenize(text)) {
    if (ID_MARKERS.has(token)) id += 1;
    if (EN_MARKERS.has(token)) en += 1;
  }
  return en > id ? 'en' : 'id';
}

function conditionLines(text: string): string[] {
  return text
    .split(/\n|(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** A condition line matches when enough of its keywords appear in the message. */
function lineMatches(line: string, messageTokens: string[], exclude: string[] = []): boolean {
  const excluded = new Set(exclude);
  const keywords = contentTokens(line).filter((k) => !excluded.has(k));
  if (keywords.length === 0) return false;
  const hits = keywords.filter((k) => hasToken(messageTokens, k)).length;
  return hits >= (keywords.length <= 3 ? 1 : 2);
}

function matchesConditions(conditions: string, messageTokens: string[]): boolean {
  return conditionLines(conditions).some((line) => lineMatches(line, messageTokens));
}

/** Lines that mention `name`; when none do, the name itself is the condition. */
function actionMatches(name: string, conditions: string, messageTokens: string[]): boolean {
  const nameTokens = tokenize(name);
  const lines = conditionLines(conditions).filter((line) =>
    line.toLowerCase().includes(name.toLowerCase()),
  );
  if (lines.length === 0) return lineMatches(name, messageTokens);
  return lines.some((line) => lineMatches(line, messageTokens, nameTokens));
}

// ---------------------------------------------------------------------------
// Knowledge retrieval
// ---------------------------------------------------------------------------

export interface KnowledgeChunk {
  id: string;
  kind: 'QNA' | 'PRODUCT' | 'CATALOG' | 'TEXT' | 'FILE';
  source: string;
  answer: string;
  /** Tokens that carry full weight (a Q&A question, a product name…). */
  primary: string[];
  /** Tokens that carry partial weight (a Q&A answer, product description…). */
  secondary: string[];
}

const KIND_PRIORITY: Record<KnowledgeChunk['kind'], number> = {
  QNA: 0,
  PRODUCT: 1,
  CATALOG: 2,
  TEXT: 3,
  FILE: 4,
};

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => (p.length <= 800 ? [p] : (p.match(/[^.!?]+[.!?]*\s*/g) ?? [p])))
    .map((p) => p.trim())
    .filter(Boolean);
}

function sectionAnswer(section: string): string {
  const lines = section.split('\n').map((l) => l.trim());
  const body = lines.filter((l) => !l.startsWith('#'));
  return truncate((body.length > 0 ? body : lines).join('\n').replace(/^#+\s*/gm, ''), 600);
}

function productAnswer(product: AiAgentKnowledge['products'][number], lang: ChatLanguage): string {
  const stock =
    product.stock > 0 ? String(product.stock) : lang === 'id' ? 'habis' : 'out of stock';
  const weight = `${new Intl.NumberFormat('id-ID').format(product.weightGrams)} ${lang === 'id' ? 'gram' : 'g'}`;
  const details =
    lang === 'id'
      ? `Harga: ${formatRupiah(product.price)} · Stok: ${stock} · Berat: ${weight}`
      : `Price: ${formatRupiah(product.price)} · Stock: ${stock} · Weight: ${weight}`;
  return `${product.name}\n${product.description}\n${details}`;
}

export function buildKnowledgeIndex(
  knowledge: AiAgentKnowledge,
  lang: ChatLanguage = 'id',
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  for (const pair of knowledge.qna) {
    if (!pair.question.trim() || !pair.answer.trim()) continue;
    chunks.push({
      id: pair.id,
      kind: 'QNA',
      source: `Q&A: ${truncate(pair.question.trim(), 48)}`,
      answer: pair.answer.trim(),
      primary: contentTokens(pair.question),
      secondary: contentTokens(pair.answer),
    });
  }

  for (const product of knowledge.products) {
    chunks.push({
      id: product.id,
      kind: 'PRODUCT',
      source: `Product: ${product.name}`,
      answer: productAnswer(product, lang),
      primary: contentTokens(product.name),
      secondary: contentTokens(`${product.description} harga price stok stock`),
    });
  }

  if (knowledge.products.length > 0) {
    const names = knowledge.products.slice(0, 6).map((p) => p.name);
    chunks.push({
      id: 'catalog',
      kind: 'CATALOG',
      source: 'Products',
      answer:
        lang === 'id'
          ? `Produk yang tersedia: ${names.join(', ')}. Mau info produk yang mana, kak?`
          : `Available products: ${names.join(', ')}. Which one would you like to know about?`,
      primary: contentTokens('produk katalog daftar jual jualan product products catalog sell'),
      secondary: [],
    });
  }

  for (const doc of knowledge.texts) {
    paragraphs(htmlToText(doc.content)).forEach((section, i) => {
      chunks.push({
        id: `${doc.id}_${i}`,
        kind: 'TEXT',
        source: `Text: ${doc.title}`,
        answer: sectionAnswer(section),
        primary: contentTokens(section.split('\n')[0] ?? ''),
        secondary: contentTokens(section),
      });
    });
  }

  for (const file of knowledge.files) {
    paragraphs(file.content).forEach((section, i) => {
      chunks.push({
        id: `${file.id}_${i}`,
        kind: 'FILE',
        source: `File: ${file.name}`,
        answer: sectionAnswer(section),
        primary: [],
        secondary: contentTokens(section),
      });
    });
  }

  return chunks;
}

export interface RankedChunk {
  chunk: KnowledgeChunk;
  score: number;
}

const MATCH_THRESHOLD = 0.5;

/**
 * Scores each chunk by the share of the query's known keywords it contains,
 * weighting rarer keywords higher. Words that appear in no chunk do not lower
 * the score, but at least half of the query's keywords must match so one
 * common word cannot pull in an unrelated answer.
 */
export function rankKnowledge(chunks: KnowledgeChunk[], query: string): RankedChunk[] {
  const queryTokens = contentTokens(query);
  if (queryTokens.length === 0 || chunks.length === 0) return [];

  const df = new Map<string, number>();
  for (const token of queryTokens) {
    df.set(
      token,
      chunks.filter((c) => hasToken(c.primary, token) || hasToken(c.secondary, token)).length,
    );
  }
  const known = queryTokens.filter((t) => (df.get(t) ?? 0) > 0);
  if (known.length === 0) return [];

  const idf = (t: string) => Math.log(1 + chunks.length / (df.get(t) ?? 1));
  const total = known.reduce((sum, t) => sum + idf(t), 0);

  return chunks
    .map((chunk) => {
      let matched = 0;
      let hits = 0;
      for (const t of known) {
        if (hasToken(chunk.primary, t)) matched += idf(t);
        else if (hasToken(chunk.secondary, t)) matched += idf(t) * 0.8;
        else continue;
        hits += 1;
      }
      return { chunk, score: matched / total, coverage: hits / queryTokens.length };
    })
    .filter((r) => r.score >= MATCH_THRESHOLD && r.coverage >= MATCH_THRESHOLD)
    .map(({ chunk, score }) => ({ chunk, score }))
    .sort((a, b) => b.score - a.score || KIND_PRIORITY[a.chunk.kind] - KIND_PRIORITY[b.chunk.kind]);
}

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------

function hourIn(timezone: string, now: Date): number {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: timezone,
    }).format(now);
    return Number.parseInt(hour, 10);
  } catch {
    return now.getUTCHours();
  }
}

export function greetingFor(timezone: string, now: Date, lang: ChatLanguage): string {
  const hour = hourIn(timezone, now);
  if (lang === 'en') {
    const part =
      hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
    return `Good ${part}! How can I help you?`;
  }
  const part =
    hour >= 4 && hour < 11
      ? 'pagi'
      : hour >= 11 && hour < 15
        ? 'siang'
        : hour >= 15 && hour < 18
          ? 'sore'
          : 'malam';
  return `Selamat ${part} kak! Ada yang bisa aku bantu?`;
}

const PHRASES = {
  handoff: {
    id: 'Baik kak, percakapan ini aku teruskan ke tim kami ya. Mohon ditunggu sebentar 🙏',
    en: "Sure, I'm passing this conversation to our team. Please wait a moment 🙏",
  },
  fallback: {
    id: 'Maaf kak, aku belum punya informasi soal itu. Kalau perlu, aku bisa teruskan ke tim kami ya.',
    en: "Sorry, I don't have information about that yet. I can pass this to our team if you like.",
  },
  thanks: {
    id: 'Sama-sama kak! Senang bisa membantu 😊',
    en: "You're welcome! Happy to help 😊",
  },
  closing: { id: 'Ada lagi yang bisa aku bantu, kak?', en: 'Anything else I can help with?' },
  creativeOpen: { id: 'Siap kak! 😊', en: 'Sure thing! 😊' },
  creativeClose: {
    id: 'Kalau masih ada yang mau ditanyakan, bilang aja ya ✨',
    en: 'Just let me know if there is anything else ✨',
  },
} as const;

function styleAnswer(answer: string, settings: AiAgentGeneralSettings, lang: ChatLanguage): string {
  switch (settings.temperature) {
    case 'PRECISE':
      return answer;
    case 'CREATIVE':
      return `${PHRASES.creativeOpen[lang]}\n${answer}\n\n${PHRASES.creativeClose[lang]}`;
    default:
      return `${answer}\n\n${PHRASES.closing[lang]}`;
  }
}

function reply(kind: ReplyKind, text: string, sources: string[] = [], image: string | null = null) {
  return { kind, text, image, sources } satisfies EngineReply;
}

function applyActions(
  input: EngineInput,
  tokens: string[],
  state: ConversationState,
  events: EngineEvent[],
): void {
  const { settings, pipeline } = input;

  for (const label of settings.allowedLabels) {
    if (state.labels.includes(label)) continue;
    if (actionMatches(label, settings.labelConditions, tokens)) {
      state.labels.push(label);
      events.push({ type: 'LABEL', label });
    }
  }

  const currentIndex = state.pipelineStatus ? pipeline.indexOf(state.pipelineStatus) : 0;
  let target: string | null = null;
  for (const [index, status] of pipeline.entries()) {
    if (index <= currentIndex || !settings.allowedPipelineStatuses.includes(status)) continue;
    // Keep the furthest status that matches; the AI never moves a chat backwards.
    if (actionMatches(status, settings.pipelineConditions, tokens)) target = status;
  }
  if (target !== null) {
    events.push({
      type: 'PIPELINE',
      from: state.pipelineStatus ?? pipeline[0] ?? null,
      to: target,
    });
    state.pipelineStatus = target;
  }
}

export function runPreviewEngine(input: EngineInput): EngineResult {
  const { settings, knowledge, now } = input;
  const state: ConversationState = { ...input.state, labels: [...input.state.labels] };
  const replies: EngineReply[] = [];
  const events: EngineEvent[] = [];
  const text = input.incoming.join('\n').trim();
  const done = () => ({ replies, events, state });

  if (!text) return done();

  const lang = detectLanguage(text);
  const tokens = tokenize(text);

  // A pending chat is waiting for a human agent.
  if (state.status === 'PENDING' && (state.silenced || settings.stopAfterHandoff)) {
    applyActions(input, tokens, state, events);
    const pending = state.assigned
      ? settings.pendingAssignedMessage
      : settings.pendingUnassignedMessage;
    if (!state.silenced && pending.trim()) replies.push(reply('PENDING', pending.trim()));
    events.push({ type: 'WAITING_FOR_AGENT' });
    return done();
  }

  if (state.aiMessageCount >= settings.messageLimit) {
    events.push({ type: 'MESSAGE_LIMIT', limit: settings.messageLimit });
    return done();
  }

  applyActions(input, tokens, state, events);

  if (!state.welcomed) {
    state.welcomed = true;
    if (settings.welcomeMessage.trim() || settings.welcomeImage) {
      replies.push(reply('WELCOME', settings.welcomeMessage.trim(), [], settings.welcomeImage));
    }
  }

  if (state.status === 'OPEN' && matchesConditions(settings.transferConditions, tokens)) {
    state.status = 'PENDING';
    if (settings.silentHandoff) {
      state.silenced = true;
      events.push({ type: 'HANDOFF', silent: true });
      return done();
    }
    replies.push(reply('HANDOFF', PHRASES.handoff[lang]));
    state.aiMessageCount += 1;
    events.push({ type: 'HANDOFF', silent: false });
    return done();
  }

  const isGreetingOnly = tokens.length > 0 && tokens.every((t) => GREETINGS.has(t));
  if (isGreetingOnly) {
    // The welcome message already answers a plain greeting.
    if (replies.length === 0) {
      replies.push(reply('GREETING', greetingFor(settings.timezone, now, lang)));
      state.aiMessageCount += 1;
    }
    return done();
  }

  if (THANKS.test(text) && contentTokens(text.replace(THANKS, '')).length === 0) {
    replies.push(reply('ANSWER', PHRASES.thanks[lang]));
    state.aiMessageCount += 1;
    return done();
  }

  const index = buildKnowledgeIndex(knowledge, lang);
  let ranked = rankKnowledge(index, text);

  // Follow-ups ("stoknya ada?") are empty or ambiguous on their own, so lean on
  // what the customer said earlier, within the history limit.
  const ambiguous = ranked.length > 1 && ranked[0]?.score === ranked[1]?.score;
  if (ranked.length === 0 || ambiguous) {
    const remembered = input.history
      .slice(-settings.historyLimit)
      .filter((turn) => turn.role === 'customer')
      .slice(-2)
      .map((turn) => turn.text);
    if (remembered.length > 0) {
      const withHistory = rankKnowledge(index, [...remembered, text].join('\n'));
      if (withHistory.length > 0) ranked = withHistory;
    }
  }

  const retrieved = ranked.slice(0, settings.contextLimit);
  const best = retrieved[0];
  if (!best) {
    replies.push(reply('FALLBACK', PHRASES.fallback[lang]));
  } else {
    const sources = [...new Set(retrieved.slice(0, 3).map((r) => r.chunk.source))];
    replies.push(reply('ANSWER', styleAnswer(best.chunk.answer, settings, lang), sources));
  }
  state.aiMessageCount += 1;
  return done();
}
