import { describe, it, expect } from 'vitest';
import {
  validateEnv,
  ConfigurationError,
  ApiEnvSchema,
  WorkerEnvSchema,
  redactObject,
  maskEmail,
  maskPhone,
  REDACTED_PLACEHOLDER,
  PINO_REDACT_PATHS,
  SENSITIVE_KEY_NAMES,
} from '../src/index.js';
import { redactHeaders } from '@vynor/observability';

describe('Configuration Validation (FND-017 & FND-TST-007)', () => {
  const validApiEnv = {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    LOG_LEVEL: 'info',
    PORT: '3001',
    APP_URL: 'http://localhost:3001',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5434/vynor?schema=public',
    DIRECT_URL: 'postgresql://postgres:postgres@localhost:5434/vynor?schema=public',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_JWT_SECRET: 'super-secret-jwt-signing-key-for-test-32chars',
    STORAGE_ENDPOINT: 'http://localhost:9000',
    STORAGE_ACCESS_KEY_ID: 'test-storage-key',
    STORAGE_SECRET_ACCESS_KEY: 'test-storage-secret',
    STORAGE_USE_SSL: 'false',
  };

  const validWorkerEnv = {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5434/vynor?schema=public',
    DIRECT_URL: 'postgresql://postgres:postgres@localhost:5434/vynor?schema=public',
    STORAGE_ENDPOINT: 'http://localhost:9000',
    STORAGE_ACCESS_KEY_ID: 'test-storage-key',
    STORAGE_SECRET_ACCESS_KEY: 'test-storage-secret',
    STORAGE_USE_SSL: 'false',
  };

  it('validates a complete, valid API environment configuration and applies defaults', () => {
    const config = validateEnv(ApiEnvSchema, validApiEnv);

    expect(config.NODE_ENV).toBe('test');
    expect(config.APP_ENV).toBe('test');
    expect(config.PORT).toBe(3001);
    expect(typeof config.PORT).toBe('number');
    expect(config.STORAGE_USE_SSL).toBe(false);
    expect(config.STORAGE_BUCKET).toBe('vynor-crm-attachments');
    expect(config.DATABASE_URL).toBe(validApiEnv.DATABASE_URL);
  });

  it('validates a complete, valid Worker environment configuration', () => {
    const config = validateEnv(WorkerEnvSchema, validWorkerEnv);

    expect(config.PG_BOSS_SCHEMA).toBe('pgboss');
    expect(config.PG_BOSS_RETENTION_DAYS).toBe(14);
    expect(config.STORAGE_REGION).toBe('us-east-1');
  });

  it('throws ConfigurationError with field details when mandatory variables are missing', () => {
    const incompleteEnv = {
      NODE_ENV: 'test',
    };

    expect(() => validateEnv(ApiEnvSchema, incompleteEnv)).toThrow(ConfigurationError);

    try {
      validateEnv(ApiEnvSchema, incompleteEnv);
    } catch (err) {
      const configErr = err as ConfigurationError;
      expect(configErr.name).toBe('ConfigurationError');
      expect(configErr.errors).toBeDefined();
      expect(configErr.errors['DATABASE_URL']).toBeDefined();
      expect(configErr.errors['SUPABASE_URL']).toBeDefined();
      expect(configErr.errors['SUPABASE_JWT_SECRET']).toBeDefined();
      expect(configErr.errors['STORAGE_ACCESS_KEY_ID']).toBeDefined();
    }
  });

  it('rejects invalid URL formats for SUPABASE_URL', () => {
    const invalidUrlEnv = {
      ...validApiEnv,
      SUPABASE_URL: 'not-a-valid-http-url',
    };

    expect(() => validateEnv(ApiEnvSchema, invalidUrlEnv)).toThrow(ConfigurationError);

    try {
      validateEnv(ApiEnvSchema, invalidUrlEnv);
    } catch (err) {
      const configErr = err as ConfigurationError;
      expect(configErr.errors['SUPABASE_URL']).toBeDefined();
    }
  });

  it('rejects invalid enum values for NODE_ENV and LOG_LEVEL', () => {
    const invalidEnumEnv = {
      ...validApiEnv,
      NODE_ENV: 'invalid_mode',
      LOG_LEVEL: 'super_verbose',
    };

    expect(() => validateEnv(ApiEnvSchema, invalidEnumEnv)).toThrow(ConfigurationError);

    try {
      validateEnv(ApiEnvSchema, invalidEnumEnv);
    } catch (err) {
      const configErr = err as ConfigurationError;
      expect(configErr.errors['NODE_ENV']).toBeDefined();
      expect(configErr.errors['LOG_LEVEL']).toBeDefined();
    }
  });

  it('coerces numeric and boolean strings correctly', () => {
    const customTypesEnv = {
      ...validApiEnv,
      PORT: '8080',
      STORAGE_USE_SSL: 'true',
    };

    const config = validateEnv(ApiEnvSchema, customTypesEnv);
    expect(config.PORT).toBe(8080);
    expect(config.STORAGE_USE_SSL).toBe(true);
  });
});

describe('Sensitive Field Redaction (FND-046 & FND-TST-007)', () => {
  it('redacts sensitive keys in flat and deeply nested objects', () => {
    const unredacted = {
      id: 'msg_123',
      userId: 'usr_abc',
      password: 'PlaintextPassword123!',
      nested: {
        accessToken: 'eyJh...super-secret-token',
        clientSecret: 'secret_abc_xyz',
        metadata: {
          creditCard: '4111222233334444',
          cvv: '123',
          safeField: 'visible-metadata',
        },
      },
      tags: ['crm', 'priority'],
    };

    const redacted = redactObject(unredacted);

    // Sensitive fields must be replaced with [REDACTED]
    expect(redacted.password).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.nested.accessToken).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.nested.clientSecret).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.nested.metadata.creditCard).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.nested.metadata.cvv).toBe(REDACTED_PLACEHOLDER);

    // Non-sensitive fields must remain untouched
    expect(redacted.id).toBe('msg_123');
    expect(redacted.userId).toBe('usr_abc');
    expect(redacted.nested.metadata.safeField).toBe('visible-metadata');
    expect(redacted.tags).toEqual(['crm', 'priority']);
  });

  it('redacts sensitive objects inside arrays', () => {
    const payloadWithArray = {
      batch: [
        { id: 1, apiKey: 'key_111', role: 'admin' },
        { id: 2, apiKey: 'key_222', role: 'agent' },
      ],
    };

    const redacted = redactObject(payloadWithArray);

    expect(redacted.batch[0]?.apiKey).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.batch[0]?.role).toBe('admin');
    expect(redacted.batch[1]?.apiKey).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.batch[1]?.role).toBe('agent');
  });

  it('redacts HTTP headers containing sensitive auth/cookie tokens', () => {
    const headers = {
      'content-type': 'application/json',
      'x-correlation-id': 'corr_req_999',
      authorization: 'Bearer eyJhbGciOi...',
      cookie: 'sb-access-token=xyz; session=123',
      'set-cookie': ['token=xyz; Path=/'],
      'x-api-key': 'secret-api-key',
      'user-agent': 'VynorClient/1.0',
    };

    const redacted = redactHeaders(headers);

    expect(redacted['authorization']).toBe(REDACTED_PLACEHOLDER);
    expect(redacted['cookie']).toBe(REDACTED_PLACEHOLDER);
    expect(redacted['set-cookie']).toBe(REDACTED_PLACEHOLDER);
    expect(redacted['x-api-key']).toBe(REDACTED_PLACEHOLDER);

    expect(redacted['content-type']).toBe('application/json');
    expect(redacted['x-correlation-id']).toBe('corr_req_999');
    expect(redacted['user-agent']).toBe('VynorClient/1.0');
  });

  it('masks email addresses preserving first/last characters and domain', () => {
    expect(maskEmail('contact@vynor.com')).toBe('c***t@vynor.com');
    expect(maskEmail('j@example.com')).toBe('j***@example.com');
    expect(maskEmail('ab@example.com')).toBe('a***@example.com');
    expect(maskEmail('invalid-email')).toBe(REDACTED_PLACEHOLDER);
    expect(maskEmail('')).toBe(REDACTED_PLACEHOLDER);
  });

  it('masks phone numbers preserving country prefix and last 4 digits', () => {
    expect(maskPhone('+6281234567890')).toBe('+6281****7890');
    expect(maskPhone('12345')).toBe(REDACTED_PLACEHOLDER);
    expect(maskPhone('')).toBe(REDACTED_PLACEHOLDER);
  });

  it('verifies canonical sensitive keys and pino redact paths are configured', () => {
    expect(SENSITIVE_KEY_NAMES).toContain('password');
    expect(SENSITIVE_KEY_NAMES).toContain('token');
    expect(SENSITIVE_KEY_NAMES).toContain('secret');
    expect(SENSITIVE_KEY_NAMES).toContain('authorization');
    expect(SENSITIVE_KEY_NAMES).toContain('apikey');

    expect(PINO_REDACT_PATHS).toContain('*.password');
    expect(PINO_REDACT_PATHS).toContain('*.token');
    expect(PINO_REDACT_PATHS).toContain('*.accessToken');
    expect(PINO_REDACT_PATHS).toContain('req.headers.authorization');
    expect(PINO_REDACT_PATHS).toContain('req.headers.cookie');
  });
});
