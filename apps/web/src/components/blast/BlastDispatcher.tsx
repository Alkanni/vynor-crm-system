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
          'border-2 border-dashed rounded-lg p-6 text-center transition-all bg-zinc-950',
          isDragOver
            ? 'border-emerald-500 bg-emerald-950/10'
            : 'border-zinc-800 hover:border-zinc-700',
        )}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Drag & Drop your CSV recipient list here
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-md">
              CSV file must contain columns for phone number, recipient name, and optional custom
              variables. Phones are validated against international E.164 syntax.
            </p>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <label className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 rounded text-xs font-semibold cursor-pointer transition-colors shadow-sm">
              <span>Browse CSV File</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>

            <button
              onClick={handleLoadSample}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-xs font-medium border border-zinc-700 transition-colors"
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
            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">Total Ingested</div>
              <div className="text-xl font-bold font-mono text-zinc-100 mt-0.5">
                {summary.totalRows}
              </div>
            </div>

            <div className="bg-zinc-900 border border-emerald-500/30 p-3 rounded-lg">
              <div className="text-[10px] font-mono text-emerald-400 uppercase">Valid Rows</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {summary.validCount}
              </div>
            </div>

            <div className="bg-zinc-900 border border-red-500/30 p-3 rounded-lg">
              <div className="text-[10px] font-mono text-red-400 uppercase">Invalid Syntax</div>
              <div className="text-xl font-bold font-mono text-red-400 mt-0.5">
                {summary.invalidSyntaxCount}
              </div>
            </div>

            <div className="bg-zinc-900 border border-amber-500/30 p-3 rounded-lg">
              <div className="text-[10px] font-mono text-amber-400 uppercase">Duplicates</div>
              <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                {summary.duplicateCount}
              </div>
            </div>

            <div className="bg-zinc-900 border border-purple-500/30 p-3 rounded-lg">
              <div className="text-[10px] font-mono text-purple-400 uppercase">
                Blocked / Opt-Out
              </div>
              <div className="text-xl font-bold font-mono text-purple-400 mt-0.5">
                {summary.blockedCount}
              </div>
            </div>
          </div>

          {/* Rejection Export Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-900/70 border border-zinc-800 rounded-lg text-xs">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-zinc-300">
                <strong>{rejectedRows.length} rows rejected</strong> across syntax, duplicates, and
                opt-out suppression filters.
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {rejectedRows.length > 0 && (
                <button
                  onClick={handleExportRejections}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-semibold text-xs border border-zinc-700 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Rejections as CSV ({rejectedRows.length})</span>
                </button>
              )}

              {state !== 'DISPATCHING' && state !== 'FINISHED' && (
                <button
                  onClick={handleStartDispatch}
                  disabled={summary.validCount === 0}
                  className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded font-bold text-xs transition-colors shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Valid Recipients ({summary.validCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Dispatch Progress (When active) */}
          {(state === 'DISPATCHING' || state === 'FINISHED') && (
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
              <div className="flex justify-between text-xs text-zinc-300 font-mono">
                <span className="flex items-center space-x-2">
                  {state === 'DISPATCHING' ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-400" />
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
              <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{
                    width: `${Math.round((dispatchedCount / summary.validCount) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Categorized Filter Tabs & Search */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-3 bg-zinc-900/60 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={cn(
                    'px-2.5 py-1 rounded transition-colors font-medium',
                    activeTab === 'ALL'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  All Ingested ({summary.totalRows})
                </button>
                <button
                  onClick={() => setActiveTab('VALID')}
                  className={cn(
                    'px-2.5 py-1 rounded transition-colors font-medium flex items-center space-x-1',
                    activeTab === 'VALID'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-zinc-400 hover:text-emerald-400',
                  )}
                >
                  <span>Valid</span>
                  <span className="font-mono text-[10px]">({summary.validCount})</span>
                </button>
                <button
                  onClick={() => setActiveTab('INVALID_SYNTAX')}
                  className={cn(
                    'px-2.5 py-1 rounded transition-colors font-medium flex items-center space-x-1',
                    activeTab === 'INVALID_SYNTAX'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'text-zinc-400 hover:text-red-400',
                  )}
                >
                  <span>Invalid Syntax</span>
                  <span className="font-mono text-[10px]">({summary.invalidSyntaxCount})</span>
                </button>
                <button
                  onClick={() => setActiveTab('DUPLICATE')}
                  className={cn(
                    'px-2.5 py-1 rounded transition-colors font-medium flex items-center space-x-1',
                    activeTab === 'DUPLICATE'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-zinc-400 hover:text-amber-400',
                  )}
                >
                  <span>Duplicates</span>
                  <span className="font-mono text-[10px]">({summary.duplicateCount})</span>
                </button>
                <button
                  onClick={() => setActiveTab('BLOCKED')}
                  className={cn(
                    'px-2.5 py-1 rounded transition-colors font-medium flex items-center space-x-1',
                    activeTab === 'BLOCKED'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-zinc-400 hover:text-purple-400',
                  )}
                >
                  <span>Blocked / Opt-Out</span>
                  <span className="font-mono text-[10px]">({summary.blockedCount})</span>
                </button>
              </div>

              {/* Search */}
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter row contents..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
              </div>
            </div>

            {/* Granular Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/90 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800 font-mono">
                  <tr>
                    <th className="py-2.5 px-3 w-16">Row #</th>
                    <th className="py-2.5 px-3">Phone (E.164)</th>
                    <th className="py-2.5 px-3">Recipient Name</th>
                    <th className="py-2.5 px-3">Variable 1</th>
                    <th className="py-2.5 px-3">Validation Status</th>
                    <th className="py-2.5 px-3">Error / Rejection Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 font-sans">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        No rows found matching current tab and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={cn(
                          'hover:bg-zinc-900/40 transition-colors',
                          row.status !== 'VALID' && 'bg-zinc-950/40',
                        )}
                      >
                        <td className="py-2.5 px-3 font-mono text-zinc-500">{row.rowNumber}</td>
                        <td className="py-2.5 px-3 font-mono font-medium text-zinc-200">
                          {row.phone}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-zinc-300">{row.name}</td>
                        <td className="py-2.5 px-3 font-mono text-zinc-400">
                          {row.variable1 || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider',
                              row.status === 'VALID' &&
                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
                              row.status === 'INVALID_SYNTAX' &&
                                'bg-red-500/10 text-red-400 border border-red-500/30',
                              row.status === 'DUPLICATE' &&
                                'bg-amber-500/10 text-amber-400 border border-amber-500/30',
                              row.status === 'BLOCKED' &&
                                'bg-purple-500/10 text-purple-400 border border-purple-500/30',
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px]">
                          {row.rejectionReason ? (
                            <span
                              className={cn(
                                row.status === 'INVALID_SYNTAX' && 'text-red-400',
                                row.status === 'DUPLICATE' && 'text-amber-400',
                                row.status === 'BLOCKED' && 'text-purple-400',
                              )}
                            >
                              {row.rejectionReason}
                            </span>
                          ) : (
                            <span className="text-zinc-500 italic">Validation passed</span>
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
