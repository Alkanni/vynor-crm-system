import type { ApiErrorResponse, ApiSuccessResponse } from '@vynor/contracts';
import { env } from '@/env';

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly correlationId: string;
  public readonly details?: Record<string, unknown>;

  constructor(payload: ApiErrorResponse) {
    super(payload.message || 'An API error occurred');
    this.name = 'ApiClientError';
    this.statusCode = payload.statusCode;
    this.code = payload.code;
    this.correlationId = payload.correlationId;
    if (payload.details) {
      this.details = payload.details;
    }
  }
}

export interface ApiRequestOptions extends RequestInit {
  workspaceId?: string;
  token?: string;
  correlationId?: string;
}

/**
 * Universal typed API fetcher adhering to RFC-7807 and VYNOR envelope standards (FND-FE-004, FND-037).
 */
export async function fetchApi<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const url = `${baseUrl}${normalizedPath}`;

  const headers = new Headers(options.headers);

  // Set default content type
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Set correlation ID
  const correlationId =
    options.correlationId || `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  headers.set('x-correlation-id', correlationId);

  // Set Bearer token if provided
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  // Set target workspace if provided
  if (options.workspaceId) {
    headers.set('x-workspace-id', options.workspaceId);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle empty 204 response
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorPayload: ApiErrorResponse = {
      statusCode: response.status,
      code: (data as Record<string, unknown>).code
        ? String((data as Record<string, unknown>).code)
        : `HTTP_${response.status}`,
      message: (data as Record<string, unknown>).message
        ? String((data as Record<string, unknown>).message)
        : response.statusText,
      correlationId:
        response.headers.get('x-correlation-id') || (data as Record<string, unknown>).correlationId
          ? String((data as Record<string, unknown>).correlationId)
          : correlationId,
      timestamp: new Date().toISOString(),
      ...(data && typeof (data as Record<string, unknown>).details === 'object'
        ? { details: (data as Record<string, unknown>).details as Record<string, unknown> }
        : {}),
    };

    throw new ApiClientError(errorPayload);
  }

  // Check if response is wrapped in ApiSuccessResponse envelope
  const successEnvelope = data as ApiSuccessResponse<T>;
  if (successEnvelope && typeof successEnvelope === 'object' && 'data' in successEnvelope) {
    return successEnvelope.data;
  }

  return data as T;
}

/**
 * Pre-configured API namespaces for common backend endpoints.
 */
export const api = {
  health: {
    live: () => fetchApi<{ status: string; service: string }>('/health/live'),
    ready: () =>
      fetchApi<{ status: string; service: string; dependencies: unknown }>('/health/ready'),
    system: () => fetchApi<Record<string, unknown>>('/health'),
    indicators: () => fetchApi<Record<string, unknown>>('/health/indicators'),
  },
  attachments: {
    getDownloadUrl: (id: string, ttl?: number, options?: ApiRequestOptions) => {
      const query = ttl ? `?ttl=${ttl}` : '';
      return fetchApi<{
        attachmentId: string;
        filename: string;
        contentType: string;
        mimeType: string;
        sizeBytes: number;
        downloadUrl: string;
        expiresAt: string;
        expiresInSeconds: number;
      }>(`/attachments/${id}/download-url${query}`, options);
    },
  },
  openapi: {
    getSpec: () => fetchApi<Record<string, unknown>>('/openapi.json'),
    getErrorCatalog: () =>
      fetchApi<
        Array<{
          code: string;
          httpStatus: number;
          category: string;
          description: string;
          safeClientMessage: string;
          actionableGuidance: string;
        }>
      >('/error-catalog'),
  },
};
