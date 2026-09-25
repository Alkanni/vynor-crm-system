'use client';

import React, { useState, useMemo } from 'react';
import { UploadCloud, Download, Send, Search, ShieldAlert, Check } from 'lucide-react';
import type {
  ParsedBlastRow,
  BlastParseSummary,
  BlastDispatcherState,
  RowValidationStatus,
} from './types';
import { cn } from '@/lib/utils';

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
          'border-2 border-dashed rounded-lg p-6 text-center transition-all bg-card',
          isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-border-strong',
        )}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center text-primary">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Drag & Drop your CSV recipient list here
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              CSV file must contain columns for phone number, recipient name, and optional custom
              variables. Phones are validated against international E.164 syntax.
            </p>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <label className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
              <span>Browse CSV File</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>

            <button
              onClick={handleLoadSample}
              className="px-3.5 py-2 bg-surface hover:bg-muted text-foreground rounded text-xs font-medium border border-border transition-colors cursor-pointer"
            >
              Reload Sample Data (with syntax & opt-out errors)
            </button>
          </div>
        </div>
      </div>

      {/* Categorized Telemetry & Rejection Summary */}
      {rows.length > 0 && (
        <div className="space-y-4">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-card border border-border p-3 rounded-lg shadow-2xs">
              <div className="text-[10px] font-mono text-muted-foreground uppercase">
                Total Ingested
              </div>
              <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                {summary.totalRows}
              </div>
            </div>

            <div className="bg-card border border-emerald-500/30 p-3 rounded-lg shadow-2xs">
              <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase">
                Valid Rows
              </div>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {summary.validCount}
              </div>
            </div>

            <div className="bg-card border border-destructive/30 p-3 rounded-lg shadow-2xs">
              <div className="text-[10px] font-mono text-destructive uppercase">Invalid Syntax</div>
              <div className="text-xl font-bold font-mono text-destructive mt-0.5">
                {summary.invalidSyntaxCount}
              </div>
            </div>

            <div className="bg-card border border-amber-500/30 p-3 rounded-lg shadow-2xs">
              <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400 uppercase">
                Duplicates
              </div>
              <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                {summary.duplicateCount}
              </div>
            </div>

            <div className="bg-card border border-purple-500/30 p-3 rounded-lg shadow-2xs">
              <div className="text-[10px] font-mono text-purple-600 dark:text-purple-400 uppercase">
                Blocked / Opt-Out
              </div>
              <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                {summary.blockedCount}
              </div>
            </div>
          </div>

          {/* Rejection Export Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-surface border border-border rounded-lg text-xs shadow-2xs">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-foreground">
                <strong>{rejectedRows.length} rows rejected</strong> across syntax, duplicates, and
                opt-out suppression filters.
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {rejectedRows.length > 0 && (
                <button
                  onClick={handleExportRejections}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface hover:bg-muted text-foreground rounded font-semibold text-xs border border-border transition-colors shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Rejections as CSV ({rejectedRows.length})</span>
                </button>
              )}

              {state !== 'DISPATCHING' && state !== 'FINISHED' && (
                <button
                  onClick={handleStartDispatch}
                  disabled={summary.validCount === 0}
                  className="flex items-center space-x-1.5 px-4 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground rounded font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Valid Recipients ({summary.validCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Dispatch Progress (When active) */}
          {(state === 'DISPATCHING' || state === 'FINISHED') && (
            <div className="p-4 bg-surface border border-border rounded-lg space-y-2">
              <div className="flex justify-between text-xs text-foreground font-mono">
                <span className="flex items-center space-x-2">
                  {state === 'DISPATCHING' ? (
                    <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{
                    width: `${Math.round((dispatchedCount / summary.validCount) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Categorized Filter Tabs & Search */}
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xs">
            <div className="p-3 bg-surface border-b border-border flex flex-wrap items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={cn(
                    'px-2.5 py-1 rounded transition-colors font-medium cursor-pointer',
                    activeTab === 'ALL'
                      ? 'bg-card text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  All Ingested ({summary.totalRows})
                </button>
                <button
                  onClick={() => setActiveTab('VALID')}
                  className={cn(
                    'px-2.5 py-1 rounded transition-colors font-medium flex items-center space-x-1 cursor-pointer',
                    activeTab === 'VALID'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold'
                      : 'text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400',
                  )}
                >
                  <span>Valid</span>
                  <span className="font-mono text-[10px]">({summary.validCount})</span>
                </button>
                <button
                  onClick={() => setActiveTab('INVALID_SYNTAX')}
                  className={cn(
                    'px-2.5 py-1 rounded transition-colors font-medium flex items-center space-x-1 cursor-pointer',
                    activeTab === 'INVALID_SYNTAX'
                      ? 'bg-destructive/10 text-destructive border border-destructive/30 font-semibold'
                      : 'text-muted-foreground hover:text-destructive',
                  )}
                >
                  <span>Invalid Syntax</span>
                  <span className="font-mono text-[10px]">({summary.invalidSyntaxCount})</span>
                </button>
                <button
                  onClick={() => setActiveTab('DUPLICATE')}
                  className={cn(
                    'px-2.5 py-1 rounded transition-colors font-medium flex items-center space-x-1 cursor-pointer',
                    activeTab === 'DUPLICATE'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold'
                      : 'text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400',
                  )}
                >
                  <span>Duplicates</span>
                  <span className="font-mono text-[10px]">({summary.duplicateCount})</span>
                </button>
                <button
                  onClick={() => setActiveTab('BLOCKED')}
                  className={cn(
                    'px-2.5 py-1 rounded transition-colors font-medium flex items-center space-x-1 cursor-pointer',
                    activeTab === 'BLOCKED'
                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30 font-semibold'
                      : 'text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400',
                  )}
                >
                  <span>Blocked / Opt-Out</span>
                  <span className="font-mono text-[10px]">({summary.blockedCount})</span>
                </button>
              </div>

              {/* Search */}
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter row contents..."
                  className="w-full bg-background border border-border rounded pl-8 pr-3 py-1 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
            </div>

            {/* Granular Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-surface text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-mono">
                  <tr>
                    <th className="py-2.5 px-3 w-16">Row #</th>
                    <th className="py-2.5 px-3">Phone (E.164)</th>
                    <th className="py-2.5 px-3">Recipient Name</th>
                    <th className="py-2.5 px-3">Variable 1</th>
                    <th className="py-2.5 px-3">Validation Status</th>
                    <th className="py-2.5 px-3">Error / Rejection Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-sans">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        No rows found matching current tab and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={cn(
                          'hover:bg-muted/40 transition-colors',
                          row.status !== 'VALID' && 'bg-muted/10',
                        )}
                      >
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">
                          {row.rowNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                          {row.phone}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground">{row.name}</td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">
                          {row.variable1 || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider',
                              row.status === 'VALID' &&
                                'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
                              row.status === 'INVALID_SYNTAX' &&
                                'bg-destructive/10 text-destructive border border-destructive/30',
                              row.status === 'DUPLICATE' &&
                                'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30',
                              row.status === 'BLOCKED' &&
                                'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30',
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px]">
                          {row.rejectionReason ? (
                            <span
                              className={cn(
                                row.status === 'INVALID_SYNTAX' && 'text-destructive',
                                row.status === 'DUPLICATE' && 'text-amber-700 dark:text-amber-400',
                                row.status === 'BLOCKED' && 'text-purple-700 dark:text-purple-400',
                              )}
                            >
                              {row.rejectionReason}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Validation passed</span>
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
