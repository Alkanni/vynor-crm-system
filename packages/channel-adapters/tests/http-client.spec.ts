import { describe, expect, it } from 'vitest';
import { MAX_MEDIA_DOWNLOAD_BYTES, mapHttpStatus, ProviderHttpClient } from '../src/index.js';
import { runtimeWith } from './helpers.js';

const MiB = 1024 * 1024;

/** A body streamed in `chunks`, like a chunked transfer without Content-Length. */
function streamedBody(chunks: Uint8Array[]) {
  const source = { pulled: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[source.pulled];
      source.pulled += 1;
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() {
      source.cancelled = true;
    },
  });
  return { stream, source };
}

function clientReturning(response: Response): ProviderHttpClient {
  const fetchImpl = (async () => response) as typeof fetch;
  return new ProviderHttpClient('WHATSAPP_CLOUD', runtimeWith(fetchImpl), ({ status, headers }) =>
    mapHttpStatus('WHATSAPP_CLOUD', status, headers, 'failed'),
  );
}

/** The rejection of `promise`, or 'resolved', so a 128 MiB result never reaches failure output. */
function settled(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => 'resolved',
    (error: unknown) => error,
  );
}

describe('ProviderHttpClient.requestBinary download limit', () => {
  it('stops reading a body without Content-Length once it passes the limit', async () => {
    // 128 MiB in 1 MiB chunks; the chunk is shared, so the test itself stays small.
    const chunk = new Uint8Array(MiB);
    const total = (128 * MiB) / chunk.byteLength;
    const { stream, source } = streamedBody(Array.from({ length: total }, () => chunk));
    const client = clientReturning(
      new Response(stream, { headers: { 'content-type': 'video/mp4' } }),
    );

    expect(await settled(client.requestBinary({ url: 'https://media.test/file' }))).toMatchObject({
      code: 'MEDIA_TOO_LARGE',
      category: 'INVALID_REQUEST',
    });
    expect(source.cancelled).toBe(true);
    expect(source.pulled).toBeLessThan(total);
    expect(source.pulled * chunk.byteLength).toBeLessThanOrEqual(
      MAX_MEDIA_DOWNLOAD_BYTES + 2 * MiB,
    );
  });

  it('rejects a declared Content-Length over the limit without reading the body', async () => {
    const { stream, source } = streamedBody([new Uint8Array(16)]);
    const client = clientReturning(
      new Response(stream, {
        headers: { 'content-length': String(MAX_MEDIA_DOWNLOAD_BYTES + 1) },
      }),
    );

    expect(await settled(client.requestBinary({ url: 'https://media.test/file' }))).toMatchObject({
      code: 'MEDIA_TOO_LARGE',
    });
    expect(source.cancelled).toBe(true);
  });

  it('returns a streamed body without Content-Length that stays under the limit', async () => {
    const encoder = new TextEncoder();
    const { stream } = streamedBody(['ab', 'cd', 'ef'].map((part) => encoder.encode(part)));
    const client = clientReturning(
      new Response(stream, { headers: { 'content-type': 'image/png' } }),
    );

    const file = await client.requestBinary({ url: 'https://media.test/file' });

    expect(file.data.toString()).toBe('abcdef');
    expect(file.contentType).toBe('image/png');
  });
});
