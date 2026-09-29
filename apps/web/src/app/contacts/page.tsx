'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ChevronDown,
  Clock,
  Download,
  Layers,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Shield,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { ChannelBadge } from '@/components/inbox/ChannelBadge';
import type { ChannelType } from '@/components/inbox/types';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  AccordionItem,
  Avatar,
  Button,
  buttonVariants,
  CardLayout,
  Input,
  Label,
  useToast,
} from '@/components/ui';
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

/** Port of VYNOR `Contacts/ContactsCard/ContactsCard.vue`. */
function ContactCard({
  contact,
  expanded,
  onToggleExpand,
  onViewDetails,
}: {
  contact: ContactRecord;
  expanded: boolean;
  onToggleExpand: () => void;
  onViewDetails: () => void;
}) {
  return (
    <CardLayout
      layout="row"
      after={
        <div
          className={cn(
            'grid overflow-hidden transition-all duration-500 ease-in-out',
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="grid gap-6 border-t border-n-strong p-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h4 className="m-0 text-heading-3 text-n-slate-12">Channels</h4>
                <div className="flex flex-wrap gap-2">
                  {contact.channels.map((ch) => (
                    <ChannelBadge key={ch} channel={ch} showLabel />
                  ))}
                </div>
                <h4 className="m-0 mt-3 text-heading-3 text-n-slate-12">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map((tag) => (
                    <Label key={tag} compact label={tag} />
                  ))}
                </div>
              </div>
              <dl className="m-0 flex flex-col gap-2">
                {Object.entries(contact.customFields).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-n-slate-11">{key}</dt>
                    <dd className="m-0 truncate text-right text-n-slate-12">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex min-w-0 flex-1 items-center justify-start gap-4">
        <Avatar
          name={contact.name}
          size={42}
          status={contact.isOnline ? 'online' : 'offline'}
          hideOfflineStatus
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="truncate text-base font-medium text-n-slate-12">{contact.name}</span>
            <span className="inline-flex min-w-0 items-center gap-1">
              <Building2 className="mb-0.5 size-4 shrink-0 text-n-slate-10" />
              <span className="truncate text-sm text-n-slate-11">{contact.assignedTeam}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1">
            <span className="max-w-72 truncate text-sm text-n-slate-11" title={contact.email}>
              {contact.email}
            </span>
            <span className="h-3 w-px bg-n-slate-6" />
            <span className="truncate text-sm text-n-slate-11">{contact.phone}</span>
            <span className="h-3 w-px bg-n-slate-6" />
            <span className="inline-flex items-center gap-1">
              {contact.channels.map((ch) => (
                <ChannelBadge key={ch} channel={ch} />
              ))}
            </span>
            <span className="h-3 w-px bg-n-slate-6" />
            <Button variant="link" size="xs" label="View details" onClick={onViewDetails} />
          </div>
        </div>
      </div>
      <Button
        icon={ChevronDown}
        variant="ghost"
        color="slate"
        size="xs"
        aria-label={expanded ? 'Collapse details' : 'Expand details'}
        aria-expanded={expanded}
        onClick={onToggleExpand}
        className={cn('transition-transform', expanded && 'rotate-180')}
      />
    </CardLayout>
  );
}

export default function ContactsDirectoryPage() {
  const [contacts] = useState<ContactRecord[]>(MOCK_CONTACTS);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toast = useToast();

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
    toast.show(`Exported ${filteredContacts.length} contacts as CSV`);
  };

  return (
    <PageLayout
      title="Contacts"
      actions={
        <>
          <Input
            size="sm"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email"
            aria-label="Search contacts"
            prefix={<Search className="size-4" />}
            containerClassName="w-full sm:w-64"
            className="bg-n-alpha-2 dark:bg-n-solid-1"
          />
          <Button
            variant="ghost"
            color="slate"
            size="sm"
            icon={Download}
            title="Export CSV"
            aria-label="Export CSV"
            onClick={handleExportCsv}
          />
          <div className="h-4 w-px bg-n-strong" />
          <Button
            size="sm"
            icon={Plus}
            label="Add contact"
            onClick={() =>
              toast.show('The new contact form opens in the production workspace.', 'info')
            }
          />
        </>
      }
      toolbar={
        <div
          className="flex items-center gap-2 overflow-x-auto py-1"
          role="group"
          aria-label="Filter by tag"
        >
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            aria-pressed={selectedTag === null}
            className={cn(
              'h-7 shrink-0 rounded-lg px-2.5 text-sm transition-colors',
              selectedTag === null
                ? 'bg-n-alpha-2 font-medium text-n-slate-12'
                : 'text-n-slate-11 hover:bg-n-alpha-1',
            )}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              aria-pressed={selectedTag === tag}
              className={cn(
                'h-7 shrink-0 rounded-lg px-2.5 text-sm transition-colors',
                selectedTag === tag
                  ? 'bg-n-alpha-2 font-medium text-n-slate-12'
                  : 'text-n-slate-11 hover:bg-n-alpha-1',
              )}
            >
              #{tag}
            </button>
          ))}
        </div>
      }
    >
      {filteredContacts.length === 0 ? (
        <EmptyState
          compact
          icon={<Users className="size-5" />}
          title="No contacts found"
          description="No contacts match the current search or tag filter."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {filteredContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              expanded={expandedId === contact.id}
              onToggleExpand={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
              onViewDetails={() => setSelectedContact(contact)}
            />
          ))}
        </div>
      )}

      {/* Contact details slide-over (VYNOR ContactsSidebar surface) */}
      {selectedContact && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-n-alpha-black1 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={() => setSelectedContact(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Contact details"
            className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-n-weak bg-n-surface-2 shadow-lg animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-n-weak px-4">
              <span className="text-sm font-medium text-n-slate-12">Contact</span>
              <Button
                variant="ghost"
                color="slate"
                size="sm"
                icon={X}
                aria-label="Close contact details"
                onClick={() => setSelectedContact(null)}
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <div className="flex flex-col gap-2">
                <Avatar
                  name={selectedContact.name}
                  size={48}
                  status={selectedContact.isOnline ? 'online' : 'offline'}
                  hideOfflineStatus
                />
                <h2 className="m-0 text-base text-n-slate-12">{selectedContact.name}</h2>
                <span className="flex items-center gap-2 text-sm text-n-slate-11">
                  <Mail className="size-3.5" />
                  {selectedContact.email}
                </span>
                <span className="flex items-center gap-2 text-sm text-n-slate-11">
                  <Phone className="size-3.5" />
                  {selectedContact.phone}
                </span>
                <span className="flex items-center gap-2 text-sm text-n-slate-11">
                  <Clock className="size-3.5" />
                  Active {selectedContact.lastActive} · {selectedContact.totalConversations}{' '}
                  conversations
                </span>
              </div>

              <AccordionItem
                title="Channel Identities"
                icon={<Layers className="size-4" />}
                defaultOpen
              >
                <div className="flex flex-wrap gap-2">
                  {selectedContact.channels.map((ch) => (
                    <ChannelBadge key={ch} channel={ch} showLabel />
                  ))}
                </div>
              </AccordionItem>
              <AccordionItem title="Tags" icon={<Tag className="size-4" />} defaultOpen>
                <div className="flex flex-wrap gap-2">
                  {selectedContact.tags.map((t) => (
                    <Label key={t} compact label={t} />
                  ))}
                </div>
              </AccordionItem>
              <AccordionItem
                title="CRM Attributes"
                icon={<Shield className="size-4" />}
                defaultOpen
              >
                <dl className="m-0 flex flex-col gap-2">
                  {Object.entries(selectedContact.customFields).map(([key, val]) => (
                    <div key={key} className="flex justify-between gap-3 text-sm">
                      <dt className="text-n-slate-11">{key}</dt>
                      <dd className="m-0 text-right text-n-slate-12">{val}</dd>
                    </div>
                  ))}
                </dl>
              </AccordionItem>
            </div>

            <div className="flex shrink-0 justify-end border-t border-n-weak p-4">
              <Link href="/inbox" className={buttonVariants({ size: 'sm' })}>
                <MessageSquare className="size-4" />
                Open in inbox
              </Link>
            </div>
          </div>
        </div>
      )}

      {toast.element}
    </PageLayout>
  );
}
