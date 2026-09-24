import { createHash, createHmac } from 'node:crypto';
import type {
  DeleteObjectInput,
  GetObjectInput,
  GetObjectResult,
  PutObjectInput,
  PutObjectResult,
  S3CompatibleStorage,
  SignedDownloadInput,
  SignedDownloadResult,
  StatObjectResult,
  StorageClientConfig,
  StorageObjectLocation,
  StorageOperationOptions,
} from './storage-client.js';

export class RustFsStorageAdapter implements S3CompatibleStorage {
  private readonly endpoint: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly defaultBucket?: string;

  constructor(config: StorageClientConfig) {
    // Strip trailing slash from endpoint
    this.endpoint = config.endpoint.replace(/\/+$/, '');
    this.region = config.region || 'us-east-1';
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    if (config.defaultBucket) {
      this.defaultBucket = config.defaultBucket;
    }
  }

  /**
   * Generates an authorized AWS SigV4 presigned GET download URL (FND-BE-008, FND-075).
   */
  async createSignedDownload(input: SignedDownloadInput): Promise<SignedDownloadResult> {
    const bucket = input.location.bucket || this.defaultBucket;
    if (!bucket) {
      throw new Error('Storage bucket must be specified on location or configured default');
    }

    const key = input.location.key.replace(/^\/+/, '');
    const now = new Date();
    const isoDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = isoDate.substring(0, 8);

    const endpointUrl = new URL(this.endpoint);
    const hostHeader = endpointUrl.host;

    // Canonical URI: path style /<bucket>/<key>
    const encodedKey = key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const canonicalUri = `/${encodeURIComponent(bucket)}/${encodedKey}`;

    // Query parameters
    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${dateStamp}/${this.region}/s3/aws4_request`,
      'X-Amz-Date': isoDate,
      'X-Amz-Expires': input.expiresInSeconds.toString(),
      'X-Amz-SignedHeaders': 'host',
    };

    if (input.downloadFilename) {
      // Set sanitized attachment disposition header
      const sanitizedFilename = input.downloadFilename.replace(/["\r\n\\]/g, '_');
      queryParams['response-content-disposition'] = `attachment; filename="${sanitizedFilename}"`;
    }

    // Sort query parameters
    const sortedKeys = Object.keys(queryParams).sort();
    const canonicalQueryString = sortedKeys
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k]!)}`)
      .join('&');

    const canonicalHeaders = `host:${hostHeader}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const hashedCanonicalRequest = createHash('sha256')
      .update(canonicalRequest, 'utf8')
      .digest('hex');

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      isoDate,
      credentialScope,
      hashedCanonicalRequest,
    ].join('\n');

    const signingKey = this.getSigningKey(dateStamp);
    const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

    const presignedUrl = `${this.endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
    const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1000);

    return {
      url: presignedUrl,
      expiresAt,
    };
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const bucket = input.location.bucket || this.defaultBucket;
    const key = input.location.key.replace(/^\/+/, '');
    const url = `${this.endpoint}/${encodeURIComponent(bucket!)}/${key}`;

    const headers: Record<string, string> = {
      'content-type': input.contentType,
      'content-length': input.contentLength.toString(),
      'x-amz-content-sha256': input.checksumSha256,
    };

    if (input.metadata) {
      for (const [k, v] of Object.entries(input.metadata)) {
        headers[`x-amz-meta-${k}`] = v;
      }
    }

    const init: RequestInit = {
      method: 'PUT',
      headers: this.buildAuthorizationHeaders('PUT', url, headers),
      body: input.body as unknown as Uint8Array,
    };
    if (input.signal) {
      init.signal = input.signal;
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      throw new Error(`Failed to put object: HTTP ${response.status} ${response.statusText}`);
    }

    const eTag = (response.headers.get('etag') || '').replace(/^"|"$/g, '');

    return {
      location: { bucket: bucket!, key },
      eTag,
      checksumSha256: input.checksumSha256,
      storedAt: new Date(),
    };
  }

  async get(input: GetObjectInput): Promise<GetObjectResult> {
    const bucket = input.location.bucket || this.defaultBucket;
    const key = input.location.key.replace(/^\/+/, '');
    const url = `${this.endpoint}/${encodeURIComponent(bucket!)}/${key}`;

    const headers: Record<string, string> = {};
    if (input.range) {
      headers['range'] = `bytes=${input.range.start}-${input.range.end ?? ''}`;
    }

    const init: RequestInit = {
      method: 'GET',
      headers: this.buildAuthorizationHeaders('GET', url, headers),
    };
    if (input.signal) {
      init.signal = input.signal;
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      throw new Error(`Failed to get object: HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = Number.parseInt(response.headers.get('content-length') || '0', 10);
    const eTag = (response.headers.get('etag') || '').replace(/^"|"$/g, '');
    const lastModifiedHeader = response.headers.get('last-modified');
    const lastModified = lastModifiedHeader ? new Date(lastModifiedHeader) : new Date();

    const metadata: Record<string, string> = {};
    response.headers.forEach((value, headerKey) => {
      if (headerKey.startsWith('x-amz-meta-')) {
        metadata[headerKey.substring('x-amz-meta-'.length)] = value;
      }
    });

    async function* toAsyncIterable(body: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
      const reader = body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) yield value;
        }
      } finally {
        reader.releaseLock();
      }
    }

    return {
      body: response.body ? toAsyncIterable(response.body) : (async function* () {})(),
      contentType,
      contentLength,
      eTag,
      lastModified,
      metadata,
    };
  }

  async stat(
    location: StorageObjectLocation,
    options?: StorageOperationOptions,
  ): Promise<StatObjectResult> {
    const bucket = location.bucket || this.defaultBucket;
    const key = location.key.replace(/^\/+/, '');
    const url = `${this.endpoint}/${encodeURIComponent(bucket!)}/${key}`;

    const init: RequestInit = {
      method: 'HEAD',
      headers: this.buildAuthorizationHeaders('HEAD', url, {}),
    };
    if (options?.signal) {
      init.signal = options.signal;
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      throw new Error(`Failed to stat object: HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = Number.parseInt(response.headers.get('content-length') || '0', 10);
    const eTag = (response.headers.get('etag') || '').replace(/^"|"$/g, '');
    const lastModifiedHeader = response.headers.get('last-modified');
    const lastModified = lastModifiedHeader ? new Date(lastModifiedHeader) : new Date();

    const metadata: Record<string, string> = {};
    response.headers.forEach((value, headerKey) => {
      if (headerKey.startsWith('x-amz-meta-')) {
        metadata[headerKey.substring('x-amz-meta-'.length)] = value;
      }
    });

    return {
      location: { bucket: bucket!, key },
      contentType,
      contentLength,
      eTag,
      lastModified,
      metadata,
    };
  }

  async delete(input: DeleteObjectInput): Promise<void> {
    const bucket = input.location.bucket || this.defaultBucket;
    const key = input.location.key.replace(/^\/+/, '');
    const url = `${this.endpoint}/${encodeURIComponent(bucket!)}/${key}`;

    const init: RequestInit = {
      method: 'DELETE',
      headers: this.buildAuthorizationHeaders('DELETE', url, {}),
    };
    if (input.signal) {
      init.signal = input.signal;
    }

    const response = await fetch(url, init);

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete object: HTTP ${response.status} ${response.statusText}`);
    }
  }

  async health(options?: StorageOperationOptions): Promise<{
    status: 'healthy' | 'unhealthy';
    checkedAt: Date;
    latencyMs: number;
    message?: string;
  }> {
    const start = Date.now();
    try {
      const probeInit: RequestInit = { method: 'GET' };
      if (options?.signal) {
        probeInit.signal = options.signal;
      }
      const response = await fetch(`${this.endpoint}/minio/health/live`, probeInit).catch(
        async () => {
          const fallbackInit: RequestInit = { method: 'HEAD' };
          if (options?.signal) {
            fallbackInit.signal = options.signal;
          }
          return fetch(this.endpoint, fallbackInit);
        },
      );

      const latencyMs = Date.now() - start;
      const isHealthy = response.status < 500;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        checkedAt: new Date(),
        latencyMs,
        ...(isHealthy ? {} : { message: `Health check failed with HTTP ${response.status}` }),
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return {
        status: 'unhealthy',
        checkedAt: new Date(),
        latencyMs,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private getSigningKey(dateStamp: string): Buffer {
    const kDate = createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(this.region).digest();
    const kService = createHmac('sha256', kRegion).update('s3').digest();
    return createHmac('sha256', kService).update('aws4_request').digest();
  }

  private buildAuthorizationHeaders(
    method: string,
    rawUrl: string,
    additionalHeaders: Record<string, string>,
  ): Record<string, string> {
    const url = new URL(rawUrl);
    const now = new Date();
    const isoDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = isoDate.substring(0, 8);

    const headers: Record<string, string> = {
      ...additionalHeaders,
      host: url.host,
      'x-amz-date': isoDate,
    };

    const sortedHeaderKeys = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderKeys
      .map((k) => `${k.toLowerCase()}:${headers[k]!.trim()}\n`)
      .join('');
    const signedHeaders = sortedHeaderKeys.map((k) => k.toLowerCase()).join(';');

    const canonicalRequest = [
      method,
      url.pathname,
      url.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      headers['x-amz-content-sha256'] || 'UNSIGNED-PAYLOAD',
    ].join('\n');

    const hashedCanonicalRequest = createHash('sha256')
      .update(canonicalRequest, 'utf8')
      .digest('hex');

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      isoDate,
      credentialScope,
      hashedCanonicalRequest,
    ].join('\n');

    const signingKey = this.getSigningKey(dateStamp);
    const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headers,
      authorization,
    };
  }
}

export function createStorageClient(config: StorageClientConfig): S3CompatibleStorage {
  return new RustFsStorageAdapter(config);
}
