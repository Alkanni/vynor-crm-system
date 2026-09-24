export interface StorageObjectLocation {
  readonly bucket: string;
  readonly key: string;
  readonly versionId?: string;
}

export interface StorageOperationOptions {
  readonly signal?: AbortSignal;
}

export type StorageObjectBody = Uint8Array | AsyncIterable<Uint8Array>;

export interface PutObjectInput extends StorageOperationOptions {
  readonly location: StorageObjectLocation;
  readonly body: StorageObjectBody;
  readonly contentType: string;
  readonly contentLength: number;
  readonly checksumSha256: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface PutObjectResult {
  readonly location: StorageObjectLocation;
  readonly eTag: string;
  readonly checksumSha256: string;
  readonly storedAt: Date;
}

export interface StorageByteRange {
  readonly start: number;
  readonly end?: number;
}

export interface GetObjectInput extends StorageOperationOptions {
  readonly location: StorageObjectLocation;
  readonly range?: StorageByteRange;
}

export interface GetObjectResult {
  readonly body: AsyncIterable<Uint8Array>;
  readonly contentType: string;
  readonly contentLength: number;
  readonly eTag: string;
  readonly checksumSha256?: string;
  readonly lastModified: Date;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface StatObjectResult {
  readonly location: StorageObjectLocation;
  readonly contentType: string;
  readonly contentLength: number;
  readonly eTag: string;
  readonly checksumSha256?: string;
  readonly lastModified: Date;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface SignedDownloadInput extends StorageOperationOptions {
  readonly location: StorageObjectLocation;
  readonly expiresInSeconds: number;
  readonly downloadFilename?: string;
}

export interface SignedDownloadResult {
  readonly url: string;
  readonly expiresAt: Date;
}

export interface DeleteObjectInput extends StorageOperationOptions {
  readonly location: StorageObjectLocation;
}

export type StorageHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface StorageHealthResult {
  readonly status: StorageHealthStatus;
  readonly checkedAt: Date;
  readonly latencyMs: number;
  readonly message?: string;
}

/**
 * Provider-neutral subset required from RustFS or any S3-compatible backend.
 * Implementations must map missing objects, timeouts, checksum failures, and
 * provider errors into stable application error types at the adapter boundary.
 */
export interface S3CompatibleStorage {
  put(input: PutObjectInput): Promise<PutObjectResult>;
  get(input: GetObjectInput): Promise<GetObjectResult>;
  stat(
    location: StorageObjectLocation,
    options?: StorageOperationOptions,
  ): Promise<StatObjectResult>;
  createSignedDownload(input: SignedDownloadInput): Promise<SignedDownloadResult>;
  delete(input: DeleteObjectInput): Promise<void>;
  health(options?: StorageOperationOptions): Promise<StorageHealthResult>;
}
