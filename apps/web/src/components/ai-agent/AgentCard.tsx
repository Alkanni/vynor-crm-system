'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, Copy, Settings, Trash2 } from 'lucide-react';
import type { AiAgent } from '@vynor/contracts';
import { StatusBadge } from '@/components/layout/Section';
import { Avatar, Button, buttonVariants, CardLayout } from '@/components/ui';

interface AgentCardProps {
  agent: AiAgent;
  onDuplicate: (agent: AiAgent) => void;
  onDelete: (agent: AiAgent) => void;
}

/** AI agent card on the VYNOR `CardLayout` surface (Captain assistant card pattern). */
export function AgentCard({ agent, onDuplicate, onDelete }: AgentCardProps) {
  const excerpt = agent.general.behavior.trim().split('\n')[0] || '-';

  return (
    <CardLayout bodyClassName="h-full min-h-[216px] gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={agent.name} size={40} icon={Bot} />
          <div className="min-w-0">
            <h2 className="m-0 truncate text-base font-medium text-n-slate-12" title={agent.name}>
              {agent.name}
            </h2>
            <StatusBadge tone={agent.status === 'PAUSED' ? 'amber' : 'teal'}>
              {agent.status === 'PAUSED' ? 'Paused' : 'Active'}
            </StatusBadge>
          </div>
        </div>
      </div>
      <p className="m-0 line-clamp-2 text-sm text-n-slate-11" title={excerpt}>
        {excerpt}
      </p>
      <div className="mt-auto flex items-center gap-2">
        <Link
          href={`/ai-agent/${agent.id}`}
          className={buttonVariants({ size: 'sm', color: 'slate', variant: 'faded' })}
        >
          <Settings className="size-4" />
          Settings
        </Link>
        <Button
          size="sm"
          variant="faded"
          color="slate"
          icon={Copy}
          onClick={() => onDuplicate(agent)}
          aria-label={`Duplicate ${agent.name}`}
          title="Duplicate"
        />
        <Button
          size="sm"
          variant="faded"
          color="ruby"
          icon={Trash2}
          onClick={() => onDelete(agent)}
          aria-label={`Delete ${agent.name}`}
          title="Delete"
        />
      </div>
    </CardLayout>
  );
}
