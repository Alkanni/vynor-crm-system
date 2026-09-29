'use client';

import React, { useState, useMemo } from 'react';
import { UploadCloud, Download, Send, Search, ShieldAlert, Check } from 'lucide-react';
import type {
  ParsedBlastRow,
  BlastParseSummary,
  BlastDispatcherState,
  RowValidationStatus,
} from './types';
import { MetricCard, StatusBadge, TH_CLASS, TD_CLASS } from '@/components/layout/Section';
import { Banner, Button, Input, TabBar } from '@/components/ui';
import { cn } from '@/lib/utils';

const ROW_STATUS_TONE = {
  VALID: 'teal',
  INVALID_SYNTAX: 'ruby',
  DUPLICATE: 'amber',
  BLOCKED: 'iris',
} as const;

// Known blacklist of opted-out numbers for validation
const MOCK_OPT_OUT_BLOCKLIST = new Set(['+6281299990001', '+6281100000000', '+6281988887777']);

const SAMPLE_CSV_RAW = `phone,name,voucher,notes
+6281234567890,Budi Santoso,FLASH30,VIP Member
+6281198765432,Siti Rahma,FLASH30,Loyal Shopper
0812345678,Ahmad Fauzi,FLASH30,Invalid local format without country code
+6281299990001,Dewi Sartika,FLASH30,Previously opted out
+6281234567890,Budi Santoso,FLASH30,Duplicate record
+14155552671,John Doe,GLOBAL20,US Enterprise
invalid-phone-num,Rudi Hartono,FLASH30,Corrupted string
+6281801234567,Lina Marlina,FLASH30,New subscriber
+6281100000000,Eko Prasetyo,FLASH30,Global unsubscribe request
+6281234567891,Hendra Setiawan,FLASH30,Active repeat buyer`;

export function BlastDispatcher() {
  const [state, setState] = useState<BlastDispatcherState>('CATEGORIZED');
  const [rows, setRows] = useState<ParsedBlastRow[]>(() => parseCsvContent(SAMPLE_CSV_RAW));
  const [activeTab, setActiveTab] = useState<RowValidationStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Dispatch progress state
  const [dispatchedCount, setDispatchedCount] = useState(0);

  // E.164 phone formatting validation helper
  // Standard E.164: optional +, leading 1-9, followed by 8 to 14 digits (total 9-15 digits)
  function validateE164(phone: string): boolean {
    const clean = phone.trim();
    const e164Regex = /^\+?[1-9]\d{8,14}$/;
    return e164Regex.test(clean);
  }

  function parseCsvContent(content: string): ParsedBlastRow[] {
    const lines = content.trim().split('\n');
    if (lines.length <= 1) return [];

    const seenPhones = new Map<string, number>();
    const parsed: ParsedBlastRow[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      const cols = line.split(',').map((c) => c.trim());
      const rawPhone = cols[0] || '';
      const name = cols[1] || '';
      const var1 = cols[2] || undefined;
      const var2 = cols[3] || undefined;

      const rowNumber = i + 1;

      // 1. Check E.164 syntax
      if (!validateE164(rawPhone)) {
        parsed.push({
          rowNumber,
          phone: rawPhone,
          name,
          variable1: var1,
          variable2: var2,
          status: 'INVALID_SYNTAX',
          rejectionReason:
            'Invalid E.164 phone format. Must include country code without dashes (e.g. +62812...) and 9-15 digits.',
        });
        continue;
      }

      // Format canonical phone
      const canonicalPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;

      // 2. Check Blocklist / Opt-Out
      if (MOCK_OPT_OUT_BLOCKLIST.has(canonicalPhone)) {
        parsed.push({
          rowNumber,
          phone: canonicalPhone,
          name,
          variable1: var1,
          variable2: var2,
          status: 'BLOCKED',
          rejectionReason:
            'Opted out: Recipient unsubscribed from marketing messages (Anti-Spam Act compliance).',
        });
        continue;
      }

      // 3. Check Duplicates
      if (seenPhones.has(canonicalPhone)) {
        const firstRow = seenPhones.get(canonicalPhone);
        parsed.push({
          rowNumber,
          phone: canonicalPhone,
          name,
          variable1: var1,
          variable2: var2,
          status: 'DUPLICATE',
          rejectionReason: `Duplicate number in dataset. First appeared on Row #${firstRow}.`,
        });
        continue;
      }

      // Valid Row
      seenPhones.set(canonicalPhone, rowNumber);
      parsed.push({
        rowNumber,
        phone: canonicalPhone,
        name,
        variable1: var1,
        variable2: var2,
        status: 'VALID',
        rejectionReason: undefined,
      });
    }

    return parsed;
  }

  const summary: BlastParseSummary = useMemo(() => {
    return {
      totalRows: rows.length,
      validCount: rows.filter((r) => r.status === 'VALID').length,
      invalidSyntaxCount: rows.filter((r) => r.status === 'INVALID_SYNTAX').length,
      duplicateCount: rows.filter((r) => r.status === 'DUPLICATE').length,
      blockedCount: rows.filter((r) => r.status === 'BLOCKED').length,
    };
  }, [rows]);

  const rejectedRows = useMemo(() => {
    return rows.filter((r) => r.status !== 'VALID');
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesTab = activeTab === 'ALL' ? true : r.status === activeTab;
      const matchesSearch =
        r.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.rejectionReason && r.rejectionReason.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  }, [rows, activeTab, searchQuery]);

  // 1-Click Error Export as CSV
  const handleExportRejections = () => {
    if (rejectedRows.length === 0) return;

    const headers = 'Row Number,Phone,Name,Variable 1,Variable 2,Status,Rejection Reason\n';
    const csvContent =
      headers +
      rejectedRows
        .map(
          (r) =>
            `${r.rowNumber},"${r.phone}","${r.name}","${r.variable1 || ''}","${
              r.variable2 || ''
            }","${r.status}","${r.rejectionReason?.replace(/"/g, '""') || ''}"`,
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vynor_blast_rejections_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState('PARSING');
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCsvContent(text);
      setRows(parsed);
      setState('CATEGORIZED');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setState('PARSING');
    setTimeout(() => {
      setRows(parseCsvContent(SAMPLE_CSV_RAW));
      setState('CATEGORIZED');
      setActiveTab('ALL');
    }, 200);
  };

  const handleStartDispatch = () => {
    setState('DISPATCHING');
    setDispatchedCount(0);

    const validRows = rows.filter((r) => r.status === 'VALID');
    const total = validRows.length;
    let count = 0;

    const interval = setInterval(() => {
      count += 1;
      setDispatchedCount(count);
      if (count >= total) {
        clearInterval(interval);
        setState('FINISHED');
      }
    }, 400);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full select-none">
      {/* File Ingest Dropzone & Actions */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              setRows(parseCsvContent(ev.target?.result as string));
              setState('CATEGORIZED');
            };
            reader.readAsText(file);
          }
        }}
        className={cn(
          'rounded-xl border-2 border-dashed p-6 text-center transition-all',
          isDragOver ? 'border-n-brand bg-n-brand/5' : 'border-n-strong hover:border-n-slate-7',
        )}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-n-alpha-2 text-n-blue-11">
            <UploadCloud className="size-6" />
          </div>
          <div>
            <h3 className="m-0 text-heading-3 text-n-slate-12">
              Drag & Drop your CSV recipient list here
            </h3>
            <p className="m-0 mt-1 max-w-md text-sm text-n-slate-11">
              CSV file must contain columns for phone number, recipient name, and optional custom
              variables. Phones are validated against international E.164 syntax.
            </p>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <label className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-n-brand px-3 text-sm text-white transition-all hover:brightness-110 focus-within:brightness-110">
              <span>Browse CSV File</span>
              <input type="file" accept=".csv" className="sr-only" onChange={handleFileUpload} />
            </label>

            <Button
              size="sm"
              color="slate"
              variant="faded"
              onClick={handleLoadSample}
              label="Reload Sample Data (with syntax & opt-out errors)"
            />
          </div>
        </div>
      </div>

      {/* Categorized Telemetry & Rejection Summary */}
      {rows.length > 0 && (
        <div className="space-y-4">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <MetricCard label="Total ingested" value={summary.totalRows} />
            <MetricCard label="Valid rows" value={summary.validCount} tone="teal" />
            <MetricCard label="Invalid syntax" value={summary.invalidSyntaxCount} tone="ruby" />
            <MetricCard label="Duplicates" value={summary.duplicateCount} tone="amber" />
            <MetricCard label="Blocked / opt-out" value={summary.blockedCount} />
          </div>

          {/* Rejection Export Action Bar */}
          <Banner color="amber" icon={<ShieldAlert className="size-4" />} className="flex-wrap">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                <strong className="font-medium">{rejectedRows.length} rows rejected</strong> across
                syntax, duplicates, and opt-out suppression filters.
              </span>
            </div>
          </Banner>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {rejectedRows.length > 0 && (
              <Button
                size="sm"
                color="slate"
                variant="faded"
                icon={Download}
                onClick={handleExportRejections}
                label={`Export Rejections as CSV (${rejectedRows.length})`}
              />
            )}
            {state !== 'DISPATCHING' && state !== 'FINISHED' && (
              <Button
                size="sm"
                icon={Send}
                onClick={handleStartDispatch}
                disabled={summary.validCount === 0}
                label={`Dispatch Valid Recipients (${summary.validCount})`}
              />
            )}
          </div>

          {/* Dispatch Progress (When active) */}
          {(state === 'DISPATCHING' || state === 'FINISHED') && (
            <div className="space-y-2 rounded-xl bg-n-solid-2 p-4 outline outline-1 -outline-offset-1 outline-n-container">
              <div className="flex justify-between text-sm text-n-slate-12">
                <span className="flex items-center space-x-2">
                  {state === 'DISPATCHING' ? (
                    <span className="w-2 h-2 rounded-full bg-n-brand animate-ping" />
                  ) : (
                    <Check className="w-4 h-4 text-n-teal-11" />
                  )}
                  <span>
                    {state === 'DISPATCHING'
                      ? 'Dispatching Batch...'
                      : 'All Valid Rows Dispatched!'}
                  </span>
                </span>
                <span>
                  {dispatchedCount} / {summary.validCount} msgs
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-n-alpha-2">
                <div
                  className="h-full bg-n-brand transition-all duration-200"
                  style={{
                    width: `${Math.round((dispatchedCount / summary.validCount) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Categorized Filter Tabs & Search */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
              <div className="max-w-full overflow-x-auto">
                <TabBar
                  ariaLabel="Filter rows by validation status"
                  value={activeTab}
                  onChange={(value) => setActiveTab(value as typeof activeTab)}
                  tabs={[
                    { value: 'ALL', label: 'All Ingested', count: summary.totalRows },
                    { value: 'VALID', label: 'Valid', count: summary.validCount },
                    {
                      value: 'INVALID_SYNTAX',
                      label: 'Invalid Syntax',
                      count: summary.invalidSyntaxCount,
                    },
                    { value: 'DUPLICATE', label: 'Duplicates', count: summary.duplicateCount },
                    { value: 'BLOCKED', label: 'Blocked / Opt-Out', count: summary.blockedCount },
                  ]}
                />
              </div>
              <Input
                size="sm"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter row contents..."
                aria-label="Filter row contents"
                prefix={<Search className="size-3.5" />}
                containerClassName="w-full sm:w-64"
              />
            </div>

            {/* Granular Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto divide-y divide-n-weak text-left">
                <thead className="border-t border-n-weak">
                  <tr>
                    <th className={cn(TH_CLASS, 'w-16')}>Row</th>
                    <th className={TH_CLASS}>Phone (E.164)</th>
                    <th className={TH_CLASS}>Recipient</th>
                    <th className={TH_CLASS}>Variable 1</th>
                    <th className={TH_CLASS}>Status</th>
                    <th className={TH_CLASS}>Rejection Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-n-weak text-n-slate-11">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-body-main text-n-slate-11">
                        No rows found matching current tab and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={cn(row.status !== 'VALID' && 'bg-n-alpha-1')}
                      >
                        <td className={cn(TD_CLASS, 'tabular-nums')}>{row.rowNumber}</td>
                        <td className={cn(TD_CLASS, 'font-mono text-n-slate-12')}>{row.phone}</td>
                        <td className={cn(TD_CLASS, 'text-n-slate-12')}>{row.name}</td>
                        <td className={cn(TD_CLASS, 'font-mono')}>{row.variable1 || '—'}</td>
                        <td className={TD_CLASS}>
                          <StatusBadge tone={ROW_STATUS_TONE[row.status]}>
                            {row.status.replace('_', ' ').toLowerCase()}
                          </StatusBadge>
                        </td>
                        <td className={cn(TD_CLASS, 'text-sm')}>
                          {row.rejectionReason ? (
                            <span
                              className={cn(
                                row.status === 'INVALID_SYNTAX' && 'text-n-ruby-11',
                                row.status === 'DUPLICATE' && 'text-n-amber-11',
                                row.status === 'BLOCKED' && 'text-n-iris-11',
                              )}
                            >
                              {row.rejectionReason}
                            </span>
                          ) : (
                            <span className="text-n-slate-11 italic">Validation passed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
