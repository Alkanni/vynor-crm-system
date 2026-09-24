'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  hasAllPermissions,
  hasPermission,
  type ActorContext,
  type PermissionAction,
} from '@vynor/contracts';

export interface AuthContextValue {
  actor: ActorContext | null;
  isLoading: boolean;
  error: Error | null;
}

const AuthContext = createContext<AuthContextValue>({
  actor: null,
  isLoading: false,
  error: null,
});

export interface AuthProviderProps {
  children: ReactNode;
  initialActor?: ActorContext | null;
  isLoading?: boolean;
  error?: Error | null;
}

export function AuthProvider({
  children,
  initialActor = null,
  isLoading = false,
  error = null,
}: AuthProviderProps) {
  const value = useMemo(
    () => ({
      actor: initialActor,
      isLoading,
      error,
    }),
    [initialActor, isLoading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Accesses the full authentication context state.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/**
 * Accesses the currently authenticated request ActorContext.
 */
export function useActor(): ActorContext | null {
  return useContext(AuthContext).actor;
}

/**
 * Evaluates whether the current actor holds the required permission.
 */
export function usePermission(action: PermissionAction): boolean {
  const actor = useActor();
  return useMemo(() => {
    if (!actor) return false;
    return hasPermission(actor.permissions, action);
  }, [actor, action]);
}

/**
 * Evaluates whether the current actor holds all specified permissions.
 */
export function useAllPermissions(actions: PermissionAction[]): boolean {
  const actor = useActor();
  return useMemo(() => {
    if (!actor) return false;
    return hasAllPermissions(actor.permissions, actions);
  }, [actor, actions]);
}
