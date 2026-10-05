import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (run `npx supabase start`, then see README).');
}

/** A client with no session — what an attacker without an account sees. */
export function anonClient(): Db {
  return createClient<Database>(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Signs up a fresh user (local Supabase has email confirmation off) and returns a client acting as them. */
export async function newUser(label: string): Promise<{ db: Db; id: string; email: string }> {
  const db = anonClient();
  const email = `${label}-${randomUUID()}@example.test`;
  const { data, error } = await db.auth.signUp({ email, password: 'password-123' });
  if (error || !data.user || !data.session) {
    throw new Error(`Could not sign up ${email}: ${error?.message ?? 'no session — is email confirmation on?'}`);
  }
  return { db, id: data.user.id, email };
}
