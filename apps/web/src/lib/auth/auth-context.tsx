'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  hasAllPermissions,
  hasPermission,
  type ActorContext,
  type PermissionAction,
} from '@vynor/contracts';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface AuthContextValue {
  actor: ActorContext | null;
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  isLoading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInDemo: (role?: 'SUPER_ADMIN' | 'AGENT') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  actor: null,
  user: null,
  session: null,
  accessToken: null,
  isLoading: true,
  error: null,
  signIn: async () => ({ error: null }),
  signInDemo: async () => ({ error: null }),
  signOut: async () => {},
  refreshSession: async () => {},
});

export interface AuthProviderProps {
  children: ReactNode;
  initialActor?: ActorContext | null;
  initialSession?: Session | null;
}

export function AuthProvider({
  children,
  initialActor = null,
  initialSession = null,
}: AuthProviderProps) {
  const [actor, setActor] = useState<ActorContext | null>(initialActor);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [isLoading, setIsLoading] = useState<boolean>(!initialActor && !initialSession);
  const [error, setError] = useState<Error | null>(null);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const syncAuthCookie = useCallback((currentSession: Session | null) => {
    if (typeof document !== 'undefined') {
      if (currentSession?.access_token) {
        document.cookie = `vynor_session=${encodeURIComponent(currentSession.access_token)}; path=/; max-age=604800; SameSite=Lax`;
      } else {
        document.cookie = 'vynor_session=; path=/; max-age=0; SameSite=Lax';
      }
    }
  }, []);

  const resolveActorFromSession = useCallback(
    async (currentSession: Session | null): Promise<void> => {
      if (!currentSession?.user) {
        setActor(null);
        syncAuthCookie(null);
        return;
      }

      syncAuthCookie(currentSession);

      try {
        // Construct or resolve default workspace ActorContext for current user
        const resolvedActor: ActorContext = {
          user: {
            id: currentSession.user.id,
            supabaseAuthId: currentSession.user.id,
            email: currentSession.user.email ?? '',
            displayName:
              (currentSession.user.user_metadata?.displayName as string) ??
              currentSession.user.email?.split('@')[0] ??
              'User',
            isActive: true,
          },
          workspace: {
            id: (currentSession.user.user_metadata?.workspaceId as string) ?? 'ws_default',
            name:
              (currentSession.user.user_metadata?.workspaceName as string) ?? 'Default Workspace',
            slug: 'default',
            timezone: 'UTC',
          },
          membership: {
            id: `mem_${currentSession.user.id.slice(0, 8)}`,
            status: 'ACTIVE',
            roles: ['SUPER_ADMIN'],
            teams: [],
          },
          // Default development permissions catalog
          permissions: [
            'conversation:read',
            'conversation:write',
            'conversation:assign',
            'conversation:close',
            'message:read',
            'message:send',
            'contact:read',
            'contact:write',
            'campaign:read',
            'campaign:write',
            'campaign:launch',
            'analytics:read',
            'workspace:read',
            'team:read',
            'role:read',
            'integration:read',
            'audit:read',
          ],
          correlationId: `ui_${Date.now()}`,
        };

        setActor(resolvedActor);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [syncAuthCookie],
  );

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (isMounted) {
          setSession(currentSession);
          await resolveActorFromSession(currentSession);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (isMounted) {
        setSession(newSession);
        await resolveActorFromSession(newSession);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, resolveActorFromSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        setIsLoading(true);
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError);
          return { error: signInError };
        }

        setSession(data.session);
        await resolveActorFromSession(data.session);
        return { error: null };
      } catch (err) {
        const authErr = err instanceof Error ? err : new Error(String(err));
        setError(authErr);
        return { error: authErr };
      } finally {
        setIsLoading(false);
      }
    },
    [supabase, resolveActorFromSession],
  );

  const signInDemo = useCallback(
    async (role: 'SUPER_ADMIN' | 'AGENT' = 'SUPER_ADMIN') => {
      const mockSession: Session = {
        access_token: `mock_jwt_demo_${Date.now()}`,
        token_type: 'bearer',
        expires_in: 86400,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        refresh_token: 'mock_refresh_token_demo',
        user: {
          id: 'usr_demo_admin',
          app_metadata: { provider: 'email' },
          user_metadata: {
            displayName: role === 'SUPER_ADMIN' ? 'Demo Administrator' : 'Demo Agent',
            workspaceId: 'ws_demo_vynor',
            workspaceName: 'Vynor CRM Workspace',
          },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          email: 'admin@vynor.io',
          role: 'authenticated',
        },
      };

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('vynor_supabase_auth', JSON.stringify(mockSession));
      }
      setSession(mockSession);
      await resolveActorFromSession(mockSession);
      return { error: null };
    },
    [resolveActorFromSession],
  );

  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      try {
        await supabase.auth.signOut();
      } catch {
        // Safe fallback in mock/preview mode
      }
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('vynor_supabase_auth');
      }
      setSession(null);
      setActor(null);
      syncAuthCookie(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, syncAuthCookie]);

  const refreshSession = useCallback(async () => {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) {
      setSession(data.session);
      await resolveActorFromSession(data.session);
    }
  }, [supabase, resolveActorFromSession]);

  const value = useMemo(
    () => ({
      actor,
      user: session?.user ?? null,
      session,
      accessToken: session?.access_token ?? null,
      isLoading,
      error,
      signIn,
      signInDemo,
      signOut,
      refreshSession,
    }),
    [actor, session, isLoading, error, signIn, signInDemo, signOut, refreshSession],
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
