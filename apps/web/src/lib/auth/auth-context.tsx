'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { fetchApi, isApiUnreachable } from '@/lib/api/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * `connected`: the actor, workspace and permissions come from the API and pages use real data.
 * `preview`: UI-only demo (no API reachable or demo sign-in); pages show sample data.
 */
export type AuthMode = 'connected' | 'preview';

export interface AuthContextValue {
  actor: ActorContext | null;
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  mode: AuthMode;
  isLoading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInDemo: (role?: 'SUPER_ADMIN' | 'AGENT') => Promise<{ error: Error | null }>;
  /** Local development only: signs in as a seeded user through the API. */
  signInDevSession: (email?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  actor: null,
  user: null,
  session: null,
  accessToken: null,
  mode: 'preview',
  isLoading: true,
  error: null,
  signIn: async () => ({ error: null }),
  signInDemo: async () => ({ error: null }),
  signInDevSession: async () => ({ error: null }),
  signOut: async () => {},
  refreshSession: async () => {},
});

const DEMO_TOKEN_PREFIX = 'mock_jwt_demo_';
const DEV_SESSION_KEY = 'vynor_dev_session';

interface StoredDevSession {
  accessToken: string;
  expiresAt: string;
  user: { id: string; email: string; displayName: string };
}

function readDevSession(): StoredDevSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(DEV_SESSION_KEY) ?? 'null',
    ) as StoredDevSession | null;
    if (!parsed?.accessToken || Date.parse(parsed.expiresAt) <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDevSession(value: StoredDevSession | null): void {
  try {
    if (value) window.localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(DEV_SESSION_KEY);
  } catch {
    // Storage blocked: the session simply lasts for this tab.
  }
}

function devSessionToSession(dev: StoredDevSession): Session {
  const expiresAt = Math.floor(Date.parse(dev.expiresAt) / 1000);
  return {
    access_token: dev.accessToken,
    token_type: 'bearer',
    expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    expires_at: expiresAt,
    refresh_token: '',
    user: {
      id: dev.user.id,
      app_metadata: { provider: 'vynor-dev' },
      user_metadata: { displayName: dev.user.displayName },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: dev.user.email,
      role: 'authenticated',
    },
  };
}

/** Sample actor for preview mode, when no API session exists. */
function buildPreviewActor(session: Session): ActorContext {
  return {
    user: {
      id: session.user.id,
      supabaseAuthId: session.user.id,
      email: session.user.email ?? '',
      displayName:
        (session.user.user_metadata?.displayName as string) ??
        session.user.email?.split('@')[0] ??
        'User',
      isActive: true,
    },
    workspace: {
      id: (session.user.user_metadata?.workspaceId as string) ?? 'ws_default',
      name: (session.user.user_metadata?.workspaceName as string) ?? 'Default Workspace',
      slug: 'default',
      timezone: 'UTC',
    },
    membership: {
      id: `mem_${session.user.id.slice(0, 8)}`,
      status: 'ACTIVE',
      roles: ['SUPER_ADMIN'],
      teams: [],
    },
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
      'integration:manage',
      'audit:read',
    ],
    correlationId: `ui_${Date.now()}`,
  };
}

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
  const [mode, setMode] = useState<AuthMode>('preview');
  const [isLoading, setIsLoading] = useState<boolean>(!initialActor && !initialSession);
  const [error, setError] = useState<Error | null>(null);
  // Dev sessions live outside Supabase, so Supabase's "no session" events must not clear them.
  const devSessionActive = useRef(false);

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

  /**
   * Resolves who the user is. Real sessions ask the API (`GET /auth/me`) so workspace, roles
   * and permissions are the backend's (AD-007); when the API is unreachable the app falls
   * back to preview mode instead of locking the user out.
   */
  const resolveActorFromSession = useCallback(
    async (currentSession: Session | null): Promise<Error | null> => {
      if (!currentSession?.user) {
        setActor(null);
        setMode('preview');
        syncAuthCookie(null);
        return null;
      }

      syncAuthCookie(currentSession);

      if (currentSession.access_token.startsWith(DEMO_TOKEN_PREFIX)) {
        setActor(buildPreviewActor(currentSession));
        setMode('preview');
        setError(null);
        return null;
      }

      try {
        const resolved = await fetchApi<ActorContext>('/auth/me', {
          token: currentSession.access_token,
        });
        setActor(resolved);
        setMode('connected');
        setError(null);
        return null;
      } catch (err) {
        if (isApiUnreachable(err)) {
          setActor(buildPreviewActor(currentSession));
          setMode('preview');
          return null;
        }
        const authError = err instanceof Error ? err : new Error(String(err));
        setActor(null);
        setMode('preview');
        setError(authError);
        syncAuthCookie(null);
        return authError;
      }
    },
    [syncAuthCookie],
  );

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const dev = readDevSession();
        if (dev) {
          devSessionActive.current = true;
          const devSession = devSessionToSession(dev);
          if (isMounted) {
            setSession(devSession);
            await resolveActorFromSession(devSession);
          }
          return;
        }

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
      if (!isMounted || (devSessionActive.current && !newSession)) return;
      setSession(newSession);
      await resolveActorFromSession(newSession);
      setIsLoading(false);
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
        const actorError = await resolveActorFromSession(data.session);
        return { error: actorError };
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
        access_token: `${DEMO_TOKEN_PREFIX}${Date.now()}`,
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

  const signInDevSession = useCallback(
    async (email?: string) => {
      try {
        setIsLoading(true);
        const dev = await fetchApi<StoredDevSession>('/auth/dev-session', {
          method: 'POST',
          body: JSON.stringify(email ? { email } : {}),
        });
        writeDevSession(dev);
        devSessionActive.current = true;
        const devSession = devSessionToSession(dev);
        setSession(devSession);
        const actorError = await resolveActorFromSession(devSession);
        return { error: actorError };
      } catch (err) {
        const authErr = err instanceof Error ? err : new Error(String(err));
        setError(authErr);
        return { error: authErr };
      } finally {
        setIsLoading(false);
      }
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
      writeDevSession(null);
      devSessionActive.current = false;
      setSession(null);
      setActor(null);
      setMode('preview');
      syncAuthCookie(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, syncAuthCookie]);

  const refreshSession = useCallback(async () => {
    if (devSessionActive.current) return;
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
      mode,
      isLoading,
      error,
      signIn,
      signInDemo,
      signInDevSession,
      signOut,
      refreshSession,
    }),
    [
      actor,
      session,
      mode,
      isLoading,
      error,
      signIn,
      signInDemo,
      signInDevSession,
      signOut,
      refreshSession,
    ],
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
