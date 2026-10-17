import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Only Node built-ins here: the container health check (`healthcheck.ts`) imports this file
// and must start fast without loading Nest or Prisma.

/** Written by the running worker, read by the container health check. */
export const HEARTBEAT_FILE = join(tmpdir(), 'vynor-worker.heartbeat');
/** How often the worker proves that its event loop runs and the database answers. */
export const HEARTBEAT_INTERVAL_MS = 10_000;
/** A heartbeat older than three missed beats means the worker is unhealthy. */
export const HEARTBEAT_MAX_AGE_MS = 3 * HEARTBEAT_INTERVAL_MS;

export async function writeHeartbeat(file = HEARTBEAT_FILE, now = Date.now()): Promise<void> {
  // Write then rename, so the health check never reads a half-written file.
  const temporary = `${file}.tmp`;
  await writeFile(temporary, String(now));
  await rename(temporary, file);
}

export async function clearHeartbeat(file = HEARTBEAT_FILE): Promise<void> {
  await rm(file, { force: true });
}

/** Whether the last heartbeat is recent. A missing or unreadable heartbeat is not. */
export async function isHeartbeatFresh(file = HEARTBEAT_FILE, now = Date.now()): Promise<boolean> {
  let writtenAt: number;
  try {
    writtenAt = Number(await readFile(file, 'utf8'));
  } catch {
    return false;
  }
  return Number.isFinite(writtenAt) && now - writtenAt <= HEARTBEAT_MAX_AGE_MS;
}
