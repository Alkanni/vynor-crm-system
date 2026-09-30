'use client';

import { SEED_UNREAD_CONVERSATIONS } from '@/components/inbox/mock-data';
import { useAuth } from '@/lib/auth/auth-context';
import { useConversations } from './queries';

/** Conversations with unread customer messages, for the sidebar Inbox badge. */
export function useInboxUnreadCount(): number {
  const { mode } = useAuth();
  // Same query key as the Inbox page, so both share one request and cache.
  const conversations = useConversations(mode === 'connected');
  if (mode !== 'connected') return SEED_UNREAD_CONVERSATIONS;
  return (conversations.data ?? []).filter((c) => c.unreadCount > 0 && c.status !== 'RESOLVED')
    .length;
}
