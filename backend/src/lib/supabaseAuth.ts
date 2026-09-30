import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function verifySupabaseToken(
  token: string,
): Promise<{ authUserId: string; email: string | null } | null> {
  const supabase = getClient();
  if (!supabase || !token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { authUserId: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}
