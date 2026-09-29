import { z } from 'zod';

/**
 * AI agent configuration contracts (AD-011, AD-013).
 *
 * The same schemas validate what the web app stores today and what the AI
 * agent endpoints in apps/api will accept once they exist.
 */

export const AI_AGENT_LIMITS = {
  nameMax: 80,
  behaviorMax: 15000,
  welcomeMessageMax: 5000,
  transferConditionsMax: 3000,
  pendingMessageMax: 200,
  actionConditionsMax: 3000,
  /** Welcome image stored inline as a data URL until object storage is wired (≈1 MB file). */
  welcomeImageMax: 1_400_000,
  textDocTitleMax: 60,
  textDocContentMax: 2_000_000,
  qnaQuestionMax: 1000,
  qnaAnswerMax: 5000,
  fileContentMax: 500_000,
} as const;

export const AI_MODEL_TIERS = ['BASIC', 'STANDARD', 'STANDARD_PLUS', 'PREMIUM'] as const;
export const AiModelTierSchema = z.enum(AI_MODEL_TIERS);
export type AiModelTier = z.infer<typeof AiModelTierSchema>;

export const AI_TEMPERATURE_LEVELS = ['PRECISE', 'BALANCED', 'CREATIVE'] as const;
export const AiTemperatureLevelSchema = z.enum(AI_TEMPERATURE_LEVELS);
export type AiTemperatureLevel = z.infer<typeof AiTemperatureLevelSchema>;

export const AI_AGENT_STATUSES = ['ACTIVE', 'PAUSED'] as const;
export const AiAgentStatusSchema = z.enum(AI_AGENT_STATUSES);
export type AiAgentStatus = z.infer<typeof AiAgentStatusSchema>;

export const AiAgentGeneralSettingsSchema = z.object({
  behavior: z.string().max(AI_AGENT_LIMITS.behaviorMax),
  welcomeMessage: z.string().max(AI_AGENT_LIMITS.welcomeMessageMax),
  welcomeImage: z.string().max(AI_AGENT_LIMITS.welcomeImageMax).nullable(),
  transferConditions: z.string().max(AI_AGENT_LIMITS.transferConditionsMax),
  stopAfterHandoff: z.boolean(),
  silentHandoff: z.boolean(),
  pendingAssignedMessage: z.string().max(AI_AGENT_LIMITS.pendingMessageMax),
  pendingUnassignedMessage: z.string().max(AI_AGENT_LIMITS.pendingMessageMax),
  allowedLabels: z.array(z.string().min(1).max(50)).max(50),
  labelConditions: z.string().max(AI_AGENT_LIMITS.actionConditionsMax),
  allowedPipelineStatuses: z.array(z.string().min(1).max(50)).max(20),
  pipelineConditions: z.string().max(AI_AGENT_LIMITS.actionConditionsMax),
  model: AiModelTierSchema,
  historyLimit: z.number().int().min(1).max(100),
  readFileLimit: z.number().int().min(0).max(20),
  contextLimit: z.number().int().min(1).max(100),
  temperature: AiTemperatureLevelSchema,
  messageAwaitSeconds: z.number().int().min(0).max(120),
  messageLimit: z.number().int().min(1).max(200),
  watcherEnabled: z.boolean(),
  /** IANA time zone, e.g. `Asia/Jakarta`. */
  timezone: z.string().min(1).max(64),
  sessionOnlyMemory: z.boolean(),
});
export type AiAgentGeneralSettings = z.infer<typeof AiAgentGeneralSettingsSchema>;

export const KnowledgeTextDocSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(AI_AGENT_LIMITS.textDocTitleMax),
  /** Sanitised rich-text HTML from the knowledge editor. */
  content: z.string().max(AI_AGENT_LIMITS.textDocContentMax),
});
export type KnowledgeTextDoc = z.infer<typeof KnowledgeTextDocSchema>;

export const KNOWLEDGE_LINK_MODES = ['BATCH', 'SINGLE'] as const;
export const KNOWLEDGE_LINK_STATUSES = ['QUEUED', 'TRAINED', 'FAILED'] as const;

export const KnowledgeLinkSchema = z.object({
  id: z.string().min(1),
  // Rendered as a link, so only web URLs are accepted (no javascript:, data:, …).
  url: z
    .string()
    .url()
    .max(2048)
    .regex(/^https?:\/\//i, 'Use an http or https link.'),
  mode: z.enum(KNOWLEDGE_LINK_MODES),
  status: z.enum(KNOWLEDGE_LINK_STATUSES),
  characters: z.number().int().min(0),
  addedAt: z.string().datetime(),
});
export type KnowledgeLink = z.infer<typeof KnowledgeLinkSchema>;

export const KnowledgeFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  sizeBytes: z.number().int().min(0),
  /** Plain text extracted from the file. */
  content: z.string().max(AI_AGENT_LIMITS.fileContentMax),
  addedAt: z.string().datetime(),
});
export type KnowledgeFile = z.infer<typeof KnowledgeFileSchema>;

export const KnowledgeQnaSchema = z.object({
  id: z.string().min(1),
  question: z.string().max(AI_AGENT_LIMITS.qnaQuestionMax),
  answer: z.string().max(AI_AGENT_LIMITS.qnaAnswerMax),
});
export type KnowledgeQna = z.infer<typeof KnowledgeQnaSchema>;

export const KnowledgeProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(5000),
  weightGrams: z.number().min(0),
  stock: z.number().int().min(0),
  /** Price in IDR. */
  price: z.number().min(0),
});
export type KnowledgeProduct = z.infer<typeof KnowledgeProductSchema>;

export const AiAgentKnowledgeSchema = z.object({
  texts: z.array(KnowledgeTextDocSchema).min(1),
  links: z.array(KnowledgeLinkSchema),
  files: z.array(KnowledgeFileSchema),
  qna: z.array(KnowledgeQnaSchema),
  products: z.array(KnowledgeProductSchema),
});
export type AiAgentKnowledge = z.infer<typeof AiAgentKnowledgeSchema>;

export const AiAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(AI_AGENT_LIMITS.nameMax),
  status: AiAgentStatusSchema,
  general: AiAgentGeneralSettingsSchema,
  knowledge: AiAgentKnowledgeSchema,
  lastTrainedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AiAgent = z.infer<typeof AiAgentSchema>;

export const CreateAiAgentRequestSchema = z.object({
  name: z.string().trim().min(1).max(AI_AGENT_LIMITS.nameMax),
});
export type CreateAiAgentRequest = z.infer<typeof CreateAiAgentRequestSchema>;

export const UpdateAiAgentRequestSchema = z.object({
  name: z.string().trim().min(1).max(AI_AGENT_LIMITS.nameMax).optional(),
  status: AiAgentStatusSchema.optional(),
  general: AiAgentGeneralSettingsSchema.optional(),
  /** Saving knowledge retrains the agent and moves `lastTrainedAt`. */
  knowledge: AiAgentKnowledgeSchema.optional(),
});
export type UpdateAiAgentRequest = z.infer<typeof UpdateAiAgentRequestSchema>;
