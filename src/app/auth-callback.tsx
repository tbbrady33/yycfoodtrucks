import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

/**
 * Deep-link landing page. The invite email Supabase sends contains a link
 * that ultimately redirects to:
 *
 *   yycfoodtruck://auth-callback?code=PKCE_CODE
 *
 * Expo Router matches this path → renders this screen. We exchange the
 * code for a Supabase session via exchangeCodeForSession; once that
 * succeeds, AuthRedirect picks up that profiles.must_change_password is
 * true (set by admin-create-operator) and routes the operator to
 * /change-password to set a real password.
 */
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [status, setStatus] = useState<'pending' | 'error'>('pending');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setErr('No code in the link.');
      return;
    }
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          setStatus('error');
          setErr(errorMessage(error));
          return;
        }
        router.replace('/');
      })
      .catch((e) => {
        setStatus('error');
        setErr(errorMessage(e));
      });
  }, [code]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <View className="flex-1 items-center justify-center px-6 gap-3">
        {status === 'pending' ? (
          <>
            <ActivityIndicator />
            <Text className="text-base text-neutral-600 dark:text-neutral-400">
              Completing sign-in…
            </Text>
          </>
        ) : (
          <>
            <Text className="text-base font-semibold text-red-600 dark:text-red-400">
              Couldn't sign you in
            </Text>
            <Text className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
              {err ?? 'Try opening the email link again.'}
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
