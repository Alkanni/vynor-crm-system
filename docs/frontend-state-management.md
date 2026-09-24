# Frontend State Management & Prohibited Server-State Duplication

This document defines the strict architectural boundary between **Server State** and **Client UI State** in `apps/web` (FND-FE-004, FND-FE-005).

---

## 1. State Category Taxonomy

| Category            | Library                            | Examples                                                                               | Lifetime                                        |
| :------------------ | :--------------------------------- | :------------------------------------------------------------------------------------- | :---------------------------------------------- |
| **Server State**    | `@tanstack/react-query`            | Conversations, messages, contacts, campaigns, attachments, channels, teams, audit logs | Cached asynchronously, invalidated by Socket.IO |
| **Client UI State** | `zustand`                          | Sidebar expanded/collapsed, active modal dialogs, theme toggle, session expired dialog | Ephemeral to browser session / component tree   |
| **URL State**       | Next.js Router (`useSearchParams`) | Active conversation ID, pagination cursor, search query, filter criteria               | Deep-linkable across browser reloads            |
| **Form State**      | React Hook Form / React state      | Draft message input, unsaved contact edits                                             | Scoped to active page/modal                     |

---

## 2. Prohibited Server-State Duplication Rule

> [!CAUTION]
> **NEVER duplicate, mirror, or copy server-owned domain entities into Zustand stores.**
> Server data belongs exclusively in TanStack Query caches.

### Why Duplication is Prohibited:

1. **Cache Invalidation Drift**:
   When Socket.IO receives a `resync` instruction or a message event (`conversation.message-created`), TanStack Query invalidates `['conversations']` or `['messages', id]`. If an entity is copied into Zustand, it remains stale and out-of-sync.
2. **Optimistic Mutation Race Conditions**:
   TanStack Query handles rollback on network failures. Managing optimistic rollbacks across both TanStack Query and Zustand leads to ghost states.
3. **Memory Leaks**:
   TanStack Query automatically applies garbage collection (`gcTime: 5 minutes`) to unused queries. Custom Zustand slices often retain old conversation payloads indefinitely.

---

## 3. Reference Patterns

### Correct: TanStack Query for Server Data

```tsx
// Using TanStack Query for conversations
export function ConversationList() {
  const {
    data: conversations,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.conversations.list(),
  });

  if (isLoading) return <LoadingSpinner />;
  return <div>{/* render list */}</div>;
}
```

### Correct: Zustand for Ephemeral Shell State

```tsx
// Using Zustand strictly for UI state
export function SidebarToggle() {
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUiStore();

  return (
    <button onClick={toggleSidebarCollapsed}>
      {sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
    </button>
  );
}
```
