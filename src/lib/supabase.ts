import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Fail loudly at module load if env isn't wired — much better than the
  // mystery 401s you get when supabase-js silently falls back to undefined.
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. ' +
      'Copy .env.example to .env and restart Metro.'
  );
}

/**
 * SecureStore-backed session storage. iOS Keychain entries are capped at ~4KB
 * per key and JWT+refresh token comfortably fit — but if we ever start
 * stashing additional state on the session, revisit (and consider AsyncStorage
 * + a small SecureStore "session key" pattern).
 */
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // RN apps never load via a redirect URL, so this saves a needless lookup.
    detectSessionInUrl: false,
    // PKCE is the recommended flow for mobile auth callbacks (invite link,
    // password reset). With pkce, the redirect URL carries ?code=... which
    // we exchange for a session via exchangeCodeForSession in
    // src/app/auth-callback.tsx — much friendlier than parsing hash
    // fragments out of native deep links.
    flowType: 'pkce',
  },
});

// Supabase's auto-refresh runs on a setInterval that pauses when JS is paused.
// Tell it explicitly when the app goes background/foreground so the token
// refresh tracks the OS-level lifecycle.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
