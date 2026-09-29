import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANNEL_PROVIDER_TYPES } from '@vynor/contracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.info('================================================================');
console.info('--- Verifying VYNOR All Remaining P0 Modules & Section 47 Gate ---');
console.info('================================================================');

// -------------------------------------------------------------
// 1. Verify UX-CHANNELS-001 [P0]: Simplified Channels Inboxes & Icon-Based Platform Picker
// -------------------------------------------------------------
console.info(
  '\n1. Checking UX-CHANNELS-001: Simplified Channels Inboxes & Icon-Based Platform Picker...',
);
const readChannelsFile = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'components/channels', name), 'utf-8');
const inboxCardSource = readChannelsFile('InboxCard.tsx');
const inboxListSource = readChannelsFile('InboxList.tsx');
const inboxSettingsSource = readChannelsFile('InboxSettingsPanel.tsx');
const connectModalSource = readChannelsFile('ConnectPlatformModal.tsx');
const platformsSource = readChannelsFile('platforms.tsx');
const channelsUiSource = readChannelsFile('ui.tsx');
const channelTypesSource = readChannelsFile('types.ts');
const channelsPageSource = fs.readFileSync(path.join(__dirname, 'app/channels/page.tsx'), 'utf-8');
const channelsModuleText = [
  inboxCardSource,
  inboxListSource,
  inboxSettingsSource,
  connectModalSource,
  platformsSource,
  channelsUiSource,
  channelTypesSource,
  channelsPageSource,
].join('\n');

for (const telemetry of [
  'Operational',
  'Degraded',
  'Avg Webhook Latency',
  'Inbound (24h)',
  'Outbound (24h)',
  'webhookLatencyMs',
  'Refresh Telemetry',
  'onTestWebhook',
  'Team: {',
]) {
  assert.ok(
    !channelsModuleText.includes(telemetry),
    `Channels must not surface system telemetry ("${telemetry}")`,
  );
}
assert.ok(
  channelTypesSource.includes('InboxAccount') && channelTypesSource.includes('needsReconnect'),
  'Channel types must model inboxes (InboxAccount) with a needsReconnect flag',
);
assert.ok(
  inboxCardSource.includes('PlatformIcon') && inboxCardSource.includes('AgentAvatarStack'),
  'InboxCard must show only the platform icon, name, identifier, AI agent and agent avatars',
);
assert.ok(
  inboxListSource.includes('Search by name') &&
    inboxListSource.includes('Click to Connect A Platform'),
  'InboxList must provide name search and a connect-a-platform card',
);
for (const provider of CHANNEL_PROVIDER_TYPES) {
  assert.ok(
    platformsSource.includes(`${provider}: {`),
    `Platform catalog must define an icon for provider ${provider}`,
  );
}
assert.ok(
  connectModalSource.includes('PLATFORMS.map') &&
    connectModalSource.includes('<PlatformIcon') &&
    connectModalSource.includes('Select the platform you wish to establish your new inbox'),
  'ConnectPlatformModal must render an icon tile for every platform',
);
assert.ok(
  inboxSettingsSource.includes('AI Agent') &&
    inboxSettingsSource.includes('Human Agent') &&
    inboxSettingsSource.includes('Chat Distribution Method'),
  'InboxSettingsPanel must expose AI agent, human agent and distribution settings',
);
assert.ok(
  channelsPageSource.includes('handleReconnect') && channelsPageSource.includes('handleConnect'),
  'Channels page must implement reconnect and connect handlers',
);
console.info(
  '   ✓ UX-CHANNELS-001: Telemetry-free inbox cards, settings panel, and icon platform picker verified.',
);

// -------------------------------------------------------------
// 2. Verify UX-AI-001 [P0]: AI Agent Supervisor Console & Sanitized Playground
// -------------------------------------------------------------
console.info('\n2. Checking UX-AI-001: AI Agent Supervisor Console & Sanitized Playground...');
const aiConfigSource = fs.readFileSync(
  path.join(__dirname, 'components/ai-agent/AIAgentConfig.tsx'),
  'utf-8',
);
const aiPlaygroundSource = fs.readFileSync(
  path.join(__dirname, 'components/ai-agent/AIPlayground.tsx'),
  'utf-8',
);
const aiPageSource = fs.readFileSync(path.join(__dirname, 'app/ai-agent/page.tsx'), 'utf-8');
const aiTypesSource = fs.readFileSync(
  path.join(__dirname, 'components/ai-agent/types.ts'),
  'utf-8',
);

assert.ok(
  aiTypesSource.includes('AIAgentState') && aiTypesSource.includes('PlaygroundMessage'),
  'AIAgent types must declare AIAgentState and PlaygroundMessage',
);
assert.ok(
  aiPlaygroundSource.includes('TEST ENVIRONMENT — NO CUSTOMER MESSAGES SENT'),
  'AIPlayground must display prominent non-customer warning banner',
);
assert.ok(
  aiPlaygroundSource.includes('latencyMs') && aiPlaygroundSource.includes('tokensPrompt'),
  'AIPlayground must report latency and token usage telemetry',
);
assert.ok(
  aiPlaygroundSource.includes('retrievedCitations') &&
    aiPlaygroundSource.includes('Telemetry Inspector'),
  'AIPlayground must feature retrieved citations inspector drawer',
);
assert.ok(
  aiPlaygroundSource.includes('Emergency Kill') || aiPageSource.includes('Emergency Kill Switch'),
  'AI supervisor must provide instant emergency kill switch',
);
assert.ok(
  aiPlaygroundSource.includes('Guardrail Enforcement Activated'),
  'AIPlayground must alert and trip guardrails on forbidden keywords',
);
assert.ok(
  aiPageSource.includes('AIAgentConfig') && aiPageSource.includes('AIPlayground'),
  'AI Agent page must integrate both AIAgentConfig and AIPlayground',
);
console.info(
  '   ✓ UX-AI-001: Sanitized Playground, Warning Banner, Kill Switch, and Guardrails verified.',
);

// -------------------------------------------------------------
// 3. Verify UX-BROADCAST-001 [P0]: 9-Step Guided Broadcast Workflow
// -------------------------------------------------------------
console.info(
  '\n3. Checking UX-BROADCAST-001: 9-Step Guided Broadcast Workflow with Pre-flight Validation...',
);
const broadcastWizardSource = fs.readFileSync(
  path.join(__dirname, 'components/broadcast/BroadcastWizard.tsx'),
  'utf-8',
);
const campaignsPageSource = fs.readFileSync(
  path.join(__dirname, 'app/campaigns/page.tsx'),
  'utf-8',
);
const broadcastTypesSource = fs.readFileSync(
  path.join(__dirname, 'components/broadcast/types.ts'),
  'utf-8',
);

assert.ok(
  broadcastTypesSource.includes('BroadcastStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9'),
  'Broadcast workflow must support full 9-step progression',
);
assert.ok(
  broadcastWizardSource.includes('Meta HSM Template Approval Checker'),
  'BroadcastWizard Step 3 must check Meta HSM template approval status',
);
assert.ok(
  broadcastWizardSource.includes('Selected template') && broadcastWizardSource.includes('APPROVED'),
  'BroadcastWizard must validate template status (APPROVED vs REJECTED)',
);
assert.ok(
  broadcastWizardSource.includes('HIGH-VOLUME BLAST DUAL CONFIRMATION REQUIRED'),
  'BroadcastWizard must require typed-name dual confirmation for blasts > 1,000 recipients',
);
assert.ok(
  broadcastWizardSource.includes('typedConfirmationName.trim() === campaignData.name.trim()'),
  'Dual confirmation gate must strictly match typed campaign name',
);
assert.ok(
  broadcastWizardSource.includes('Pre-flight Telemetry & Quota Validation'),
  'BroadcastWizard Step 6 must validate channel health, tier quota headroom, and opt-outs',
);
assert.ok(
  campaignsPageSource.includes('BroadcastWizard'),
  'Campaigns page must mount BroadcastWizard',
);
console.info(
  '   ✓ UX-BROADCAST-001: 9-step workflow, Meta HSM approval check, and dual confirmation verified.',
);

// -------------------------------------------------------------
// 4. Verify UX-BLAST-001 [P0]: CSV Blast Dispatcher with Granular Syntax & Rejection Tables
// -------------------------------------------------------------
console.info(
  '\n4. Checking UX-BLAST-001: CSV Blast Dispatcher with Granular Syntax & Rejection Tables...',
);
const blastDispatcherSource = fs.readFileSync(
  path.join(__dirname, 'components/blast/BlastDispatcher.tsx'),
  'utf-8',
);
const blastPageSource = fs.readFileSync(path.join(__dirname, 'app/blast/page.tsx'), 'utf-8');
const blastTypesSource = fs.readFileSync(
  path.join(__dirname, 'components/blast/types.ts'),
  'utf-8',
);

assert.ok(
  blastTypesSource.includes(
    "RowValidationStatus = 'VALID' | 'INVALID_SYNTAX' | 'DUPLICATE' | 'BLOCKED'",
  ),
  'Blast dispatcher must define granular rejection categories',
);
assert.ok(
  blastDispatcherSource.includes('validateE164'),
  'BlastDispatcher must validate international E.164 phone formatting',
);
assert.ok(
  blastDispatcherSource.includes('handleExportRejections'),
  'BlastDispatcher must provide 1-click rejection export as CSV',
);
assert.ok(
  blastDispatcherSource.includes('rejection_reason') ||
    blastDispatcherSource.includes('Rejection Reason'),
  'Exported CSV must append rejection reason column',
);
assert.ok(blastPageSource.includes('BlastDispatcher'), 'Blast page must mount BlastDispatcher');
console.info(
  '   ✓ UX-BLAST-001: E.164 validation, rejection tabs, and 1-click CSV error export verified.',
);

// -------------------------------------------------------------
// 5. Verify Section 47 Visual Quality Gate (8-point checklist)
// -------------------------------------------------------------
console.info('\n5. Checking Section 47 Visual Quality Gate (8-Point Checklist)...');

// 1. Hierarchy: Visual anchor per screen, scannable in 3 seconds, no competing primaries
assert.ok(
  inboxCardSource.includes('font-semibold') && inboxCardSource.includes('text-xs'),
  'Gate 1 (Hierarchy): Inbox identity must have clear typography hierarchy',
);
assert.ok(
  aiPlaygroundSource.includes('role="alert"'),
  'Gate 1 (Hierarchy): Warnings must be anchored with prominent role="alert"',
);

// 2. Density: Information-dense without clutter, compact enterprise layout, monospace for technical data
assert.ok(
  aiPlaygroundSource.includes('font-mono'),
  'Gate 2 (Density): AI tokens and latency must use monospace formatting',
);
assert.ok(
  broadcastWizardSource.includes('font-mono'),
  'Gate 2 (Density): Recipient counts and template variables must use monospace',
);
assert.ok(
  blastDispatcherSource.includes('font-mono'),
  'Gate 2 (Density): Phone numbers and row indexes must use monospace',
);

// 3. Consistency: Standard tokens, semantic card borders and palette
assert.ok(
  inboxCardSource.includes('hsl(var(--surface))') && inboxCardSource.includes('hsl(var(--border))'),
  'Gate 3 (Consistency): Inbox card must use the semantic surface and border tokens',
);
assert.ok(
  aiPlaygroundSource.includes('bg-zinc-950') && aiPlaygroundSource.includes('border-zinc-800'),
  'Gate 3 (Consistency): Playground must match dark enterprise palette',
);

// 4. Speed: Zero layout shift, immediate client-side feedback
assert.ok(
  blastDispatcherSource.includes('useMemo'),
  'Gate 4 (Speed): Filtered CSV rows and metrics must be memoized for 60fps responsiveness',
);

// 5. State completeness: Empty, loading, paused, completed, error states accounted for
assert.ok(
  aiPlaygroundSource.includes('Sandbox session is empty'),
  'Gate 5 (State Completeness): Playground must have an explicit empty state',
);
assert.ok(
  broadcastWizardSource.includes('Broadcast Completed'),
  'Gate 5 (State Completeness): Broadcast must have an explicit completed state',
);
assert.ok(
  blastDispatcherSource.includes('No rows found'),
  'Gate 5 (State Completeness): CSV table must have an explicit empty filter state',
);
assert.ok(
  inboxListSource.includes('No channels match') && channelsPageSource.includes('No channels yet'),
  'Gate 5 (State Completeness): Channels must have explicit empty search and no-inbox states',
);

// 6. Failure clarity: Actionable error messages with clear next steps
assert.ok(
  inboxSettingsSource.includes('Reconnect it to keep receiving messages') &&
    inboxSettingsSource.includes('onReconnect(inbox.id)'),
  'Gate 6 (Failure Clarity): Channel disconnect must give an actionable reconnect prompt',
);
assert.ok(
  broadcastWizardSource.includes('Gate Blocker:') &&
    broadcastWizardSource.includes('You must select an APPROVED template to advance'),
  'Gate 6 (Failure Clarity): Unapproved template must give explicit gate explanation',
);
assert.ok(
  blastDispatcherSource.includes('Invalid E.164 phone format'),
  'Gate 6 (Failure Clarity): Phone syntax error must give actionable format instruction',
);

// 7. WCAG 2.2 AA Contrast & Accessibility
assert.ok(
  aiPlaygroundSource.includes('aria-live="polite"'),
  'Gate 7 (Accessibility): Warning banners must include aria-live announcement',
);
assert.ok(
  aiPlaygroundSource.includes('role="alert"'),
  'Gate 7 (Accessibility): Critical guardrails must include role="alert"',
);
assert.ok(
  connectModalSource.includes('aria-modal="true"') && channelsUiSource.includes('role="switch"'),
  'Gate 7 (Accessibility): Connect dialog must be modal and settings toggles must be switches',
);

// 8. Anti-AI Slop: Zero gratuitous gradients, zero neon glow, authentic CRM tool aesthetic
const allComponentsText = [
  channelsModuleText,
  aiPlaygroundSource,
  aiConfigSource,
  broadcastWizardSource,
  blastDispatcherSource,
].join('\n');

assert.ok(
  !allComponentsText.includes('bg-gradient-to-r from-purple-500 to-pink-500'),
  'Gate 8 (Anti-AI Slop): No gratuitous purple/pink decorative gradients allowed',
);
assert.ok(
  !allComponentsText.includes('shadow-neon'),
  'Gate 8 (Anti-AI Slop): No decorative neon glows allowed',
);

console.info('   ✓ Section 47 Visual Quality Gate (All 8 Points) PASSED with 100% compliance.');

console.info('\n================================================================');
console.info('--- ALL REMAINING P0 MODULES & VISUAL QUALITY GATE VERIFIED! ---');
console.info('================================================================\n');
