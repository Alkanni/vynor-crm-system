// S3 contract check for the WU-01 compose smoke (NF-08: storage image replaced by PGSTY Silo).
//
// Drives the application's own storage client (@vynor/storage, built dist) against the smoke
// object store through its 127.0.0.1 port, with the credentials and bucket the API container
// gets in the rendered config: health, then put and a signed download (bytes compared) in both
// buckets that rustfs-init provisions, under the prefix wu01-smoke/. compose-smoke.sh removes
// that prefix with mcli afterwards and checks it is gone. Plain Node built-ins and erasable
// TypeScript, so compose-smoke.sh runs it with `node`.
//
// The client's stat/get/delete are not exercised: they sign UNSIGNED-PAYLOAD without sending
// x-amz-content-sha256, which MinIO-compatible stores reject (403 SignatureDoesNotMatch). That
// is a separate, pre-existing client bug (NF-09); the API and worker do not call those methods.
//
//   node compose-smoke-s3.mts <rendered.json> <host endpoint, e.g. http://127.0.0.1:59000>

import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface Location {
  bucket: string;
  key: string;
}

/** The subset of S3CompatibleStorage (packages/storage) this check uses. */
interface StorageClient {
  health(): Promise<{ status: string; message?: string }>;
  put(input: {
    location: Location;
    body: Uint8Array;
    contentType: string;
    contentLength: number;
    checksumSha256: string;
    metadata?: Record<string, string>;
  }): Promise<{ eTag: string }>;
  createSignedDownload(input: { location: Location; expiresInSeconds: number }): Promise<{
    url: string;
  }>;
}

const IN_NETWORK_ENDPOINT = 'http://rustfs:9000';

const SMOKE_PREFIX = 'wu01-smoke/';

async function checkBucket(client: StorageClient, bucket: string): Promise<void> {
  const id = randomUUID();
  const location = { bucket, key: `${SMOKE_PREFIX}${id}.txt` };
  const body = Buffer.from(`vynor wu01 compose smoke ${id}\n`);
  const checksumSha256 = createHash('sha256').update(body).digest('hex');

  await client.put({
    location,
    body,
    contentType: 'text/plain',
    contentLength: body.length,
    checksumSha256,
    metadata: { smoke: 'wu01' },
  });
  const { url } = await client.createSignedDownload({ location, expiresInSeconds: 60 });
  const response = await fetch(url);
  const downloaded = Buffer.from(await response.arrayBuffer());
  if (response.status !== 200 || !downloaded.equals(body)) {
    throw new Error(`${bucket}: signed download returned HTTP ${response.status}`);
  }
  console.info(`  ✓ ${bucket}: put, signed download (bytes match)`);
}

async function main(argv: string[]): Promise<number> {
  const [renderedPath, hostEndpoint] = argv;
  if (!renderedPath || !hostEndpoint) {
    console.error('usage: compose-smoke-s3.mts <rendered.json> <host endpoint>');
    return 2;
  }
  const rendered = JSON.parse(fs.readFileSync(renderedPath, 'utf8')) as {
    services: { api: { environment: Record<string, string> } };
  };
  const env = rendered.services.api.environment;
  if (env.STORAGE_ENDPOINT !== IN_NETWORK_ENDPOINT) {
    console.error(
      `  ✗ API STORAGE_ENDPOINT is ${env.STORAGE_ENDPOINT}, not ${IN_NETWORK_ENDPOINT}`,
    );
    return 1;
  }
  const { hostname } = new URL(hostEndpoint);
  if (hostname !== '127.0.0.1') {
    console.error(`  ✗ the smoke object store must be reached on 127.0.0.1, got ${hostname}`);
    return 1;
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const storageEntry = pathToFileURL(path.join(root, 'packages/storage/dist/index.js')).href;
  const { createStorageClient } = (await import(storageEntry)) as {
    createStorageClient: (config: Record<string, unknown>) => StorageClient;
  };
  const client = createStorageClient({
    endpoint: hostEndpoint,
    region: env.STORAGE_REGION,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    defaultBucket: env.STORAGE_BUCKET,
    forcePathStyle: true,
  });

  try {
    const health = await client.health();
    if (health.status !== 'healthy') throw new Error(`storage health: ${health.message}`);
    console.info('  ✓ storage health (/minio/health/live)');
    await checkBucket(client, env.STORAGE_BUCKET);
    await checkBucket(client, `${env.STORAGE_BUCKET}-quarantine`);
  } catch (error) {
    console.error(`  ✗ ${(error as Error).message}`);
    return 1;
  }
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
