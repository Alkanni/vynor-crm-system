'use client';

import { Radio, Activity, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtime } from '@/lib/realtime/use-realtime';

export function StatusBarFooter() {
  const { actor } = useAuth();
  const { status, isConnected } = useRealtime();

  return (
    <footer className="h-6 shrink-0 border-t border-border bg-card px-3 flex items-center justify-between text-[11px] text-muted-foreground select-none">
      {/* Left: Telemetry & Connection */}
      <div className="flex items-center gap-4">
        {/* Realtime status */}
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`}
          />
          <Radio className="h-3 w-3" />
          <span className="capitalize">Socket: {status}</span>
        </div>

        {/* Latency */}
        <div className="hidden sm:flex items-center gap-1">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <span>Latency: 24ms</span>
        </div>

        {/* Channels */}
        <div className="hidden md:flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-emerald-500" />
          <span>Channels: 5/5 Operational</span>
        </div>
      </div>

      {/* Right: Workspace & Version */}
      <div className="flex items-center gap-3">
        {actor?.workspace?.slug && (
          <span className="hidden sm:inline font-mono text-[10px]">ws: {actor.workspace.slug}</span>
        )}
        <div className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-primary" />
          <span className="font-mono text-[10px]">Build v0.1.0</span>
        </div>
      </div>
    </footer>
  );
}
