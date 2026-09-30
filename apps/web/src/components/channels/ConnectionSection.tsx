'use client';

import React, { useState } from 'react';
import {
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  PlugZap,
} from 'lucide-react';
import type { InboxAccount } from './types';
import { getPlatform } from './platforms';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface CopyFieldProps {
  label: string;
  value: string;
  help?: string | undefined;
  /** Hide the value until the user chooses to reveal it. */
  secret?: boolean | undefined;
  multiline?: boolean | undefined;
}

/** Read-only value with a copy button (and reveal toggle for secrets). */
export function CopyField({
  label,
  value,
  help,
  secret = false,
  multiline = false,
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!secret);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const shown = revealed ? value : '•'.repeat(Math.min(32, value.length));

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-n-slate-12">{label}</span>
      <div className="flex min-w-0 items-start gap-1.5">
        {multiline ? (
          <textarea
            readOnly
            value={shown}
            rows={2}
            aria-label={label}
            className="min-w-0 flex-1 resize-none rounded-lg bg-n-alpha-black2 px-3 py-2 font-mono text-xs text-n-slate-12 outline outline-1 -outline-offset-1 outline-n-weak"
          />
        ) : (
          <input
            readOnly
            value={shown}
            aria-label={label}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 min-w-0 flex-1 rounded-lg bg-n-alpha-black2 px-3 font-mono text-xs text-n-slate-12 outline outline-1 -outline-offset-1 outline-n-weak"
          />
        )}
        {secret && (
          <Button
            size="sm"
            variant="ghost"
            color="slate"
            icon={revealed ? EyeOff : Eye}
            aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
            onClick={() => setRevealed((v) => !v)}
          />
        )}
        <Button
          size="sm"
          variant="faded"
          color="slate"
          icon={copied ? Check : Copy}
          aria-label={`Copy ${label}`}
          title={copied ? 'Copied' : 'Copy'}
          onClick={copy}
        />
      </div>
      {help && <p className="m-0 text-xs text-n-slate-11">{help}</p>}
    </div>
  );
}

/** How messages reach this inbox and what, if anything, is still to be set up. */
export function SetupDetails({ inbox }: { inbox: InboxAccount }) {
  const connection = inbox.connection;
  if (!connection) return null;
  const { inbound, webchat } = connection;
  const platform = getPlatform(inbox.provider);

  if (webchat) {
    return (
      <div className="flex flex-col gap-3">
        <CopyField
          label="Embed snippet"
          value={webchat.embedSnippet}
          multiline
          help="Paste it into your website, just before </body>. The chat bubble appears on every page that has it."
        />
      </div>
    );
  }

  if (inbound.mode === 'POLLING') {
    return (
      <p className="m-0 text-sm text-n-slate-11">
        {inbox.provider === 'EMAIL_SMTP_IMAP'
          ? 'VYNOR checks the mailbox for new mail every few seconds. Replies are sent from this address over SMTP.'
          : `VYNOR fetches new ${platform.label} messages automatically every few seconds.`}{' '}
        {inbound.setupNote && inbox.provider !== 'EMAIL_SMTP_IMAP' ? inbound.setupNote : null}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {inbound.webhookRegistered ? (
        <p className="m-0 flex items-center gap-1.5 text-sm text-n-slate-11">
          <CircleCheck className="size-4 shrink-0 text-n-teal-11" />
          {platform.label} was pointed at VYNOR automatically. Nothing else to set up.
        </p>
      ) : (
        inbound.setupNote && <p className="m-0 text-sm text-n-slate-11">{inbound.setupNote}</p>
      )}
      {/* Custom API callers are the customer's own systems, which may use plain HTTP. */}
      {inbound.webhookUrl &&
        !inbound.webhookUrl.startsWith('https://') &&
        inbox.provider !== 'CUSTOM_WEBHOOK' && (
          <p className="m-0 flex items-start gap-1.5 text-sm text-n-amber-11">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              {platform.label} only delivers to public HTTPS addresses, so it cannot reach this URL.
              Set PUBLIC_WEBHOOK_BASE_URL on the API (a tunnel works for local testing), restart it
              and use the new callback URL.
            </span>
          </p>
        )}
      {inbound.webhookUrl && <CopyField label="Callback URL" value={inbound.webhookUrl} />}
      {inbound.verifyToken && <CopyField label="Verify token" value={inbound.verifyToken} secret />}
      {inbound.signingSecret && (
        <CopyField
          label="Signing secret"
          value={inbound.signingSecret}
          secret
          help="Sign each request: X-Vynor-Timestamp (Unix seconds) and X-Vynor-Signature = sha256=HMAC-SHA256(secret, timestamp + '.' + body). VYNOR signs its replies the same way."
        />
      )}
    </div>
  );
}

interface ConnectionSectionProps {
  inbox: InboxAccount;
  canManage: boolean;
  onTestConnection: (id: string) => Promise<{ ok: boolean; message: string }>;
  onUpdateCredentials: (id: string) => void;
}

/** Connection card in the inbox settings: state, setup details, test and update actions. */
export function ConnectionSection({
  inbox,
  canManage,
  onTestConnection,
  onUpdateCredentials,
}: ConnectionSectionProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const connection = inbox.connection;
  if (!connection) return null;

  const hasProblem = !inbox.needsReconnect && connection.status === 'ERROR';

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await onTestConnection(inbox.id));
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : 'Test failed.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-n-alpha-1 p-4 outline outline-1 -outline-offset-1 outline-n-weak">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <PlugZap className="size-4 shrink-0 text-n-slate-11" />
          <h3 className="m-0 text-sm font-medium text-n-slate-12">Connection</h3>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="faded"
              color="slate"
              label={testing ? 'Testing…' : 'Test connection'}
              isLoading={testing}
              disabled={testing}
              onClick={runTest}
            />
            <Button
              size="sm"
              variant="faded"
              color="slate"
              icon={KeyRound}
              label="Update credentials"
              onClick={() => onUpdateCredentials(inbox.id)}
            />
          </div>
        )}
      </div>

      {hasProblem && (
        <p className="m-0 flex items-start gap-1.5 text-sm text-n-amber-11">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            {connection.statusReason ?? 'The last check found a problem with this connection.'}
          </span>
        </p>
      )}

      {result && (
        <p
          role="status"
          className={cn(
            'm-0 flex items-start gap-1.5 text-sm',
            result.ok ? 'text-n-teal-11' : 'text-n-ruby-11',
          )}
        >
          {result.ok ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{result.message}</span>
        </p>
      )}

      <SetupDetails inbox={inbox} />
    </section>
  );
}
