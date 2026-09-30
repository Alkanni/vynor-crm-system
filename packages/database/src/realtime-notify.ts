import { REALTIME_NOTIFY_CHANNEL, type RealtimeNotification } from '@vynor/contracts';
import type { AnyPrismaClient } from './client.js';

/**
 * Queues a realtime hint for the API's Socket.IO relay through Postgres NOTIFY.
 * Inside a transaction the notification is only delivered after COMMIT, so clients never
 * refetch before the change is visible.
 */
export async function notifyRealtime(
  client: AnyPrismaClient,
  notification: RealtimeNotification,
): Promise<void> {
  await client.$executeRaw`SELECT pg_notify(${REALTIME_NOTIFY_CHANNEL}, ${JSON.stringify(notification)})`;
}
