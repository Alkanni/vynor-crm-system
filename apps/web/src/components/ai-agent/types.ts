export type AIAgentState = 'AUTONOMOUS' | 'COPILOT' | 'HANDOFF_REQUIRED' | 'PAUSED' | 'ERROR';

export interface AIAgentConfiguration {
  id: string;
  name: string;
  state: AIAgentState;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  maxAutonomousTurns: number;
  confidenceThreshold: number;
  forbiddenKeywords: string[];
  assignedChannelIds: string[];
  operatingHours: string;
}

export interface PlaygroundMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  telemetry?:
    | {
        latencyMs: number;
        tokensPrompt: number;
        tokensCompletion: number;
        confidenceScore: number;
        retrievedCitations: string[];
        isHandoffTriggered: boolean;
      }
    | undefined;
}
