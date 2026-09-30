import { z } from 'zod';

/** Local development sign-in (shared with the OpenAPI document). */

export const DevSessionRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().default('admin@vynor.local'),
});
export type DevSessionRequest = z.infer<typeof DevSessionRequestSchema>;

export interface DevSessionResponse {
  accessToken: string;
  expiresAt: string;
  user: { id: string; email: string; displayName: string };
}
