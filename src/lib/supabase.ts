import { createClient } from '@supabase/supabase-js';
import { TABLES } from './tables';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function isUsableUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * True only when real Supabase credentials are present. When they are not
 * (fresh clone, placeholder .env.local), the client below still exists but
 * points at an unreachable placeholder host, so the app builds and the
 * public pages - the live market dashboard included - keep working instead
 * of crashing at module load.
 */
export const isSupabaseConfigured = isUsableUrl(rawUrl) && rawAnonKey.length > 20;

const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawAnonKey : 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getSession() {
  if (!isSupabaseConfigured) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const { data: user, error } = await supabase
    .from(TABLES.users)
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }

  return user;
}

export async function checkAdminAccess() {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}
