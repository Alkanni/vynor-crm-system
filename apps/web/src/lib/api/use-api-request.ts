'use client';

import { useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { fetchApi, type ApiRequestOptions } from './api-client';

/** Returns a fetcher bound to the signed-in user's token and workspace. */
export function useApiRequest() {
  const { accessToken, actor } = useAuth();
  const workspaceId = actor?.workspace.id;
  return useCallback(
    <T>(path: string, options: ApiRequestOptions = {}) =>
      fetchApi<T>(path, {
        ...options,
        ...(accessToken ? { token: accessToken } : {}),
        ...(workspaceId ? { workspaceId } : {}),
      }),
    [accessToken, workspaceId],
  );
}
