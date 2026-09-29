'use client';

import { useParams } from 'next/navigation';
import { AgentSettingsView } from '@/components/ai-agent/AgentSettingsView';

export default function AIAgentSettingsPage() {
  const { agentId } = useParams<{ agentId: string }>();
  return <AgentSettingsView agentId={agentId} />;
}
