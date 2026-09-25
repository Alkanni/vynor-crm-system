'use client';

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { BlastDispatcher } from '@/components/blast/BlastDispatcher';

export default function BlastPage() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full select-none">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-zinc-100" />
          <span>CSV Recipient Blast & Ingest Engine</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Ingest arbitrary CSV contact lists with client-side E.164 phone verification, duplicate
          detection, and opt-out suppression gates.
        </p>
      </div>

      {/* Dispatcher Workspace */}
      <BlastDispatcher />
    </div>
  );
}
