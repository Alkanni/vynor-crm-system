import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/env';

let supabaseClient: SupabaseClient | null = null;

/**
 * Returns a singleton browser Supabase Auth client (FND-FE-002, FND-026).
 * Persists session in cookies/local storage and auto-refreshes tokens.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    // Server-side rendering safe fallback
    return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  if (!supabaseClient) {
    supabaseClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'vynor_supabase_auth',
      },
    });
  }

  return supabaseClient;
}
