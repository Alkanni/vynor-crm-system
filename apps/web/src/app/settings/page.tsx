'use client';

import React, { useState } from 'react';
import {
  Settings,
  Users,
  Shield,
  Plug,
  History,
  Building,
  Plus,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { CANONICAL_PERMISSIONS } from '@vynor/contracts';
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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('team');
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

  const handleTogglePermission = (action: string) => {
    setRolePermissions((prev) => ({
      ...prev,
      [action]: !prev[action],
    }));
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText('vynor_live_994821a8d02e4822fa981');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Settings & Governance
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identity and Access Management (IAM), 24 canonical RBAC permissions, integrations, and
            audit trail
          </p>
        </div>
      </div>

      {/* 2-Column Administrative Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Subnav Index (3 cols) */}
        <div className="md:col-span-3 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xs text-left transition-colors',
              activeTab === 'team'
                ? 'bg-primary/10 text-primary border-l-2 border-primary font-bold'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <Users className="h-4 w-4" />
            <span>Team Members ({MOCK_MEMBERS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xs text-left transition-colors',
              activeTab === 'roles'
                ? 'bg-primary/10 text-primary border-l-2 border-primary font-bold'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <Shield className="h-4 w-4" />
            <span>Roles & Permissions (24 RBAC)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('integrations')}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xs text-left transition-colors',
              activeTab === 'integrations'
                ? 'bg-primary/10 text-primary border-l-2 border-primary font-bold'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <Plug className="h-4 w-4" />
            <span>API & Integrations</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xs text-left transition-colors',
              activeTab === 'audit'
                ? 'bg-primary/10 text-primary border-l-2 border-primary font-bold'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <History className="h-4 w-4" />
            <span>Audit Trail Log</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xs text-left transition-colors',
              activeTab === 'workspace'
                ? 'bg-primary/10 text-primary border-l-2 border-primary font-bold'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <Building className="h-4 w-4" />
            <span>Workspace Profile</span>
          </button>
        </div>

        {/* Right Content Panel (9 cols) */}
        <div className="md:col-span-9 flex flex-col gap-4">
          {/* Section 1: Team Members */}
          {activeTab === 'team' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Workspace Team Members</h2>
                  <p className="text-xs text-muted-foreground">
                    Manage active seats and operator invitations
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xs bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary-hover transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Invite Member</span>
                </button>
              </div>

              <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {MOCK_MEMBERS.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{m.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {m.email}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-xs bg-muted text-foreground border border-border">
                            {m.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.department}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-semibold text-[10px]',
                              m.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                            )}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            <span>{m.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground font-mono text-[11px]">
                          {m.lastActive}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 2: Roles & Permissions Matrix */}
          {activeTab === 'roles' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Granular RBAC Permission Matrix
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Canonical 24-permission enforcement engine (`resource:action`)
                  </p>
                </div>

                <div className="inline-flex rounded-xs border border-border bg-muted/40 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('AGENT')}
                    className={cn(
                      'px-2.5 py-1 font-semibold rounded-xs transition-colors',
                      selectedRole === 'AGENT'
                        ? 'bg-card text-foreground shadow-2xs'
                        : 'text-muted-foreground',
                    )}
                  >
                    Agent
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('SUPERVISOR')}
                    className={cn(
                      'px-2.5 py-1 font-semibold rounded-xs transition-colors',
                      selectedRole === 'SUPERVISOR'
                        ? 'bg-card text-foreground shadow-2xs'
                        : 'text-muted-foreground',
                    )}
                  >
                    Supervisor
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('ADMIN')}
                    className={cn(
                      'px-2.5 py-1 font-semibold rounded-xs transition-colors',
                      selectedRole === 'ADMIN'
                        ? 'bg-card text-foreground shadow-2xs'
                        : 'text-muted-foreground',
                    )}
                  >
                    Admin
                  </button>
                </div>
              </div>

              {/* Permissions List Grid */}
              <div className="rounded-lg border border-border bg-card divide-y divide-border/60 shadow-2xs">
                {CANONICAL_PERMISSIONS.map((perm) => {
                  const isEnabled = rolePermissions[perm.action] ?? selectedRole === 'ADMIN';
                  return (
                    <div
                      key={perm.action}
                      className="p-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {perm.action}
                          </span>
                          <span className="rounded-xs bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                            {perm.category}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5">
                          {perm.description}
                        </span>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          disabled={selectedRole === 'ADMIN'}
                          onChange={() => handleTogglePermission(perm.action)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Integrations & API */}
          {activeTab === 'integrations' && (
            <div className="flex flex-col gap-4">
              <div className="border-b border-border pb-3">
                <h2 className="text-sm font-bold text-foreground">
                  Developer API & Webhook Subscriptions
                </h2>
                <p className="text-xs text-muted-foreground">
                  Secret tokens and programmatic ingestion endpoints
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 shadow-2xs">
                <span className="text-xs font-bold text-foreground">Active Production API Key</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center rounded-xs border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground">
                    <Key className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
                    <span>
                      {showApiKey
                        ? 'vynor_live_994821a8d02e4822fa981'
                        : 'vynor_live_••••••••••••••••••••'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="p-1.5 rounded-xs border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                    title={showApiKey ? 'Hide Secret' : 'Reveal Secret'}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyApiKey}
                    className="inline-flex items-center gap-1.5 rounded-xs bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/80 text-foreground border border-border"
                  >
                    {copiedKey ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-foreground">
                      Inbound Webhook Subscription URL
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Real-time event notification delivery target
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Test Ping</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
                <div className="rounded-xs border border-border bg-background px-3 py-1.5 font-mono text-xs text-muted-foreground">
                  https://api.vynor.io/v1/webhooks/ingress/wh_live_8832901a
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Audit Logs */}
          {activeTab === 'audit' && (
            <div className="flex flex-col gap-4">
              <div className="border-b border-border pb-3">
                <h2 className="text-sm font-bold text-foreground">Immutable Audit Log</h2>
                <p className="text-xs text-muted-foreground">
                  Enterprise compliance log recording all sensitive actions
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Resource Target</th>
                      <th className="px-4 py-3 text-right">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {MOCK_AUDIT_LOGS.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-muted-foreground text-[11px]">
                          {log.timestamp}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">{log.actor}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-xs bg-primary/10 text-primary border border-primary/20">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{log.resource}</td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-muted-foreground">
                          {log.ipAddress}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 5: Workspace Profile */}
          {activeTab === 'workspace' && (
            <div className="flex flex-col gap-4">
              <div className="border-b border-border pb-3">
                <h2 className="text-sm font-bold text-foreground">
                  Workspace Profile & Localization
                </h2>
                <p className="text-xs text-muted-foreground">
                  Tenant organizational attributes and timezone defaults
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Organization Legal Name
                  </label>
                  <input
                    type="text"
                    defaultValue="VYNOR Indonesia Operations"
                    className="rounded-xs border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Workspace Slug</label>
                  <input
                    type="text"
                    defaultValue="vynor-hq"
                    disabled
                    className="rounded-xs border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Default Timezone</label>
                  <select
                    defaultValue="Asia/Jakarta"
                    className="rounded-xs border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="Asia/Jakarta">Asia/Jakarta (WIB - UTC+7)</option>
                    <option value="Asia/Makassar">Asia/Makassar (WITA - UTC+8)</option>
                    <option value="Asia/Jayapura">Asia/Jayapura (WIT - UTC+9)</option>
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Default Accounting Currency
                  </label>
                  <input
                    type="text"
                    defaultValue="IDR (Rp)"
                    disabled
                    className="rounded-xs border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
