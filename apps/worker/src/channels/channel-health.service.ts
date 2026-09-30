import { Injectable } from '@nestjs/common';
import type { ChannelProviderError } from '@vynor/channel-adapters';
import { notifyRealtime, prisma } from '@vynor/database';

interface ChannelRef {
  id: string;
  workspaceId: string;
  status: string;
}

/**
 * Keeps `provider_accounts.status` in step with what the worker observes while sending and
 * polling: rejected credentials flag the channel for reconnection, other failures show a
 * warning, and the next success clears it.
 */
@Injectable()
export class ChannelHealthRecorder {
  async recordFailure(channel: ChannelRef, error: ChannelProviderError): Promise<void> {
    const status = error.requiresReconnect ? 'DISCONNECTED' : 'ERROR';
    // A reconnect requirement is never downgraded to a plain warning.
    if (channel.status === 'DISCONNECTED' && status === 'ERROR') return;
    await prisma.$transaction(async (tx) => {
      await tx.providerAccount.update({
        where: { id: channel.id },
        data: { status, statusReason: error.message, lastErrorAt: new Date() },
      });
      await notifyRealtime(tx, {
        eventType: 'channel.updated',
        workspaceId: channel.workspaceId,
        channelId: channel.id,
      });
    });
  }

  async recordSuccess(channel: ChannelRef): Promise<void> {
    if (channel.status !== 'ERROR') return;
    await prisma.$transaction(async (tx) => {
      await tx.providerAccount.updateMany({
        where: { id: channel.id, status: 'ERROR' },
        data: { status: 'ACTIVE', statusReason: null },
      });
      await notifyRealtime(tx, {
        eventType: 'channel.updated',
        workspaceId: channel.workspaceId,
        channelId: channel.id,
      });
    });
  }
}
