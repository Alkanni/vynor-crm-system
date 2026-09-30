'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CircleAlert, CircleCheck, ExternalLink, X } from 'lucide-react';
import { ChannelConnectionInputSchema, type ChannelProviderType } from '@vynor/contracts';
import type { ConnectionCredentials, InboxAccount } from './types';
import { PLATFORMS, PlatformIcon, getPlatform } from './platforms';
import {
  CONNECT_FORMS,
  buildCredentials,
  initialFormValues,
  type CredentialField,
  type FormValues,
} from './connection-forms';
import { SetupDetails } from './ConnectionSection';
import { FIELD_CLASS, Toggle } from '@/components/common/form-controls';
import { Banner } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ConnectPlatformModalProps {
  onClose: () => void;
  /** Live mode asks for credentials the API verifies; preview mode only names the inbox. */
  collectCredentials: boolean;
  onConnect: (
    provider: ChannelProviderType,
    name: string,
    credentials: ConnectionCredentials | null,
  ) => Promise<InboxAccount>;
  /** Replace the credentials of this inbox instead of creating a new one. */
  reconnectInbox?: InboxAccount | undefined;
  onReconnect?:
    | ((inbox: InboxAccount, credentials: ConnectionCredentials) => Promise<InboxAccount>)
    | undefined;
}

type Step = 'platform' | 'details' | 'done';

const PRIMARY_BUTTON =
  'h-10 cursor-pointer rounded-lg bg-n-brand px-4 text-sm font-medium text-white transition-all hover:enabled:brightness-110 disabled:cursor-not-allowed disabled:opacity-50';

function fieldErrorsFrom(provider: ChannelProviderType, credentials: ConnectionCredentials) {
  const parsed = ChannelConnectionInputSchema.safeParse({ provider, credentials });
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.slice(1).join('.');
      if (key && !errors[key]) {
        errors[key] = issue.code === 'invalid_type' ? 'This field is required.' : issue.message;
      }
    }
  }
  return errors;
}

/** Mount only while open so every visit starts on the platform grid. */
export function ConnectPlatformModal({
  onClose,
  collectCredentials,
  onConnect,
  reconnectInbox,
  onReconnect,
}: ConnectPlatformModalProps) {
  const [provider, setProvider] = useState<ChannelProviderType | null>(
    reconnectInbox?.provider ?? null,
  );
  const [step, setStep] = useState<Step>(reconnectInbox ? 'details' : 'platform');
  const [name, setName] = useState('');
  const [values, setValues] = useState<FormValues>(() =>
    reconnectInbox
      ? initialFormValues(
          CONNECT_FORMS[reconnectInbox.provider],
          reconnectInbox.connection?.connectionDetails,
        )
      : {},
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [connected, setConnected] = useState<InboxAccount | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, submitting]);

  const platform = provider ? getPlatform(provider) : null;
  const form = provider ? CONNECT_FORMS[provider] : null;
  const isReconnect = Boolean(reconnectInbox);

  const choosePlatform = (next: ChannelProviderType) => {
    setProvider(next);
    setValues(initialFormValues(CONNECT_FORMS[next]));
    setFieldErrors({});
    setServerError(null);
    setStep('details');
  };

  const setValue = (key: string, value: string | boolean) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      // Mailbox usernames are almost always the address itself.
      if (key === 'emailAddress' && typeof value === 'string') {
        for (const userKey of ['imap.username', 'smtp.username']) {
          if (!prev[userKey] || prev[userKey] === prev.emailAddress) next[userKey] = value;
        }
      }
      return next;
    });
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform || !form) return;
    setServerError(null);

    if (!collectCredentials) {
      if (!name.trim()) return;
      setSubmitting(true);
      try {
        await onConnect(platform.provider, name.trim(), null);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const credentials = buildCredentials(form, values);
    const errors = fieldErrorsFrom(platform.provider, credentials);
    if (!isReconnect && !name.trim()) errors.__name = 'Give the inbox a name.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const result =
        isReconnect && reconnectInbox && onReconnect
          ? await onReconnect(reconnectInbox, credentials)
          : await onConnect(platform.provider, name.trim(), credentials);
      setConnected(result);
      setStep('done');
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'The platform could not be connected.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    step === 'platform'
      ? 'Platform'
      : step === 'done'
        ? `${connected?.name ?? platform?.label} is connected`
        : isReconnect
          ? `Update ${platform?.label} credentials`
          : `Connect ${platform?.label}`;

  const subtitle =
    step === 'platform'
      ? 'Select the platform you wish to establish your new inbox'
      : step === 'done'
        ? 'New messages will appear in the Inbox. Finish any remaining setup below.'
        : collectCredentials
          ? form?.intro
          : 'Give this inbox a name your team will recognise.';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-n-alpha-black1 p-4 backdrop-blur-[4px] animate-in fade-in duration-150"
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-platform-title"
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-xl bg-n-alpha-3 p-6 shadow-xl backdrop-blur-[100px] sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="connect-platform-title" className="text-heading-1 text-n-slate-12">
              {title}
            </h2>
            <p className="mt-1 text-sm text-n-slate-11">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="-mr-1 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-n-slate-11 hover:bg-n-slate-3 disabled:cursor-not-allowed"
          >
            <X className="size-5" />
          </button>
        </div>

        {step === 'platform' && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
            {PLATFORMS.map((p) => (
              <button
                key={p.provider}
                type="button"
                onClick={() => choosePlatform(p.provider)}
                className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl bg-n-solid-2 px-3 py-7 outline outline-1 -outline-offset-1 outline-n-container transition-colors hover:bg-n-alpha-1 hover:outline-n-brand"
              >
                <span className="flex rounded-full bg-n-slate-3 p-2">
                  <PlatformIcon provider={p.provider} size="lg" />
                </span>
                <span className="text-center text-sm font-medium text-n-slate-12">{p.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'details' && platform && form && (
          <form className="mt-6 flex flex-col gap-5" onSubmit={submit} noValidate>
            <div className="flex items-center gap-3">
              <span className="flex rounded-full bg-n-slate-3 p-1.5">
                <PlatformIcon provider={platform.provider} />
              </span>
              <p className="m-0 text-sm text-n-slate-11">
                {collectCredentials
                  ? platform.connectHint
                  : 'Preview mode: nothing is sent to the platform.'}
              </p>
            </div>

            {serverError && (
              <Banner role="alert" color="ruby" icon={<CircleAlert className="size-4" />}>
                {serverError}
              </Banner>
            )}

            {!isReconnect && (
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-n-slate-12">Inbox name</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors(({ __name: _removed, ...rest }) => rest);
                  }}
                  placeholder="e.g. Customer Support"
                  aria-invalid={Boolean(fieldErrors.__name)}
                  className={cn(FIELD_CLASS, 'h-11')}
                />
                {fieldErrors.__name && (
                  <span className="text-xs text-n-ruby-11">{fieldErrors.__name}</span>
                )}
              </label>
            )}

            {collectCredentials && (
              <>
                <details className="rounded-lg bg-n-alpha-1 px-4 py-3 text-sm text-n-slate-11 outline outline-1 -outline-offset-1 outline-n-weak">
                  <summary className="cursor-pointer font-medium text-n-slate-12">
                    Where do I find these?
                  </summary>
                  <ol className="mb-0 mt-2 flex list-decimal flex-col gap-1.5 pl-5">
                    {form.steps.map((stepText) => (
                      <li key={stepText}>{stepText}</li>
                    ))}
                  </ol>
                  {form.docsUrl && (
                    <a
                      href={form.docsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-flex items-center gap-1 text-n-blue-11 hover:underline"
                    >
                      {form.docsLabel ?? 'Official guide'}
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </details>

                {form.presets && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-n-slate-11">Fill in server settings for</span>
                    {form.presets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setValues((prev) => ({ ...prev, ...preset.values }))}
                        className="h-7 cursor-pointer rounded-md bg-n-alpha-2 px-2.5 text-xs font-medium text-n-slate-12 hover:bg-n-alpha-3"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}

                {form.sections.map((section, index) => (
                  <fieldset
                    key={section.title ?? index}
                    className="m-0 flex flex-col gap-4 border-0 p-0"
                  >
                    {section.title && (
                      <legend className="mb-1 text-sm font-medium text-n-slate-12">
                        {section.title}
                      </legend>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {section.fields.map((field) => (
                        <CredentialInput
                          key={field.key}
                          field={field}
                          value={values[field.key]}
                          error={fieldErrors[field.key]}
                          hint={
                            isReconnect && field.secret
                              ? reconnectInbox?.connection?.secretHints[field.key]
                              : undefined
                          }
                          onChange={(value) => setValue(field.key, value)}
                        />
                      ))}
                    </div>
                  </fieldset>
                ))}
              </>
            )}

            <div className="flex items-center justify-between gap-2">
              {isReconnect ? (
                <span />
              ) : (
                <button
                  type="button"
                  onClick={() => setStep('platform')}
                  disabled={submitting}
                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-n-slate-11 hover:bg-n-slate-3"
                >
                  <ArrowLeft className="size-4" />
                  All platforms
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || (!collectCredentials && !name.trim())}
                className={PRIMARY_BUTTON}
              >
                {submitting
                  ? collectCredentials
                    ? 'Checking with the platform…'
                    : 'Connecting…'
                  : isReconnect
                    ? 'Save and reconnect'
                    : 'Connect'}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && connected && (
          <div className="mt-6 flex flex-col gap-5">
            <p className="m-0 flex items-center gap-2 text-sm text-n-slate-12">
              <CircleCheck className="size-5 shrink-0 text-n-teal-11" />
              {platform?.label} verified {connected.identifier}.
            </p>
            <SetupDetails inbox={connected} />
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CredentialInputProps {
  field: CredentialField;
  value: string | boolean | undefined;
  error: string | undefined;
  /** Masked current value of a secret (shown when updating credentials). */
  hint: string | undefined;
  onChange: (value: string | boolean) => void;
}

function CredentialInput({ field, value, error, hint, onChange }: CredentialInputProps) {
  const id = useMemo(() => `cred-${field.key.replace(/\W/g, '-')}`, [field.key]);
  const full = !field.half || field.type === 'toggle' || field.type === 'textarea';

  if (field.type === 'toggle') {
    return (
      <div className={cn('flex items-center justify-between gap-4', full && 'sm:col-span-2')}>
        <div className="min-w-0">
          <p className="m-0 text-sm font-medium text-n-slate-12">{field.label}</p>
          {field.help && <p className="m-0 mt-0.5 text-xs text-n-slate-11">{field.help}</p>}
        </div>
        <Toggle
          label={field.label}
          checked={value === true}
          onChange={(checked) => onChange(checked)}
        />
      </div>
    );
  }

  const common = {
    id,
    value: typeof value === 'string' ? value : '',
    placeholder: hint ? `Current: ${hint} — enter it again` : field.placeholder,
    'aria-invalid': Boolean(error),
    'aria-describedby': error || field.help ? `${id}-note` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
  };

  return (
    <label htmlFor={id} className={cn('flex min-w-0 flex-col gap-2', full && 'sm:col-span-2')}>
      <span className="text-sm font-medium text-n-slate-12">
        {field.label}
        {field.optional && <span className="font-normal text-n-slate-11"> (optional)</span>}
      </span>
      {field.type === 'textarea' ? (
        <textarea {...common} rows={3} className={cn(FIELD_CLASS, 'min-h-20 py-2')} />
      ) : field.type === 'color' ? (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={`${field.label} picker`}
            value={typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#1F93FF'}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 w-12 cursor-pointer rounded-md bg-transparent"
          />
          <input {...common} className={cn(FIELD_CLASS, 'h-11 font-mono')} />
        </div>
      ) : (
        <input
          {...common}
          type={
            field.type === 'password'
              ? 'password'
              : field.type === 'number'
                ? 'number'
                : field.type === 'email'
                  ? 'email'
                  : 'text'
          }
          autoComplete={field.type === 'password' ? 'new-password' : 'off'}
          spellCheck={false}
          className={cn(
            FIELD_CLASS,
            'h-11',
            (field.secret || field.type === 'number') && 'font-mono',
          )}
        />
      )}
      {(error || field.help) && (
        <span
          id={`${id}-note`}
          className={cn('text-xs', error ? 'text-n-ruby-11' : 'text-n-slate-11')}
        >
          {error ?? field.help}
        </span>
      )}
    </label>
  );
}
