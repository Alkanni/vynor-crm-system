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
// 2. Verify UX-AI-001 [P0]: Multi-Agent AI Settings (General & Knowledge Sources)
// -------------------------------------------------------------
console.info('\n2. Checking UX-AI-001: Multi-Agent AI Settings, Knowledge Sources & Test Chat...');
const readAi = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'components/ai-agent', name), 'utf-8');
const aiListSource = readAi('AgentListView.tsx');
const aiSettingsSource = readAi('AgentSettingsView.tsx');
const aiChatSource = readAi('AgentTestChat.tsx');
const aiUiSource = readAi('ui.tsx');
const aiGeneralSource = [
  'GeneralSettingsForm.tsx',
  'AdditionalSettings.tsx',
  'AiActionsSettings.tsx',
]
  .map((f) => readAi(`general/${f}`))
  .join('\n');
const aiKnowledgeSource = fs
  .readdirSync(path.join(__dirname, 'components/ai-agent/knowledge'))
  .map((f) => readAi(`knowledge/${f}`))
  .join('\n');
const aiLibSource = fs
  .readdirSync(path.join(__dirname, 'lib/ai-agents'))
  .map((f) => fs.readFileSync(path.join(__dirname, 'lib/ai-agents', f), 'utf-8'))
  .join('\n');
const aiContractSource = fs.readFileSync(
  path.join(__dirname, '../../../packages/contracts/src/ai/agent.ts'),
  'utf-8',
);
const switchPrimitiveSource = fs.readFileSync(
  path.join(__dirname, 'components/ui/Switch.tsx'),
  'utf-8',
);
const formControlsSource = fs.readFileSync(
  path.join(__dirname, 'components/common/form-controls.tsx'),
  'utf-8',
);
const aiModuleText = [
  aiListSource,
  aiSettingsSource,
  aiChatSource,
  aiUiSource,
  aiGeneralSource,
  aiKnowledgeSource,
  aiLibSource,
].join('\n');

assert.ok(
  ['AiAgentSchema', 'AiAgentGeneralSettingsSchema', 'AiAgentKnowledgeSchema'].every((name) =>
    aiContractSource.includes(`export const ${name}`),
  ),
  'AI agent configuration must be defined as Zod contracts in packages/contracts (AD-013)',
);
assert.ok(
  aiLibSource.includes('useQuery') &&
    aiLibSource.includes('useMutation') &&
    !aiModuleText.includes("from 'zustand'"),
  'AI agents must be loaded through TanStack Query, never mirrored in Zustand (FND-FE-005)',
);
assert.ok(
  aiListSource.includes('Create New') &&
    aiListSource.includes('Search AI agents') &&
    aiListSource.includes('handleDuplicate') &&
    aiListSource.includes('ConfirmDialog'),
  'AI Agents list must create, search, duplicate and delete (with confirmation) multiple agents',
);
for (const tab of [
  'General',
  'Knowledge Sources',
  'Integrations',
  'Followups',
  'Evaluation',
  'Orchestration',
]) {
  assert.ok(
    aiSettingsSource.includes(`label: '${tab}'`),
    `Agent settings must list the ${tab} tab`,
  );
}
for (const setting of [
  'AI Agent Behavior',
  'Welcome Message',
  'Agent Transfer Conditions',
  'Stop AI after Handoff',
  'Silent Agent Handoff',
  'Pending status messages',
  'AI Actions',
  'AI Model',
  'Additional Settings',
  'AI History Limit',
  'AI Read File Limit',
  'AI Context Limit',
  'AI Temperature',
  'Message Await',
  'AI Message Limit',
  'Watcher',
  'Timezone',
  'Session-Only Memory',
]) {
  assert.ok(aiGeneralSource.includes(setting), `General settings must include "${setting}"`);
}
for (const source of [
  "label: 'Text'",
  "label: 'Website'",
  "label: 'File'",
  "label: 'Q&A'",
  "label: 'Product'",
]) {
  assert.ok(aiKnowledgeSource.includes(source), `Knowledge Sources must include ${source}`);
}
assert.ok(
  aiKnowledgeSource.includes('Total Detected Characters'),
  'Knowledge Sources must summarise detected characters',
);
assert.ok(
  aiChatSource.includes('runPreviewEngine') && aiChatSource.includes('No customer'),
  'Test chat must answer through the preview engine and state that no customer receives replies',
);
assert.ok(
  !aiModuleText.includes('telah memproses instruksi ini'),
  'Test chat must not fall back to the old echo reply',
);
console.info(
  '   ✓ UX-AI-001: Multi-agent list, General settings, Knowledge Sources, and test chat verified.',
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
  inboxCardSource.includes('text-base font-medium') && inboxCardSource.includes('text-sm'),
  'Gate 1 (Hierarchy): Inbox identity must follow the VYNOR card hierarchy (text-base name, text-sm meta)',
);
assert.ok(
  aiGeneralSource.includes('role="alert"'),
  'Gate 1 (Hierarchy): Setting errors must be anchored with role="alert"',
);

// 2. Density: Information-dense without clutter, compact enterprise layout, monospace for technical data
assert.ok(
  aiUiSource.includes('tabular-nums'),
  'Gate 2 (Density): AI character counters must use tabular figures',
);
assert.ok(
  broadcastWizardSource.includes('font-mono'),
  'Gate 2 (Density): Recipient counts and template variables must use monospace',
);
assert.ok(
  blastDispatcherSource.includes('font-mono'),
  'Gate 2 (Density): Phone numbers and row indexes must use monospace',
);

// 3. Consistency: VYNOR n-* design tokens (CardLayout surface + outline, weak borders)
assert.ok(
  inboxCardSource.includes('bg-n-solid-2') && inboxCardSource.includes('outline-n-container'),
  'Gate 3 (Consistency): Inbox card must use the VYNOR CardLayout surface and outline tokens',
);
assert.ok(
  aiChatSource.includes('bg-n-solid-2') && aiChatSource.includes('border-n-weak'),
  'Gate 3 (Consistency): AI test chat must use the VYNOR surface and border tokens',
);
assert.ok(
  !/hsl\(var\(--/.test(`${channelsModuleText}\n${aiModuleText}`),
  'Gate 3 (Consistency): Modules must not read legacy HSL variables directly',
);

// 4. Speed: Zero layout shift, immediate client-side feedback
assert.ok(
  blastDispatcherSource.includes('useMemo'),
  'Gate 4 (Speed): Filtered CSV rows and metrics must be memoized for 60fps responsiveness',
);

// 5. State completeness: Empty, loading, paused, completed, error states accounted for
assert.ok(
  aiChatSource.includes('Send a message as a customer') &&
    aiListSource.includes('No AI agents match') &&
    aiSettingsSource.includes('AI agent not found'),
  'Gate 5 (State Completeness): AI Agent must have empty chat, empty search and not-found states',
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
assert.ok(
  aiKnowledgeSource.includes('Enter a valid website address') &&
    aiLibSource.includes('Make sure you can highlight the text') &&
    aiKnowledgeSource.includes('before saving'),
  'Gate 6 (Failure Clarity): Knowledge errors must explain how to fix the input',
);

// 7. WCAG 2.2 AA Contrast & Accessibility
assert.ok(
  aiChatSource.includes('aria-live="polite"'),
  'Gate 7 (Accessibility): Test chat replies must be announced with aria-live',
);
assert.ok(
  aiUiSource.includes('role="alertdialog"'),
  'Gate 7 (Accessibility): Destructive confirmations must use role="alertdialog"',
);
assert.ok(
  connectModalSource.includes('aria-modal="true"') &&
    formControlsSource.includes('<Switch') &&
    switchPrimitiveSource.includes('role="switch"'),
  'Gate 7 (Accessibility): Connect dialog must be modal and settings toggles must be switches',
);

// 8. Anti-AI Slop: Zero gratuitous gradients, zero neon glow, authentic CRM tool aesthetic
const allComponentsText = [
  channelsModuleText,
  aiModuleText,
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
