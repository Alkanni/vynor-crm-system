import { z } from 'zod';

/** Public Web Live Chat request and response shapes (shared with the OpenAPI document). */

export const WebchatSessionRequestSchema = z.object({
  visitorId: z
    .string()
    .regex(/^v_[A-Za-z0-9_-]{8,64}$/)
    .optional(),
  visitorToken: z.string().max(128).optional(),
});
export type WebchatSessionRequest = z.infer<typeof WebchatSessionRequestSchema>;

export const WebchatMessageRequestSchema = z.object({
  visitorId: z.string().regex(/^v_[A-Za-z0-9_-]{8,64}$/),
  clientMessageId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
  text: z.string().trim().min(1).max(4096),
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(255).optional(),
  pageUrl: z.string().url().max(2048).optional(),
});
export type WebchatMessageRequest = z.infer<typeof WebchatMessageRequestSchema>;

export interface WebchatConfig {
  name: string;
  welcomeMessage: string | null;
  accentColor: string;
}

export interface WebchatMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  text: string;
  senderName: string | null;
  createdAt: string;
}
