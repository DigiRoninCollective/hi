import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

let supabase: SupabaseClient<Database> | null = null;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  }

  return { url, anonKey, serviceRoleKey };
}

export function initSupabase(): SupabaseClient<Database> {
  if (supabase) return supabase;

  const config = getSupabaseConfig();

  // Use service role key for server-side operations if available
  const key = config.serviceRoleKey || config.anonKey;

  supabase = createClient<Database>(config.url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  });

  return supabase;
}

export function getSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    return initSupabase();
  }
  return supabase;
}

// Client-side Supabase (uses anon key only)
export function createClientSupabase(): SupabaseClient<Database> {
  const config = getSupabaseConfig();
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}
