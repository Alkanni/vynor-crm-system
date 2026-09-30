'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, KeyRound, Sparkles } from 'lucide-react';
import { fetchApi } from '@/lib/api/api-client';
import { useAuth } from '@/lib/auth/auth-context';
import { VynorLogo } from '@/components/common/VynorLogo';
import { Banner, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Field styling from VYNOR `v3/components/Form/Input.vue`. */
const LOGIN_INPUT_CLASS =
  'block w-full appearance-none rounded-md border-none bg-n-alpha-black2 px-3 py-3 text-n-slate-12 shadow-sm outline outline-1 -outline-offset-1 outline-n-weak placeholder:text-n-slate-10 hover:outline-n-slate-6 focus:outline focus:outline-1 focus:outline-n-brand sm:text-sm sm:leading-6';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';

  const { actor, signIn, signInDemo, signInDevSession } = useAuth();
  // Local development: the API can issue sessions for seeded users (no Supabase needed).
  const [devSessionEnabled, setDevSessionEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchApi<{ enabled: boolean }>('/auth/dev-session')
      .then((status) => !cancelled && setDevSessionEnabled(status.enabled))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasErrored, setHasErrored] = useState(false);

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (actor) {
      router.replace(returnUrl);
    }
  }, [actor, router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setErrorMessage(error.message || 'Invalid credentials. Please try again.');
        setHasErrored(true);
        setTimeout(() => setHasErrored(false), 600);
      } else {
        router.replace(returnUrl);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDevSessionSignIn = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const { error } = await signInDevSession();
      if (error) {
        setErrorMessage(error.message || 'Could not start the local session.');
      } else {
        router.replace(returnUrl);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoSignIn = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await signInDemo('SUPER_ADMIN');
      router.replace(returnUrl);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to initialize preview session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex h-dvh w-full flex-col overflow-y-auto bg-n-brand/5 py-20 dark:bg-n-background sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-5xl flex-col items-center px-4">
        <VynorLogo variant="full" size={32} className="mx-auto" />
        <h1 className="mt-6 text-center text-3xl font-medium text-n-slate-12">Login to VYNOR</h1>
        <p className="mt-3 text-center text-sm text-n-slate-11">
          Access your omnichannel workspace
        </p>
      </section>

      <section
        className={cn(
          'mt-11 bg-white p-8 shadow dark:bg-n-solid-2 sm:mx-auto sm:w-full sm:max-w-lg sm:rounded-lg sm:p-11 sm:shadow-lg',
          hasErrored && 'animate-wiggle',
        )}
      >
        {errorMessage && (
          <Banner
            role="alert"
            color="ruby"
            icon={<AlertCircle className="size-4" />}
            className="mb-5"
          >
            {errorMessage}
          </Banner>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
          <div>
            <label htmlFor="email" className="text-sm font-medium leading-6 text-n-slate-12">
              Email
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@vynor.com"
                className={LOGIN_INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium leading-6 text-n-slate-12">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={cn(LOGIN_INPUT_CLASS, 'pr-10')}
              />
              <Button
                variant="link"
                color="slate"
                size="sm"
                icon={showPassword ? EyeOff : Eye}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 pr-3"
              />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            label={isSubmitting ? 'Signing in…' : 'Login'}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          />
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-n-strong" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 uppercase text-n-slate-10 dark:bg-n-solid-2">or</span>
          </div>
        </div>

        {devSessionEnabled && (
          <Button
            variant="faded"
            color="blue"
            size="lg"
            icon={KeyRound}
            className="mb-3 w-full"
            label="Sign in as local admin (development)"
            onClick={handleDevSessionSignIn}
            disabled={isSubmitting}
          />
        )}

        <Button
          variant="faded"
          color="slate"
          size="lg"
          icon={Sparkles}
          className="w-full"
          label="Explore UI/UX Demo (Super Admin)"
          onClick={handleDemoSignIn}
          disabled={isSubmitting}
        />

        <p className="mb-0 mt-6 text-center text-xs text-n-slate-10">
          VYNOR CRM security boundary · Role-based access control
        </p>
      </section>
    </main>
  );
}
