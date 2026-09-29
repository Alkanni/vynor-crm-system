'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Clock, Plus, Search, Ticket } from 'lucide-react';
import { PriorityIcon, PRIORITY_LABELS } from '@/components/inbox/PriorityIcon';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  StatusBadge,
  TABLE_CLASS,
  TBODY_CLASS,
  TD_CLASS,
  TH_CLASS,
  THEAD_CLASS,
  type StatusTone,
} from '@/components/layout/Section';
import { Button, buttonVariants, Input, TabBar, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'ESCALATED' | 'RESOLVED';

interface TicketItem {
  id: string;
  subject: string;
  customerName: string;
  status: TicketStatus;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  slaDeadline: string;
  assignedTeam: string;
  assignedAgent: string;
  updatedAt: string;
}

const INITIAL_TICKETS: TicketItem[] = [
  {
    id: 'TCK-1042',
    subject: 'WhatsApp Cloud API webhook payload delivery delay during peak flash sale',
    customerName: 'Budi Santoso',
    status: 'ESCALATED',
    priority: 'URGENT',
    slaDeadline: '18m remaining',
    assignedTeam: 'Infrastructure Engineering',
    assignedAgent: 'DevOps Lead',
    updatedAt: '5m ago',
  },
  {
    id: 'TCK-1041',
    subject: 'Corporate tax invoice request with NPWP validation for Q3 enterprise plan',
    customerName: 'Siti Rahmawati',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    slaDeadline: '1h 20m remaining',
    assignedTeam: 'Billing & Support',
    assignedAgent: 'Finance Specialist',
    updatedAt: '24m ago',
  },
  {
    id: 'TCK-1039',
    subject: 'Custom webhook signature verification failing on node adapter integration',
    customerName: 'Ahmad Fauzi',
    status: 'OPEN',
    priority: 'HIGH',
    slaDeadline: '2h 45m remaining',
    assignedTeam: 'Technical Support',
    assignedAgent: 'Agent Alex',
    updatedAt: '1h ago',
  },
  {
    id: 'TCK-1038',
    subject: 'Meta HSM template rejection appeal for recurring order delivery updates',
    customerName: 'Hendra Setiawan',
    status: 'PENDING_CUSTOMER',
    priority: 'MEDIUM',
    slaDeadline: '6h remaining',
    assignedTeam: 'Customer Care',
    assignedAgent: 'Agent Sarah',
    updatedAt: '3h ago',
  },
  {
    id: 'TCK-1035',
    subject: 'E-commerce cart recovery blast recipient quota increase request',
    customerName: 'Dewi Lestari',
    status: 'RESOLVED',
    priority: 'LOW',
    slaDeadline: 'Resolved within SLA',
    assignedTeam: 'Account Operations',
    assignedAgent: 'Agent Smith',
    updatedAt: 'Yesterday',
  },
];

const STATUS_TONE: Record<TicketStatus, StatusTone> = {
  OPEN: 'blue',
  IN_PROGRESS: 'amber',
  PENDING_CUSTOMER: 'iris',
  ESCALATED: 'ruby',
  RESOLVED: 'teal',
};

const STATUS_FILTERS = [
  'ALL',
  'OPEN',
  'IN_PROGRESS',
  'ESCALATED',
  'PENDING_CUSTOMER',
  'RESOLVED',
] as const;

function statusLabel(status: TicketStatus | 'ALL'): string {
  if (status === 'ALL') return 'All';
  return status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ');
}

export default function TicketsManagementPage() {
  const [tickets] = useState<TicketItem[]>(INITIAL_TICKETS);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const toast = useToast();

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <PageLayout
      title="Tickets"
      width="wide"
      actions={
        <>
          <Link
            href="/inbox"
            className={buttonVariants({ size: 'sm', color: 'slate', variant: 'faded' })}
          >
            Unified inbox
          </Link>
          <Button
            size="sm"
            icon={Plus}
            label="Create work item"
            onClick={() =>
              toast.show('Work item creation opens in the production workspace.', 'info')
            }
          />
        </>
      }
      toolbar={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-full overflow-x-auto">
            <TabBar<TicketStatus | 'ALL'>
              ariaLabel="Filter tickets by status"
              value={statusFilter}
              onChange={setStatusFilter}
              tabs={STATUS_FILTERS.map((st) => ({ value: st, label: statusLabel(st) }))}
            />
          </div>
          <Input
            size="sm"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets"
            aria-label="Search tickets"
            prefix={<Search className="size-3.5" />}
            containerClassName="w-full sm:w-56"
          />
        </div>
      }
    >
      {filteredTickets.length === 0 ? (
        <EmptyState
          compact
          icon={<Ticket className="size-5" />}
          title="No tickets found"
          description="No work items match the selected status or search."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className={TABLE_CLASS}>
            <thead className={THEAD_CLASS}>
              <tr>
                <th className={TH_CLASS}>Ticket</th>
                <th className={TH_CLASS}>Subject</th>
                <th className={TH_CLASS}>Customer</th>
                <th className={TH_CLASS}>Priority</th>
                <th className={TH_CLASS}>Status</th>
                <th className={TH_CLASS}>SLA</th>
                <th className={TH_CLASS}>Team</th>
                <th className={cn(TH_CLASS, 'text-end')}>Updated</th>
              </tr>
            </thead>
            <tbody className={TBODY_CLASS}>
              {filteredTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="group cursor-pointer transition-colors hover:bg-n-alpha-1"
                >
                  <td className={cn(TD_CLASS, 'whitespace-nowrap font-medium text-n-slate-12')}>
                    {ticket.id}
                  </td>
                  <td
                    className={cn(TD_CLASS, 'max-w-sm truncate text-n-slate-12')}
                    title={ticket.subject}
                  >
                    {ticket.subject}
                  </td>
                  <td className={cn(TD_CLASS, 'whitespace-nowrap')}>{ticket.customerName}</td>
                  <td className={TD_CLASS}>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <PriorityIcon priority={ticket.priority} />
                      {PRIORITY_LABELS[ticket.priority]}
                    </span>
                  </td>
                  <td className={TD_CLASS}>
                    <StatusBadge tone={STATUS_TONE[ticket.status]}>
                      {statusLabel(ticket.status)}
                    </StatusBadge>
                  </td>
                  <td className={cn(TD_CLASS, 'whitespace-nowrap')}>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        ticket.status === 'ESCALATED' && 'text-n-ruby-11',
                      )}
                    >
                      <Clock className="size-3.5" />
                      {ticket.slaDeadline}
                    </span>
                  </td>
                  <td className={cn(TD_CLASS, 'whitespace-nowrap')}>{ticket.assignedTeam}</td>
                  <td className={cn(TD_CLASS, 'whitespace-nowrap text-end')}>{ticket.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toast.element}
    </PageLayout>
  );
}
