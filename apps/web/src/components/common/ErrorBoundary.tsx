'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApiClientError } from '@/lib/api/api-client';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const error = this.state.error;
      const isApiError = error instanceof ApiClientError;
      const correlationId = isApiError ? error.correlationId : `err_${Date.now()}`;
      const code = isApiError ? error.code : 'UNEXPECTED_ERROR';
      const message = error?.message || 'An unexpected rendering error occurred.';

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 rounded-full bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-10 w-10" />
          </div>
          <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h2>
          <p className="mb-4 max-w-md text-sm text-muted-foreground">{message}</p>

          <div className="mb-6 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground">Code: </span>
              <code>{code}</code>
            </div>
            <div>
              <span className="font-semibold text-foreground">Correlation ID: </span>
              <code>{correlationId}</code>
            </div>
          </div>

          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
