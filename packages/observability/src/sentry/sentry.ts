import { redactHeaders, redactObject } from '../redact/redactor.js';

export interface SentryBoundaryConfig {
  dsn?: string;
  environment: string;
  service: 'vynor-web' | 'vynor-api' | 'vynor-worker';
  release?: string;
  tracesSampleRate: number;
}

export interface SentryEventScrubContext {
  correlationId?: string;
  workspaceId?: string;
  actorId?: string;
}

/**
 * Standard event scrubber to ensure zero PII/secret leaks into Sentry (FND-046, FND-047).
 */
export function scrubSentryEvent<T extends Record<string, unknown>>(
  event: T,
  ctx?: SentryEventScrubContext,
): T {
  const record: Record<string, unknown> = { ...event };

  // Scrub request headers and body if present
  if (record.request && typeof record.request === 'object') {
    const req: Record<string, unknown> = {
      ...(record.request as Record<string, unknown>),
    };
    if (req.headers && typeof req.headers === 'object') {
      req.headers = redactHeaders(req.headers as Record<string, unknown>);
    }
    if (req.data && typeof req.data === 'object') {
      req.data = redactObject(req.data);
    }
    record.request = req;
  }

  // Scrub breadcrumbs
  if (Array.isArray(record.breadcrumbs)) {
    record.breadcrumbs = record.breadcrumbs.map((crumb) => {
      if (crumb && typeof crumb === 'object' && 'data' in crumb) {
        const crumbObj = crumb as { data?: unknown };
        if (crumbObj.data) {
          return {
            ...crumbObj,
            data: redactObject(crumbObj.data),
          };
        }
      }
      return crumb;
    });
  }

  // Scrub extra context
  if (record.extra && typeof record.extra === 'object') {
    record.extra = redactObject(record.extra);
  }

  // Inject correlation tags
  const tags: Record<string, string> = {
    ...((record.tags as Record<string, string>) || {}),
  };

  if (ctx?.correlationId) {
    tags.correlationId = ctx.correlationId;
  }
  if (ctx?.workspaceId) {
    tags.workspaceId = ctx.workspaceId;
  }
  if (ctx?.actorId) {
    tags.actorId = ctx.actorId;
  }
  record.tags = tags;

  return record as T;
}

/**
 * Validates Sentry initialization parameters across web, API, and worker environments.
 */
export function getSentryInitConfig(config: SentryBoundaryConfig): SentryBoundaryConfig {
  const isProd = config.environment === 'production';

  const result: SentryBoundaryConfig = {
    environment: config.environment,
    service: config.service,
    tracesSampleRate: isProd ? 0.1 : 1.0,
  };

  if (config.dsn) {
    result.dsn = config.dsn;
  }
  if (config.release) {
    result.release = config.release;
  } else {
    result.release = '1.0.0';
  }

  return result;
}
