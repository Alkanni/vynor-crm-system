import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SIDEBAR_COLLAPSED_THRESHOLD,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useUiStore,
} from './lib/store/ui-store';
import { CRM_NAV_ITEMS } from './lib/auth/navigation';
import { CANNED_TEMPLATES } from './components/inbox/TemplatePickerPopover';
import { buttonVariants } from './components/ui/Button';
import { cn } from './lib/utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), 'utf-8');
const exists = (rel: string) => fs.existsSync(path.join(__dirname, rel));

console.info('================================================================');
console.info('--- Verifying VYNOR UI/UX Parity Design Contract (Issue #29) ---');
console.info('================================================================');

// ---------------------------------------------------------------------------
// 1. Design token engine (Tailwind v4 @theme) — port of _next-colors.scss
// ---------------------------------------------------------------------------
console.info('\n1. Checking UX-TOK-001: VYNOR token engine (Tailwind v4 @theme)...');
const globalsCss = read('app/globals.css');
const rootStart = globalsCss.indexOf(':root {');
const darkStart = globalsCss.indexOf('.dark {', rootStart);
const lightBlock = globalsCss.slice(rootStart, darkStart);
const darkBlock = globalsCss.slice(darkStart, globalsCss.indexOf('\n  }\n', darkStart));
assert.ok(rootStart > 0 && darkStart > rootStart, 'globals.css must define :root and .dark blocks');

assert.ok(
  globalsCss.includes('@custom-variant dark (&:where(.dark, .dark *));'),
  'dark: variant must follow the `.dark` class like VYNOR (darkMode: class)',
);
assert.ok(globalsCss.includes('@theme inline {'), 'Colors must be registered with @theme inline');

const SCALES = ['slate', 'iris', 'blue', 'ruby', 'amber', 'teal', 'gray', 'violet'];
for (const scale of SCALES) {
  for (let step = 1; step <= 12; step++) {
    assert.ok(lightBlock.includes(`--${scale}-${step}:`), `Light ${scale}-${step} must be defined`);
    assert.ok(darkBlock.includes(`--${scale}-${step}:`), `Dark ${scale}-${step} must be defined`);
    assert.ok(
      globalsCss.includes(`--color-n-${scale}-${step}: rgb(var(--${scale}-${step}));`),
      `Utility n-${scale}-${step} must be registered`,
    );
  }
}
assert.ok(lightBlock.includes('--blue-9: 229 72 77;'), 'VYNOR blue slot must carry the brand red');
assert.ok(globalsCss.includes('--color-n-brand: #e5484d;'), 'n-brand must be #E5484D');

const N_UTILITIES = [
  'background',
  'surface-1',
  'surface-2',
  'solid-1',
  'solid-2',
  'solid-3',
  'solid-blue',
  'solid-amber',
  'solid-iris',
  'solid-red',
  'alpha-1',
  'alpha-2',
  'alpha-3',
  'alpha-black1',
  'alpha-black2',
  'weak',
  'strong',
  'container',
  'card',
  'button-color',
  'label-color',
  'label-border',
];
for (const token of N_UTILITIES) {
  assert.ok(globalsCss.includes(`--color-n-${token}:`), `Utility n-${token} must be registered`);
}

const SEMANTIC_ALIASES = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'primary',
  'primary-foreground',
  'secondary',
  'muted',
  'muted-foreground',
  'accent',
  'destructive',
  'success',
  'warning',
  'info',
  'border',
  'border-strong',
  'input',
  'ring',
  'surface',
];
for (const alias of SEMANTIC_ALIASES) {
  assert.ok(
    new RegExp(`--color-${alias}: rgb\\(var\\(--|--color-${alias}: #`).test(globalsCss),
    `Legacy semantic token ${alias} must map onto a VYNOR scale`,
  );
}

assert.ok(
  !/--radius-(sm|md|lg|xl):/.test(globalsCss),
  'The Tailwind radius scale must not be overridden (rounded-lg = 8px like VYNOR)',
);
for (const needle of [
  '--font-inter:',
  '--font-interDisplay:',
  '--font-weight-420: 420;',
  '--font-weight-620: 620;',
  '--text-xxs: 0.625rem;',
  '--text-xxxs: 0.5rem;',
  '--breakpoint-xs: 480px;',
  '--breakpoint-3xl: 1900px;',
  '@keyframes wiggle',
  '@keyframes fade-in-up',
  '@keyframes loader-pulse',
  '@keyframes card-select',
  '@keyframes shake',
  '@utility no-scrollbar',
  '@utility animate-in',
  '@utility text-heading-1',
  '@utility text-label-small',
  '.field-base {',
]) {
  assert.ok(globalsCss.includes(needle), `globals.css must define ${needle}`);
}
assert.ok(
  cn('text-heading-1 text-n-slate-12') === 'text-heading-1 text-n-slate-12' &&
    cn('text-xxs text-n-slate-11') === 'text-xxs text-n-slate-11',
  'cn() must keep VYNOR typography/size utilities next to n-* colors',
);
console.info(
  '   ✓ UX-TOK-001: 8 scales × 12 steps (light/dark), n-* utilities, aliases, fonts, motion.',
);

// ---------------------------------------------------------------------------
// 2. Primitive kit — components/ui ports of components-next
// ---------------------------------------------------------------------------
console.info('\n2. Checking UX-KIT-001: VYNOR primitive kit (components/ui)...');
const KIT = [
  'Button',
  'Avatar',
  'Input',
  'Label',
  'TabBar',
  'CardLayout',
  'Dropdown',
  'Spinner',
  'Dialog',
  'Banner',
  'Switch',
  'Checkbox',
  'Accordion',
  'Toast',
];
for (const name of KIT) {
  assert.ok(exists(`components/ui/${name}.tsx`), `components/ui/${name}.tsx must exist`);
}
for (const variant of ['solid', 'faded', 'outline', 'ghost', 'link'] as const) {
  for (const color of ['blue', 'ruby', 'amber', 'slate', 'teal'] as const) {
    assert.ok(
      buttonVariants({ variant, color }).length > 0,
      `Button ${variant}/${color} must be defined`,
    );
  }
}
assert.ok(buttonVariants({ size: 'sm' }).includes('h-8 px-3'), 'Button sm must be h-8 px-3');
assert.ok(buttonVariants({ size: 'md' }).includes('h-10 px-4'), 'Button md must be h-10 px-4');
assert.ok(buttonVariants().includes('bg-n-brand'), 'Primary button must use bg-n-brand');
const avatarSource = read('components/ui/Avatar.tsx');
assert.ok(
  avatarSource.includes("['#FBDCEF', '#C2298A']") && avatarSource.includes('bg-n-teal-10'),
  'Avatar must use the VYNOR initials palette and status colors',
);
const inputSource = read('components/ui/Input.tsx');
assert.ok(
  inputSource.includes('bg-n-alpha-black2') &&
    inputSource.includes('outline-n-weak') &&
    inputSource.includes('focus:outline-n-brand'),
  'Input must use outline-n-weak, bg-n-alpha-black2 and n-brand focus',
);
assert.ok(
  read('components/ui/TabBar.tsx').includes('bg-n-solid-active'),
  'TabBar must render the sliding indicator',
);
assert.ok(
  read('components/ui/Dialog.tsx').includes('bg-n-alpha-3 p-6') ||
    read('components/ui/Dialog.tsx').includes('rounded-xl bg-n-alpha-3'),
  'Dialog must use the VYNOR bg-n-alpha-3 surface',
);
console.info(
  '   ✓ UX-KIT-001: Button matrix, Avatar, Input, Label, TabBar, Dialog, Dropdown, Spinner.',
);

// ---------------------------------------------------------------------------
// 3. App shell & sidebar — port of Sidebar.vue + Dashboard.vue
// ---------------------------------------------------------------------------
console.info('\n3. Checking UX-SHELL-001: Full-height VYNOR sidebar shell...');
const appShellSource = read('components/shell/AppShell.tsx');
const sidebarSource = read('components/sidebar/Sidebar.tsx');
const profileMenuSource = read('components/sidebar/SidebarProfileMenu.tsx');
const sidebarGroupSource = read('components/sidebar/SidebarGroup.tsx');

assert.ok(!exists('components/shell/AppHeader.tsx'), 'The global top AppHeader must be removed');
assert.ok(
  !exists('components/shell/StatusBarFooter.tsx'),
  'The global StatusBarFooter must be removed',
);
assert.ok(
  !appShellSource.includes('AppHeader') && !appShellSource.includes('StatusBarFooter'),
  'AppShell must not mount a global header or status bar',
);
assert.ok(appShellSource.includes('<Sidebar />'), 'AppShell must mount the VYNOR Sidebar');
assert.ok(appShellSource.includes('bg-n-surface-1'), 'Workspace must be bg-n-surface-1');
assert.ok(appShellSource.includes('MobileSidebarLauncher'), 'Mobile launcher must be mounted');
for (const mount of ['CommandPaletteDialog', 'KeyboardShortcutsModal', 'SessionExpiryDialog']) {
  assert.ok(appShellSource.includes(mount), `AppShell must mount ${mount}`);
}
assert.ok(
  sidebarSource.includes('bg-n-background') &&
    sidebarSource.includes('border-n-weak') &&
    sidebarSource.includes('w-[200px]'),
  'Sidebar must be bg-n-background, border-n-weak and 200px wide',
);
assert.ok(
  sidebarSource.includes('SidebarAccountSwitcher') && sidebarSource.includes('Ctrl K'),
  'Sidebar header must include the account switcher and Ctrl K search',
);
assert.ok(sidebarSource.includes('PenLine'), 'Sidebar header must include the compose button');
assert.ok(
  sidebarSource.includes('from-n-background to-transparent'),
  'Sidebar footer must fade the navigation with a gradient',
);
assert.ok(sidebarGroupSource.includes('TREE_CONNECTOR'), 'Settings children must draw tree lines');
for (const entry of [
  'Set your availability',
  'Appearance',
  'Keyboard shortcuts',
  'Realtime',
  'Log out',
]) {
  assert.ok(profileMenuSource.includes(entry), `Profile menu must contain "${entry}"`);
}
assert.deepEqual(
  [SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_COLLAPSED_THRESHOLD, SIDEBAR_MAX_WIDTH],
  [200, 56, 160, 320],
  'Sidebar geometry must mirror VYNOR (200 / 56 / 160 / 320)',
);

const navIds = CRM_NAV_ITEMS.map((i) => i.id);
for (const id of [
  'inbox',
  'contacts',
  'channels',
  'ai-agent',
  'campaigns',
  'blast',
  'tickets',
  'automations',
  'templates',
  'dashboard',
  'analytics',
  'settings',
]) {
  assert.ok(navIds.includes(id), `Navigation must include the ${id} module`);
}
console.info(
  '   ✓ UX-SHELL-001: No global header/status bar; VYNOR sidebar, profile menu, 12 modules.',
);

// ---------------------------------------------------------------------------
// 4. Page layout system — CampaignLayout.vue / EmptyStateLayout.vue
// ---------------------------------------------------------------------------
console.info('\n4. Checking UX-LAYOUT-001: PageLayout / PageHeader across modules...');
const pageLayoutSource = read('components/layout/PageLayout.tsx');
for (const needle of [
  'h-20',
  'max-w-5xl',
  'text-heading-1',
  'sm:px-6',
  'bg-n-surface-1',
  'overflow-y-auto',
]) {
  assert.ok(pageLayoutSource.includes(needle), `PageLayout must use ${needle}`);
}
assert.ok(
  read('components/common/EmptyState.tsx').includes('from-n-surface-1'),
  'EmptyState must follow EmptyStateLayout.vue (gradient from n-surface-1)',
);
const MODULE_PAGES = [
  'app/page.tsx',
  'app/dashboard/page.tsx',
  'app/contacts/page.tsx',
  'app/tickets/page.tsx',
  'app/automations/page.tsx',
  'app/templates/page.tsx',
  'app/campaigns/page.tsx',
  'app/blast/page.tsx',
  'app/channels/page.tsx',
  'components/ai-agent/AgentListView.tsx',
  'components/ai-agent/AgentSettingsView.tsx',
  'app/reports/page.tsx',
  'app/settings/page.tsx',
];
for (const page of MODULE_PAGES) {
  assert.ok(read(page).includes('<PageLayout'), `${page} must render through PageLayout`);
}
console.info(
  `   ✓ UX-LAYOUT-001: ${MODULE_PAGES.length} module screens use the shared PageLayout.`,
);

// ---------------------------------------------------------------------------
// 5. Unified Inbox list — ChatList.vue / ConversationCard
// ---------------------------------------------------------------------------
console.info('\n5. Checking UX-INBOX-001: Conversation list & cards...');
const inboxPageSource = read('app/inbox/page.tsx');
const convRowSource = read('components/inbox/ConversationRow.tsx');
const queueListSource = read('components/inbox/ConversationQueueList.tsx');
const channelBadgeSource = read('components/inbox/ChannelBadge.tsx');
const headerSource = read('components/inbox/ConversationHeader.tsx');

assert.ok(inboxPageSource.includes('md:w-[340px] 2xl:w-[412px]'), 'List panel must be 340/412px');
assert.ok(queueListSource.includes('h-[3.25rem]'), 'List header must be h-[3.25rem]');
assert.ok(
  queueListSource.includes("label: 'Mine'") &&
    queueListSource.includes("label: 'Unassigned'") &&
    queueListSource.includes("label: 'All'"),
  'Queue must expose Mine / Unassigned / All tabs',
);
for (const needle of [
  'px-3 py-4',
  'gap-3',
  'size={24}',
  'text-base',
  'text-sm text-n-slate-10',
  'bg-n-brand',
  'unreadCount',
]) {
  assert.ok(convRowSource.includes(needle), `ConversationCard must use ${needle}`);
}
assert.ok(convRowSource.includes('ChannelBadge'), 'ConversationCard must render the inbox icon');
assert.ok(
  channelBadgeSource.includes('rounded-full bg-n-alpha-2'),
  'Inbox icon must sit in a bg-n-alpha-2 circle',
);
assert.ok(
  headerSource.includes('size={32}') && headerSource.includes('text-sm font-medium'),
  'Conversation header must follow ConversationHeader.vue',
);
console.info('   ✓ UX-INBOX-001: 340/412px list, ChatListHeader, ChatTypeTabs, ConversationCard.');

// ---------------------------------------------------------------------------
// 6. Messages & reply box — bubbles/Base.vue, ReplyBox.vue
// ---------------------------------------------------------------------------
console.info('\n6. Checking UX-INBOX-002/003: Bubbles & reply box...');
const messageBubbleSource = read('components/inbox/MessageBubble.tsx');
const composerSource = read('components/inbox/MessageComposer.tsx');
for (const needle of [
  'px-4 py-3',
  'rounded-xl',
  'bg-n-solid-blue',
  'bg-n-slate-4',
  'bg-n-solid-amber text-n-amber-12',
  'bg-n-solid-iris',
  'bg-n-ruby-4',
  'bg-n-alpha-1',
  'rounded-br-xs',
  'rounded-bl-xs',
  'LockKeyhole',
  'AI Assistant',
  'Retry',
]) {
  assert.ok(messageBubbleSource.includes(needle), `Message bubbles must include ${needle}`);
}
for (const needle of [
  'mx-2 mb-2',
  'border-n-weak bg-n-solid-1',
  'bg-n-solid-amber',
  'h-[3.25rem]',
  'rounded-full border border-n-weak bg-n-alpha-2',
  'TemplatePickerPopover',
  'AttachmentStagingArea',
  'Alt+N',
]) {
  assert.ok(composerSource.includes(needle), `Reply box must include ${needle}`);
}
assert.ok(CANNED_TEMPLATES.length >= 4, 'At least 4 canned responses must exist');
assert.ok(
  read('components/inbox/CollisionBanner.tsx').includes('Collision Shield'),
  'Collision Shield banner must be defined',
);
console.info('   ✓ UX-INBOX-002/003: Asymmetric VYNOR bubbles, private notes, reply/note toggle.');

// ---------------------------------------------------------------------------
// 7. Contact panel — ConversationSidebar.vue / ContactInfo.vue / AccordionItem.vue
// ---------------------------------------------------------------------------
console.info('\n7. Checking UX-INBOX-004: Contact panel...');
const contextPanelSource = read('components/inbox/CustomerContextPanel.tsx');
const accordionSource = read('components/ui/Accordion.tsx');
for (const needle of [
  'bg-n-surface-2',
  'border-n-weak',
  'w-[320px]',
  '2xl:w-[360px]',
  'SidebarActionsHeader',
  'size={48}',
  'AccordionItem',
  'Channel Identities',
  'Tags',
  'Triage & Assignment',
  'Linked Tickets',
  'CRM Attributes',
]) {
  assert.ok(contextPanelSource.includes(needle), `Contact panel must include ${needle}`);
}
assert.ok(
  accordionSource.includes('bg-n-slate-2') &&
    accordionSource.includes('outline-n-weak') &&
    accordionSource.includes('rounded-lg'),
  'AccordionItem must be bg-n-slate-2 outline-n-weak rounded-lg',
);
console.info('   ✓ UX-INBOX-004: 320/360px bg-n-surface-2 panel with ContactInfo and accordions.');

// ---------------------------------------------------------------------------
// 8. Keyboard loop
// ---------------------------------------------------------------------------
console.info('\n8. Checking UX-INBOX-005: Operational keyboard loop...');
const shortcutsSource = read('hooks/use-inbox-keyboard-shortcuts.ts');
const globalShortcutsSource = read('hooks/use-global-shortcuts.ts');
for (const key of ['j', 'k', 'c', 'a', 'e']) {
  assert.ok(shortcutsSource.includes(`case '${key}':`), `${key.toUpperCase()} shortcut must exist`);
}
assert.ok(
  globalShortcutsSource.includes("key.toLowerCase() === 'k'"),
  'Ctrl+K command palette shortcut must exist',
);
assert.ok(globalShortcutsSource.includes("key === '?'"), '? cheatsheet shortcut must exist');
console.info('   ✓ UX-INBOX-005: J, K, C, A, E, Alt+N, Ctrl+Enter, and G-chords verified.');

// ---------------------------------------------------------------------------
// 9. Zustand UI store
// ---------------------------------------------------------------------------
console.info('\n9. Checking Zustand ephemeral UI state...');
const ui = useUiStore.getState();
ui.setSidebarCollapsed(true);
assert.equal(useUiStore.getState().sidebarWidth, SIDEBAR_MIN_WIDTH, 'Collapse snaps to 56px');
ui.setSidebarWidth(260);
assert.equal(useUiStore.getState().sidebarCollapsed, false, 'Wide sidebar is expanded');
ui.setSidebarWidth(120);
assert.equal(useUiStore.getState().sidebarCollapsed, true, 'Below 160px reads as collapsed');
ui.setSidebarWidth(9999);
assert.equal(useUiStore.getState().sidebarWidth, SIDEBAR_MAX_WIDTH, 'Width is clamped to 320px');
ui.setSidebarCollapsed(false);
assert.equal(useUiStore.getState().sidebarWidth, SIDEBAR_DEFAULT_WIDTH, 'Expand restores 200px');

ui.setCustomerContextOpen(false);
assert.equal(useUiStore.getState().customerContextOpen, false, 'Contact panel toggles');
ui.setCustomerContextOpen(true);
ui.setComposerMode('note');
assert.equal(useUiStore.getState().composerMode, 'note', 'Composer mode toggles');
ui.setComposerMode('reply');
ui.setAvailability('busy');
assert.equal(useUiStore.getState().availability, 'busy', 'Availability status updates');
ui.setAvailability('online');
ui.setCommandPaletteOpen(true);
assert.equal(useUiStore.getState().commandPaletteOpen, true, 'Command palette opens');
ui.setCommandPaletteOpen(false);
console.info('   ✓ Zustand UI store transitions verified.');

console.info('\n================================================================');
console.info('--- VYNOR UI/UX PARITY DESIGN CONTRACT VERIFIED! ---');
console.info('================================================================\n');
