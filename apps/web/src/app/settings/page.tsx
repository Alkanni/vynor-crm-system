'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Check, Copy, ExternalLink, Eye, EyeOff, Key, Plus } from 'lucide-react';
import { CANONICAL_PERMISSIONS } from '@vynor/contracts';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  SectionCard,
  StatusBadge,
  TABLE_CLASS,
  TBODY_CLASS,
  TD_CLASS,
  TH_CLASS,
  THEAD_CLASS,
} from '@/components/layout/Section';
import { Avatar, Button, Input, Label, Select, Switch, TabBar, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';

type SettingsTab = 'team' | 'roles' | 'integrations' | 'audit' | 'workspace';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT' | 'SUPERVISOR';
  department: string;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  lastActive: string;
}

const MOCK_MEMBERS: TeamMember[] = [
  {
    id: 'usr_01',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@vynor.io',
    role: 'ADMIN',
    department: 'Customer Support',
    status: 'ACTIVE',
    lastActive: 'Just now',
  },
  {
    id: 'usr_02',
    name: 'Rizky Pratama',
    email: 'rizky.pratama@vynor.io',
    role: 'SUPERVISOR',
    department: 'Enterprise Sales',
    status: 'ACTIVE',
    lastActive: '12m ago',
  },
  {
    id: 'usr_03',
    name: 'Dian Sastro',
    email: 'dian.sastro@vynor.io',
    role: 'AGENT',
    department: 'Customer Support',
    status: 'ACTIVE',
    lastActive: '1h ago',
  },
  {
    id: 'usr_04',
    name: 'Budi Santoso',
    email: 'budi.santoso@vynor.io',
    role: 'AGENT',
    department: 'Billing & Ops',
    status: 'ACTIVE',
    lastActive: '3h ago',
  },
  {
    id: 'usr_05',
    name: 'Farhan Maulana',
    email: 'farhan.m@vynor.io',
    role: 'AGENT',
    department: 'Tier 1 Support',
    status: 'INVITED',
    lastActive: 'Pending invite',
  },
];

interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  resource: string;
  ipAddress: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
}

const MOCK_AUDIT_LOGS: AuditLogRow[] = [
  {
    id: 'aud_01',
    actor: 'sarah.jenkins@vynor.io',
    action: 'campaign:launch',
    resource: 'Broadcast #BC-2026-Q1',
    ipAddress: '103.24.120.4',
    timestamp: '14:20:15 WIB',
    status: 'SUCCESS',
  },
  {
    id: 'aud_02',
    actor: 'rizky.pratama@vynor.io',
    action: 'role:update',
    resource: 'Role: Tier 1 Agent',
    ipAddress: '180.252.88.19',
    timestamp: '13:45:00 WIB',
    status: 'SUCCESS',
  },
  {
    id: 'aud_03',
    actor: 'budi.santoso@vynor.io',
    action: 'export:csv',
    resource: 'Customer Directory (50 records)',
    ipAddress: '36.85.12.190',
    timestamp: '11:10:22 WIB',
    status: 'SUCCESS',
  },
  {
    id: 'aud_04',
    actor: 'system',
    action: 'auth:failed_attempt',
    resource: 'Session /auth/token',
    ipAddress: '194.26.29.112',
    timestamp: '09:02:14 WIB',
    status: 'WARNING',
  },
];

const SECTION_BY_PATH: Record<string, SettingsTab> = {
  '/settings': 'workspace',
  '/settings/teams': 'team',
  '/settings/roles': 'roles',
  '/settings/integrations': 'integrations',
  '/settings/audit': 'audit',
};

const SECTION_HEADERS: Record<SettingsTab, { title: string; description: string }> = {
  workspace: {
    title: 'Account settings',
    description: 'Organization profile, workspace slug, and localization defaults for this tenant.',
  },
  team: {
    title: 'Team members',
    description: 'Manage active seats and operator invitations for this workspace.',
  },
  roles: {
    title: 'Roles & access',
    description: 'Canonical RBAC permission matrix (resource:action) enforced for every role.',
  },
  integrations: {
    title: 'API & integrations',
    description: 'Secret tokens and programmatic ingestion endpoints.',
  },
  audit: {
    title: 'Audit logs',
    description: 'Immutable compliance log of every sensitive action in the workspace.',
  },
};

const ROLE_TONE: Record<TeamMember['role'], 'blue' | 'iris' | 'teal' | 'slate'> = {
  OWNER: 'blue',
  ADMIN: 'iris',
  SUPERVISOR: 'teal',
  AGENT: 'slate',
};

const AUDIT_TONE: Record<AuditLogRow['status'], 'teal' | 'amber' | 'ruby'> = {
  SUCCESS: 'teal',
  WARNING: 'amber',
  FAILED: 'ruby',
};

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default function SettingsPage() {
  const pathname = usePathname();
  const activeTab: SettingsTab = SECTION_BY_PATH[pathname] ?? 'workspace';
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'AGENT' | 'SUPERVISOR' | 'ADMIN'>('AGENT');
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean>>({
    'conversation:read': true,
    'conversation:write': true,
    'conversation:assign': true,
    'conversation:close': true,
    'message:read': true,
    'message:send': true,
    'contact:read': true,
    'contact:write': true,
    'workspace:read': true,
  });
  const toast = useToast();

  const handleTogglePermission = (action: string) => {
    setRolePermissions((prev) => ({
      ...prev,
      [action]: !prev[action],
    }));
  };

  const handleCopyApiKey = () => {
    void navigator.clipboard?.writeText('vynor_live_994821a8d02e4822fa981');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const header = SECTION_HEADERS[activeTab];

  return (
    <PageLayout
      title={header.title}
      description={header.description}
      actions={
        activeTab === 'team' ? (
          <Button
            size="sm"
            icon={Plus}
            label="Invite member"
            onClick={() =>
              toast.show('Invitations are sent from the production workspace.', 'info')
            }
          />
        ) : activeTab === 'roles' ? (
          <TabBar<'AGENT' | 'SUPERVISOR' | 'ADMIN'>
            ariaLabel="Role"
            value={selectedRole}
            onChange={setSelectedRole}
            tabs={[
              { value: 'AGENT', label: 'Agent' },
              { value: 'SUPERVISOR', label: 'Supervisor' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
          />
        ) : undefined
      }
    >
      {activeTab === 'team' && (
        <div className="overflow-x-auto">
          <table className={TABLE_CLASS}>
            <thead className={THEAD_CLASS}>
              <tr>
                <th className={TH_CLASS}>Member</th>
                <th className={TH_CLASS}>Role</th>
                <th className={TH_CLASS}>Department</th>
                <th className={TH_CLASS}>Status</th>
                <th className={cn(TH_CLASS, 'text-end')}>Last active</th>
              </tr>
            </thead>
            <tbody className={TBODY_CLASS}>
              {MOCK_MEMBERS.map((m) => (
                <tr key={m.id}>
                  <td className={TD_CLASS}>
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} size={32} roundedFull />
                      <div className="min-w-0">
                        <div className="truncate text-n-slate-12">{m.name}</div>
                        <div className="truncate text-xs text-n-slate-11">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className={TD_CLASS}>
                    <StatusBadge tone={ROLE_TONE[m.role]}>{titleCase(m.role)}</StatusBadge>
                  </td>
                  <td className={cn(TD_CLASS, 'whitespace-nowrap')}>{m.department}</td>
                  <td className={TD_CLASS}>
                    <StatusBadge
                      tone={m.status === 'ACTIVE' ? 'teal' : 'amber'}
                      icon={<span className="size-1.5 rounded-full bg-current" />}
                    >
                      {titleCase(m.status)}
                    </StatusBadge>
                  </td>
                  <td className={cn(TD_CLASS, 'whitespace-nowrap text-end')}>{m.lastActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'roles' && (
        <SectionCard bodyClassName="p-0">
          <ul className="m-0 list-none divide-y divide-n-weak p-0">
            {CANONICAL_PERMISSIONS.map((perm) => {
              const isEnabled = rolePermissions[perm.action] ?? selectedRole === 'ADMIN';
              return (
                <li
                  key={perm.action}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-n-slate-12">{perm.action}</span>
                      <Label compact label={perm.category} className="capitalize" />
                    </div>
                    <span className="text-sm text-n-slate-11">{perm.description}</span>
                  </div>
                  <Switch
                    checked={selectedRole === 'ADMIN' ? true : isEnabled}
                    disabled={selectedRole === 'ADMIN'}
                    onChange={() => handleTogglePermission(perm.action)}
                    label={`Toggle ${perm.action}`}
                  />
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      {activeTab === 'integrations' && (
        <div className="flex flex-col gap-4">
          <SectionCard
            title="Production API key"
            description="Use this key to authenticate server-to-server requests."
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg bg-n-alpha-black2 px-3 font-mono text-sm text-n-slate-12 outline outline-1 -outline-offset-1 outline-n-weak">
                <Key className="mr-2 size-4 shrink-0 text-n-slate-11" />
                <span className="truncate">
                  {showApiKey
                    ? 'vynor_live_994821a8d02e4822fa981'
                    : 'vynor_live_••••••••••••••••••••'}
                </span>
              </div>
              <Button
                variant="faded"
                color="slate"
                icon={showApiKey ? EyeOff : Eye}
                aria-label={showApiKey ? 'Hide secret' : 'Reveal secret'}
                title={showApiKey ? 'Hide secret' : 'Reveal secret'}
                onClick={() => setShowApiKey(!showApiKey)}
              />
              <Button
                variant="faded"
                color="slate"
                icon={copiedKey ? Check : Copy}
                label={copiedKey ? 'Copied' : 'Copy'}
                onClick={handleCopyApiKey}
                className={cn(copiedKey && '!text-n-teal-11')}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Inbound webhook URL"
            description="Real-time event notification delivery target."
            actions={
              <Button
                variant="link"
                size="sm"
                icon={ExternalLink}
                trailingIcon
                label="Test ping"
                onClick={() => toast.show('Ping delivered to the webhook endpoint.')}
              />
            }
          >
            <div className="rounded-lg bg-n-alpha-black2 px-3 py-2.5 font-mono text-sm text-n-slate-11 outline outline-1 -outline-offset-1 outline-n-weak">
              https://api.vynor.io/v1/webhooks/ingress/wh_live_8832901a
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="overflow-x-auto">
          <table className={TABLE_CLASS}>
            <thead className={THEAD_CLASS}>
              <tr>
                <th className={TH_CLASS}>Time</th>
                <th className={TH_CLASS}>Actor</th>
                <th className={TH_CLASS}>Action</th>
                <th className={TH_CLASS}>Resource</th>
                <th className={TH_CLASS}>Result</th>
                <th className={cn(TH_CLASS, 'text-end')}>IP address</th>
              </tr>
            </thead>
            <tbody className={TBODY_CLASS}>
              {MOCK_AUDIT_LOGS.map((log) => (
                <tr key={log.id}>
                  <td className={cn(TD_CLASS, 'whitespace-nowrap tabular-nums')}>
                    {log.timestamp}
                  </td>
                  <td className={cn(TD_CLASS, 'whitespace-nowrap text-n-slate-12')}>{log.actor}</td>
                  <td className={TD_CLASS}>
                    <Label compact color="blue" label={log.action} className="font-mono" />
                  </td>
                  <td className={TD_CLASS}>{log.resource}</td>
                  <td className={TD_CLASS}>
                    <StatusBadge tone={AUDIT_TONE[log.status]}>{titleCase(log.status)}</StatusBadge>
                  </td>
                  <td className={cn(TD_CLASS, 'whitespace-nowrap text-end font-mono text-xs')}>
                    {log.ipAddress}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'workspace' && (
        <div className="flex max-w-2xl flex-col gap-5">
          <Input label="Organization legal name" defaultValue="VYNOR Indonesia Operations" />
          <Input
            label="Workspace slug"
            defaultValue="vynor-hq"
            disabled
            message="The slug is used in URLs and cannot be changed."
            className="font-mono"
          />
          <Select label="Default timezone" defaultValue="Asia/Jakarta">
            <option value="Asia/Jakarta">Asia/Jakarta (WIB · UTC+7)</option>
            <option value="Asia/Makassar">Asia/Makassar (WITA · UTC+8)</option>
            <option value="Asia/Jayapura">Asia/Jayapura (WIT · UTC+9)</option>
            <option value="UTC">Coordinated Universal Time (UTC)</option>
          </Select>
          <Input label="Default accounting currency" defaultValue="IDR (Rp)" disabled />
          <div>
            <Button
              size="sm"
              label="Update settings"
              onClick={() => toast.show('Workspace settings saved')}
            />
          </div>
        </div>
      )}
      {toast.element}
    </PageLayout>
  );
}
