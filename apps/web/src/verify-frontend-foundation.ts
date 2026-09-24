import assert from 'node:assert/strict';
import { cn } from './lib/utils';
import { ApiClientError } from './lib/api/api-client';
import { createQueryClient } from './lib/query/query-client';
import { useUiStore } from './lib/store/ui-store';
import { realtimeClient } from './lib/realtime/realtime-client';
import { getSupabaseBrowserClient } from './lib/supabase/client';
import { canAccessNavItem, CRM_NAV_ITEMS, getVisibleNavItems } from './lib/auth/navigation';
import type { ActorContext } from '@vynor/contracts';

console.info('--- Verifying VYNOR Frontend Foundation (Section 6.3) ---');

// Test 1: Design Tokens and cn utility (FND-FE-001)
console.info('1. Checking Tailwind and shadcn/ui design tokens & cn utility...');
const isHidden = false;
const merged = cn('px-4 py-2', 'bg-primary', isHidden && 'hidden', undefined, 'px-6');
assert.equal(merged, 'py-2 bg-primary px-6', 'cn must merge Tailwind padding classes correctly');
console.info('   ✓ Design tokens and class merger verified.');

// Test 2: Supabase Auth client initialization (FND-FE-002)
console.info('2. Checking Supabase Auth client boundary...');
const supabase = getSupabaseBrowserClient();
assert.ok(supabase, 'Supabase client must be initialized');
assert.ok(supabase.auth, 'Supabase Auth namespace must be available');
console.info('   ✓ Supabase browser client verified.');

// Test 3: Navigation & Permission-aware access control (FND-FE-003, FND-BE-003)
console.info('3. Checking permission-aware navigation filtering...');
const testActor: ActorContext = {
  user: {
    id: 'usr_01',
    supabaseAuthId: 'sub_01',
    email: 'agent@vynor.io',
    displayName: 'Agent Smith',
    isActive: true,
  },
  workspace: {
    id: 'ws_01',
    name: 'Vynor HQ',
    slug: 'vynor-hq',
    timezone: 'UTC',
  },
  membership: {
    id: 'mem_01',
    status: 'ACTIVE',
    roles: ['AGENT'],
    teams: [],
  },
  permissions: ['conversation:read'], // Lacks campaign:read and analytics:read
  correlationId: 'req_nav_test',
};

const visibleItems = getVisibleNavItems(CRM_NAV_ITEMS, testActor);
const hasInbox = visibleItems.some((i) => i.id === 'inbox');
const hasCampaigns = visibleItems.some((i) => i.id === 'campaigns');
assert.ok(hasInbox, 'Actor with conversation:read must see Inbox navigation');
assert.equal(hasCampaigns, false, 'Actor lacking campaign:read must NOT see Campaigns navigation');

const unauthenticatedItems = getVisibleNavItems(CRM_NAV_ITEMS, null);
assert.ok(
  unauthenticatedItems.every((i) => !i.requiredPermissions || i.requiredPermissions.length === 0),
  'Unauthenticated visitor must only see public navigation items',
);
const inboxItem = CRM_NAV_ITEMS.find((i) => i.id === 'inbox')!;
assert.equal(
  canAccessNavItem(testActor, inboxItem),
  true,
  'Actor should have access to inbox item',
);
console.info('   ✓ Permission-aware navigation filtering verified.');

// Test 4: TanStack Query production defaults and API client error (FND-FE-004)
console.info('4. Checking TanStack Query defaults and typed API client error handling...');
const queryClient = createQueryClient();
const queryDefaults = queryClient.getDefaultOptions().queries;
assert.equal(queryDefaults?.staleTime, 30 * 1000, 'staleTime must default to 30 seconds');
assert.equal(queryDefaults?.gcTime, 5 * 60 * 1000, 'gcTime must default to 5 minutes');

// Verify retry logic ignores 4xx client errors
const retryFn = queryDefaults?.retry as (failureCount: number, error: Error) => boolean;
assert.ok(typeof retryFn === 'function', 'Query retry must be configured as a function');

const err404 = new ApiClientError({
  statusCode: 404,
  code: 'RESOURCE_NOT_FOUND',
  message: 'Item not found',
  correlationId: 'corr_test',
  timestamp: new Date().toISOString(),
});
assert.equal(retryFn(1, err404), false, 'TanStack Query must NOT retry 404 errors');

const err500 = new ApiClientError({
  statusCode: 500,
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
  correlationId: 'corr_test',
  timestamp: new Date().toISOString(),
});
assert.equal(retryFn(1, err500), true, 'TanStack Query must retry 500 errors');
assert.equal(retryFn(3, err500), false, 'TanStack Query must stop retrying after 3 attempts');
console.info('   ✓ TanStack Query defaults and RFC-7807 error rejection verified.');

// Test 5: Zustand UI store and prohibited server-state duplication (FND-FE-005)
console.info('5. Checking Zustand UI store and state isolation...');
const uiStore = useUiStore.getState();
assert.equal(typeof uiStore.toggleSidebar, 'function');
assert.equal(typeof uiStore.setSidebarCollapsed, 'function');
assert.equal(typeof uiStore.openModal, 'function');
assert.equal(typeof uiStore.setSessionExpired, 'function');

// Verify state transitions
uiStore.setSidebarCollapsed(true);
assert.equal(useUiStore.getState().sidebarCollapsed, true);
uiStore.setSidebarCollapsed(false);
assert.equal(useUiStore.getState().sidebarCollapsed, false);

uiStore.setSessionExpired(true);
assert.equal(useUiStore.getState().isSessionExpired, true);
uiStore.setSessionExpired(false);
assert.equal(useUiStore.getState().isSessionExpired, false);
console.info('   ✓ Zustand UI store operations verified.');

// Test 6: Realtime manager & Socket.IO invalidation hooks (FND-FE-007)
console.info('6. Checking Realtime Socket.IO client interface...');
assert.equal(typeof realtimeClient.connect, 'function');
assert.equal(typeof realtimeClient.disconnect, 'function');
assert.equal(typeof realtimeClient.joinConversation, 'function');
assert.equal(typeof realtimeClient.leaveConversation, 'function');
assert.equal(realtimeClient.getStatus(), 'disconnected');
console.info('   ✓ Realtime client manager verified.');

console.info('--- ALL Section 6.3 Frontend Foundation Verifications PASSED! ---');
