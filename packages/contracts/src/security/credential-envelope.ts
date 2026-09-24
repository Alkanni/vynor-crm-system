import { z } from 'zod';

export const SecretStorageTypeSchema = z.enum([
  'env',
  'vault',
  'encrypted_db',
  'aws_secrets_manager',
]);
export type SecretStorageType = z.infer<typeof SecretStorageTypeSchema>;

/**
 * Neutral reference to an externally or securely stored secret.
 */
export const SecretReferenceSchema = z.object({
  type: SecretStorageTypeSchema,
  key: z.string().min(1, 'Secret key is required'),
  version: z.string().optional(),
});
export type SecretReference = z.infer<typeof SecretReferenceSchema>;

export const ProviderTypeSchema = z.enum([
  'meta_whatsapp',
  'instagram',
  'facebook_messenger',
  'telegram',
  'email_smtp',
  'openai',
  'anthropic',
  'custom_webhook',
]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const AuthTypeSchema = z.enum([
  'bearer_token',
  'api_key',
  'oauth2',
  'hmac_key',
  'basic_auth',
]);
export type AuthType = z.infer<typeof AuthTypeSchema>;

/**
 * Standard encrypted envelope for channel and AI provider credentials.
 * Sensitive tokens are never stored in plaintext within business tables.
 */
export const ProviderCredentialEnvelopeSchema = z.object({
  provider: ProviderTypeSchema,
  accountId: z.string().min(1, 'Account ID is required'),
  authType: AuthTypeSchema,
  encryptedPayload: z
    .string()
    .min(1, 'Encrypted payload is required')
    .describe('AES-256-GCM ciphertext containing the sensitive JSON credentials'),
  keyId: z
    .string()
    .min(1, 'Encryption Key ID is required')
    .describe('ID/version of the encryption key used to encrypt the payload'),
  iv: z.string().min(1).describe('Initialization vector used for encryption'),
  tag: z.string().min(1).describe('Authentication tag from GCM cipher'),
  secretRef: SecretReferenceSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
  rotatedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type ProviderCredentialEnvelope = z.infer<typeof ProviderCredentialEnvelopeSchema>;

/**
 * Decrypted payload contract for Meta WhatsApp Cloud API credentials.
 */
export const WhatsAppCredentialsPayloadSchema = z.object({
  accessToken: z.string().min(1, 'Meta API Access Token is required'),
  phoneNumberId: z.string().min(1, 'WhatsApp Phone Number ID is required'),
  businessAccountId: z.string().min(1, 'WhatsApp Business Account ID is required'),
  appSecret: z.string().min(1, 'Meta App Secret is required for HMAC validation'),
  webhookVerifyToken: z.string().min(1, 'Webhook Verify Token is required'),
});
export type WhatsAppCredentialsPayload = z.infer<typeof WhatsAppCredentialsPayloadSchema>;
