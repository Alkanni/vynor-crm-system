'use client';

import React, { useState } from 'react';
import { Ticket, Search, Plus, Clock } from 'lucide-react';
import Link from 'next/link';
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

export default function TicketsManagementPage() {
  const [tickets] = useState<TicketItem[]>(INITIAL_TICKETS);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

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

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'OPEN':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
      case 'IN_PROGRESS':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
      case 'PENDING_CUSTOMER':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30';
      case 'ESCALATED':
        return 'bg-destructive/10 text-destructive border-destructive/30 font-bold';
      case 'RESOLVED':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-destructive/10 text-destructive border-destructive/30 font-semibold';
      case 'HIGH':
        return 'bg-warning/10 text-warning-foreground dark:text-amber-400 border-warning/30 font-medium';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Structured Work Items & Tickets
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cross-department operational accountability, SLA escalation workflows, and ticket
            lifecycle
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/inbox"
            className="inline-flex items-center gap-1.5 rounded-xs border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <span>Unified Inbox</span>
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xs bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Work Item</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1 rounded-xs bg-muted/60 p-0.5 text-xs font-medium overflow-x-auto">
          {(
            ['ALL', 'OPEN', 'IN_PROGRESS', 'ESCALATED', 'PENDING_CUSTOMER', 'RESOLVED'] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={cn(
                'px-3 py-1 rounded-xs transition-all cursor-pointer shrink-0',
                statusFilter === st
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {st === 'ALL' ? 'All Tickets' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="h-8 w-full rounded-xs border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Tickets Dense Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-surface text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-mono">
              <tr>
                <th className="py-3 px-4 w-28">Ticket ID</th>
                <th className="py-3 px-4">Subject & Summary</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">SLA Target</th>
                <th className="py-3 px-4">Assigned Team</th>
                <th className="py-3 px-4 text-right">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-sans">
              {filteredTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4 font-mono font-bold text-primary">{ticket.id}</td>
                  <td className="py-3 px-4 font-medium text-foreground max-w-sm truncate group-hover:text-primary transition-colors">
                    {ticket.subject}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{ticket.customerName}</td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        'rounded-xs border px-1.5 py-0.5 text-[10px]',
                        getPriorityBadge(ticket.priority),
                      )}
                    >
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        'rounded-xs border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                        getStatusBadge(ticket.status),
                      )}
                    >
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{ticket.slaDeadline}</span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-[11px]">
                    {ticket.assignedTeam}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground text-right">
                    {ticket.updatedAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
