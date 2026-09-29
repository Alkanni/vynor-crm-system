import {
  AI_AGENT_LIMITS,
  AiAgentSchema,
  CreateAiAgentRequestSchema,
  UpdateAiAgentRequestSchema,
  type AiAgent,
  type CreateAiAgentRequest,
  type UpdateAiAgentRequest,
} from '@vynor/contracts';
import { createId, newAgentRecord, seedAgents } from './defaults';

/**
 * Persistence boundary for AI agents. The hooks in `queries.ts` only talk to
 * this interface, so swapping the browser implementation for the apps/api
 * endpoints does not touch any component.
 */
export interface AiAgentRepository {
  list(): Promise<AiAgent[]>;
  get(id: string): Promise<AiAgent | null>;
  create(input: CreateAiAgentRequest): Promise<AiAgent>;
  update(id: string, patch: UpdateAiAgentRequest): Promise<AiAgent>;
  duplicate(id: string): Promise<AiAgent>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = 'vynor.ai-agents.v1';

// Used when localStorage is blocked (private mode, disabled site data).
let memoryFallback: AiAgent[] | null = null;

function readAll(): AiAgent[] {
  if (typeof window === 'undefined') return seedAgents();

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    memoryFallback ??= seedAgents();
    return memoryFallback;
  }

  if (raw === null) {
    const seeded = memoryFallback ?? seedAgents();
    writeAll(seeded);
    return seeded;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop records that no longer match the contract instead of crashing the page.
    return parsed.flatMap((item) => {
      const result = AiAgentSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

function writeAll(agents: AiAgent[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
    memoryFallback = null;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('Browser storage is full. Remove large files or images, then save again.', {
        cause: error,
      });
    }
    memoryFallback = agents;
  }
}

function requireAgent(agents: AiAgent[], id: string): AiAgent {
  const agent = agents.find((a) => a.id === id);
  if (!agent) throw new Error('This AI agent no longer exists.');
  return agent;
}

export const localAiAgentRepository: AiAgentRepository = {
  async list() {
    return readAll();
  },

  async get(id) {
    return readAll().find((a) => a.id === id) ?? null;
  },

  async create(input) {
    const { name } = CreateAiAgentRequestSchema.parse(input);
    const agent = newAgentRecord(name);
    writeAll([...readAll(), agent]);
    return agent;
  },

  async update(id, patch) {
    const changes = UpdateAiAgentRequestSchema.parse(patch);
    const agents = readAll();
    const current = requireAgent(agents, id);
    const now = new Date().toISOString();
    const next = AiAgentSchema.parse({
      ...current,
      ...changes,
      updatedAt: now,
      lastTrainedAt: changes.knowledge ? now : current.lastTrainedAt,
    });
    writeAll(agents.map((a) => (a.id === id ? next : a)));
    return next;
  },

  async duplicate(id) {
    const agents = readAll();
    const source = requireAgent(agents, id);
    const now = new Date().toISOString();
    const copy: AiAgent = {
      ...structuredClone(source),
      id: createId('ai'),
      name: `${source.name} (copy)`.slice(0, AI_AGENT_LIMITS.nameMax),
      createdAt: now,
      updatedAt: now,
    };
    writeAll([...agents, copy]);
    return copy;
  },

  async remove(id) {
    writeAll(readAll().filter((a) => a.id !== id));
  },
};
