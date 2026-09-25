'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Download,
  Phone,
  Mail,
  Tag,
  X,
  MessageSquare,
  Clock,
  Shield,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { ChannelBadge } from '@/components/inbox/ChannelBadge';
import type { ChannelType } from '@/components/inbox/types';
import { cn } from '@/lib/utils';

interface ContactRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  channels: ChannelType[];
  tags: string[];
  totalConversations: number;
  lastActive: string;
  assignedTeam: string;
  customFields: Record<string, string>;
  isOnline: boolean;
}

const MOCK_CONTACTS: ContactRecord[] = [
  {
    id: 'ct_01',
    name: 'Budi Santoso',
    phone: '+62 812-3456-7890',
    email: 'budi.santoso@example.com',
    channels: ['WHATSAPP', 'EMAIL'],
    tags: ['vip-customer', 'enterprise', 'repeat-buyer'],
    totalConversations: 14,
    lastActive: '2m ago',
    assignedTeam: 'Customer Care',
    customFields: {
      'Customer Tier': 'Platinum Enterprise',
      'Account Manager': 'Sarah Jenkins',
      'Total Lifetime Value': 'IDR 45.200.000',
      'Primary Province': 'DKI Jakarta',
    },
    isOnline: true,
  },
  {
    id: 'ct_02',
    name: 'Siti Rahmawati',
    phone: '+62 811-9876-5432',
    email: 'siti.rahma@enterprise.co.id',
    channels: ['WHATSAPP', 'INSTAGRAM'],
    tags: ['billing-inquiry', 'priority-sla'],
    totalConversations: 8,
    lastActive: '15m ago',
    assignedTeam: 'Billing & Support',
    customFields: {
      'Customer Tier': 'Gold Member',
      'Account Manager': 'Alex Rivera',
      'Total Lifetime Value': 'IDR 12.800.000',
      'Primary Province': 'Jawa Barat',
    },
    isOnline: false,
  },
  {
    id: 'ct_03',
    name: 'Ahmad Fauzi',
    phone: '+62 813-7766-5544',
    email: 'ahmad.fauzi@techindo.com',
    channels: ['TELEGRAM', 'WEBCHAT'],
    tags: ['tech-partner', 'api-integration'],
    totalConversations: 22,
    lastActive: '1h ago',
    assignedTeam: 'Technical Escalations',
    customFields: {
      'Customer Tier': 'Developer Partner',
      'Account Manager': 'DevOps Lead',
      'Total Lifetime Value': 'IDR 8.500.000',
      'Primary Province': 'Jawa Timur',
    },
    isOnline: true,
  },
  {
    id: 'ct_04',
    name: 'Dewi Lestari',
    phone: '+62 818-0912-3456',
    email: 'dewi.lestari@boutique.id',
    channels: ['INSTAGRAM', 'WHATSAPP'],
    tags: ['social-influencer', 'wholesale'],
    totalConversations: 5,
    lastActive: '3h ago',
    assignedTeam: 'Social Sales',
    customFields: {
      'Customer Tier': 'Influencer Partner',
      'Account Manager': 'Social Team',
      'Total Lifetime Value': 'IDR 24.000.000',
      'Primary Province': 'Bali',
    },
    isOnline: false,
  },
  {
    id: 'ct_05',
    name: 'Hendra Setiawan',
    phone: '+62 812-4433-2211',
    email: 'hendra.s@logistics-corp.com',
    channels: ['WHATSAPP', 'EMAIL', 'TELEGRAM'],
    tags: ['logistics', 'sla-critical'],
    totalConversations: 31,
    lastActive: 'Yesterday',
    assignedTeam: 'Enterprise Support',
    customFields: {
      'Customer Tier': 'Diamond Global',
      'Account Manager': 'Enterprise Director',
      'Total Lifetime Value': 'IDR 180.000.000',
      'Primary Province': 'Sumatera Utara',
    },
    isOnline: false,
  },
  {
    id: 'ct_06',
    name: 'Lina Marlina',
    phone: '+62 815-5566-7788',
    email: 'lina.marlina@gmail.com',
    channels: ['WEBCHAT'],
    tags: ['new-signup', 'onboarding'],
    totalConversations: 2,
    lastActive: '2 days ago',
    assignedTeam: 'Customer Care',
    customFields: {
      'Customer Tier': 'Standard Starter',
      'Account Manager': 'Unassigned',
      'Total Lifetime Value': 'IDR 1.200.000',
      'Primary Province': 'Banten',
    },
    isOnline: false,
  },
];

export default function ContactsDirectoryPage() {
  const [contacts] = useState<ContactRecord[]>(MOCK_CONTACTS);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (selectedTag && !c.tags.includes(selectedTag)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone.includes(q);
        const matchEmail = c.email.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchEmail) return false;
      }
      return true;
    });
  }, [contacts, selectedTag, search]);

  const handleExportCsv = () => {
    const csvHeader = 'Name,Phone,Email,Channels,Tags,Total Conversations,Last Active\n';
    const csvRows = filteredContacts
      .map(
        (c) =>
          `"${c.name}","${c.phone}","${c.email}","${c.channels.join(';')}","${c.tags.join(';')}",${c.totalConversations},"${c.lastActive}"`,
      )
      .join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vynor_contacts_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filteredContacts.length} contacts as CSV!`);
  };

  return (
    <div className="flex flex-col gap-5 p-6 max-w-7xl mx-auto w-full select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-6 z-50 flex items-center gap-2 rounded-xs border border-emerald-500/40 bg-card p-3 text-xs text-foreground shadow-lg animate-in slide-in-from-top-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Customer Directory & CRM Profiles
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unified cross-channel customer identities, contact attributes, and engagement telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xs border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => showToast('New Customer Modal will open in production workspace.')}
            className="inline-flex items-center gap-1.5 rounded-xs bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Search & Tag Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, or email..."
              className="h-8 w-full rounded-xs border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tag Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
          <span className="text-muted-foreground text-[11px] font-medium mr-1">Filter Tag:</span>
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            className={cn(
              'px-2 py-0.5 rounded-xs text-[11px] font-medium transition-colors cursor-pointer',
              selectedTag === null
                ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={cn(
                'px-2 py-0.5 rounded-xs text-[11px] font-medium transition-colors cursor-pointer border',
                selectedTag === tag
                  ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-2xs'
                  : 'bg-surface border-border text-muted-foreground hover:text-foreground',
              )}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Main High-Density Contact Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-surface text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-mono">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Active Channels</th>
                <th className="py-3 px-4">Tags</th>
                <th className="py-3 px-4 text-center">Convs</th>
                <th className="py-3 px-4">Assigned Team</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-sans">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No contacts found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="hover:bg-muted/40 transition-colors cursor-pointer group"
                  >
                    {/* Name + Initial Avatar */}
                    <td className="py-2.5 px-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-border">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          {contact.isOnline && (
                            <span
                              title="Online"
                              className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-card"
                            />
                          )}
                        </div>
                        <span className="group-hover:text-primary transition-colors">
                          {contact.name}
                        </span>
                      </div>
                    </td>

                    {/* Phone & Email */}
                    <td className="py-2.5 px-4">
                      <div className="flex flex-col text-[11px]">
                        <span className="font-mono text-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {contact.phone}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {contact.email}
                        </span>
                      </div>
                    </td>

                    {/* Channel Badges */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {contact.channels.map((ch) => (
                          <ChannelBadge key={ch} channel={ch} />
                        ))}
                      </div>
                    </td>

                    {/* Tags */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1 flex-wrap max-w-xs">
                        {contact.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-xs border border-border bg-surface px-1.5 py-0.2 text-[10px] text-muted-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Total Convs */}
                    <td className="py-2.5 px-4 text-center font-mono font-medium text-foreground">
                      {contact.totalConversations}
                    </td>

                    {/* Assigned Team */}
                    <td className="py-2.5 px-4 text-muted-foreground text-[11px]">
                      {contact.assignedTeam}
                    </td>

                    {/* Last Active */}
                    <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground">
                      {contact.lastActive}
                    </td>

                    {/* Action link to inbox */}
                    <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href="/inbox"
                        className="inline-flex items-center gap-1 rounded-xs border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Chat</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Customer Profile Detail Drawer */}
      {selectedContact && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedContact(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Contact Detail Drawer"
            className="h-full w-full max-w-md bg-card border-l border-border p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm border border-border">
                    {selectedContact.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">{selectedContact.name}</h2>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {selectedContact.id}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedContact(null)}
                  className="rounded-xs p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Direct Communication Channels */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span>Channel Ingress Identifiers</span>
                </h3>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between rounded-xs border border-border bg-surface p-2 text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      Phone (E.164)
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {selectedContact.phone}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xs border border-border bg-surface p-2 text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      Email
                    </span>
                    <span className="font-medium text-foreground">{selectedContact.email}</span>
                  </div>
                </div>
              </div>

              {/* Active Channels */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Linked Messaging Providers
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedContact.channels.map((ch) => (
                    <ChannelBadge key={ch} channel={ch} showLabel />
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  <span>Applied Tags</span>
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedContact.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-xs border border-border bg-surface px-2 py-0.5 text-xs text-foreground font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Custom CRM Attributes */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span>CRM Custom Attributes</span>
                </h3>
                <div className="divide-y divide-border border border-border rounded-xs bg-surface p-2 text-xs space-y-1">
                  {Object.entries(selectedContact.customFields).map(([key, val]) => (
                    <div key={key} className="flex justify-between py-1 text-xs">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-medium text-foreground font-mono">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="border-t border-border pt-4 mt-6 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                <Clock className="h-3 w-3" />
                Active {selectedContact.lastActive}
              </span>
              <Link
                href="/inbox"
                className="inline-flex items-center gap-1.5 rounded-xs bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary-hover transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Open in Unified Inbox</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
