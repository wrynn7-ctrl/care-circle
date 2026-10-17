import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from './env';
import { kvAdapter } from './storage';
import type { Database } from '@/types/database';

/**
 * The single Supabase client, created on first use so that nothing touches on-device storage before
 * `initStorage()` has finished (the root layout gates rendering on it; static web export renders with
 * no storage at all). Sessions persist in the encrypted store. `detectSessionInUrl` is off because
 * mobile sign-in never completes through a URL redirect; we use one-time codes and native ID tokens.
 */
let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  client = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      storage: kvAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  // Refresh tokens only while the app is in the foreground (recommended by Supabase for React Native).
  if (Platform.OS !== 'web') {
    const c = client;
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void c.auth.startAutoRefresh();
      else void c.auth.stopAutoRefresh();
    });
  }
  return client;
}
