import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@/lib/api/api-client';

/**
 * Creates a preconfigured TanStack QueryClient with production defaults (FND-FE-004).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
        retry: (failureCount, error) => {
          // Do not retry 4xx client errors (unauthorized, forbidden, not found, validation error)
          if (
            error instanceof ApiClientError &&
            error.statusCode >= 400 &&
            error.statusCode < 500
          ) {
            return false;
          }
          return failureCount < 3;
        },
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
