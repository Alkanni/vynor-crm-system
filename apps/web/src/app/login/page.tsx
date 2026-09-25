'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { VynorLogo } from '@/components/common/VynorLogo';
import { ShieldCheck, AlertCircle, Loader2, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';

  const { actor, signIn, signInDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      } else {
        router.replace(returnUrl);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
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
    <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-lg">
      <div className="flex flex-col items-center text-center space-y-2">
        <VynorLogo variant="full" size={44} className="mb-1" />
        <h1 className="text-xl font-bold tracking-tight text-foreground">Sign in to VYNOR CRM</h1>
        <p className="text-xs text-muted-foreground">
          Enter your credentials to access your omnichannel workspace
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Work Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@vynor.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <span>Sign in</span>
          )}
        </button>
      </form>

      <div className="relative flex items-center justify-center my-1">
        <div className="border-t border-border w-full"></div>
        <span className="bg-card px-2 text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
          or preview UI/UX
        </span>
      </div>

      <button
        type="button"
        onClick={handleDemoSignIn}
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary/80 hover:bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground shadow-xs transition-colors cursor-pointer"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Explore UI/UX Demo (Super Admin Mode)</span>
      </button>

      <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
        VYNOR CRM Security Boundary &bull; Role-Based Access Control
      </div>
    </div>
  );
}
