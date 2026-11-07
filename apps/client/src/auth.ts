import type { SupabaseClient } from '@supabase/supabase-js';

/** What the server tells us about login (`GET /api/config`). */
export interface AuthConfig {
  auth: 'supabase' | 'password';
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  inviteRequired: boolean;
  providers: string[];
  /** Set when the game has moved to a new address. */
  canonicalUrl?: string | null;
}

const FALLBACK: AuthConfig = {
  auth: 'password',
  supabaseUrl: null,
  supabaseAnonKey: null,
  inviteRequired: false,
  providers: [],
};

export async function loadConfig(server: string): Promise<AuthConfig> {
  try {
    const r = await fetch(`${server}/api/config`);
    if (!r.ok) return FALLBACK;
    return { ...FALLBACK, ...((await r.json()) as Partial<AuthConfig>) };
  } catch {
    return FALLBACK;
  }
}

let client: Promise<SupabaseClient> | null = null;

/** The Supabase client is only loaded when social login is switched on. */
function sb(cfg: AuthConfig): Promise<SupabaseClient> {
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('Supabase is not configured');
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(cfg.supabaseUrl!, cfg.supabaseAnonKey!, {
      auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true },
    }),
  );
  return client;
}

/** True if we just came back from Google/Facebook or a magic link. */
export function isAuthRedirect() {
  return (
    /access_token=|error_description=/.test(location.hash) || /[?&]code=/.test(location.search)
  );
}

/** Current Supabase access token (also picks up a session from the redirect URL). */
export async function accessToken(cfg: AuthConfig): Promise<string | null> {
  const s = await sb(cfg);
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signInWithProvider(cfg: AuthConfig, provider: 'google' | 'facebook') {
  const s = await sb(cfg);
  const { error } = await s.auth.signInWithOAuth({
    provider,
    options: { redirectTo: location.origin },
  });
  if (error) throw error;
}

export async function signInWithEmail(cfg: AuthConfig, email: string) {
  const s = await sb(cfg);
  const { error } = await s.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin, shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function signOut(cfg: AuthConfig) {
  if (cfg.auth !== 'supabase') return;
  try {
    await (await sb(cfg)).auth.signOut();
  } catch {
    /* already signed out */
  }
}
