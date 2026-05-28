import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useSession } from '@/lib/session';
import { useProfile } from '@/lib/queries/profile';
import { supabase } from '@/lib/supabase';

/**
 * Landing screen. Step 4 will replace this with the real customer entry
 * (hero + categories grid + truck list). Right now it doubles as the
 * auth-status sandbox: shows session state, profile/role, and sign in/out
 * buttons so we can exercise Step 3 end-to-end.
 */
export default function Landing() {
  const { loading, user } = useSession();
  const profile = useProfile().data;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          YYC Street Food
        </Text>

        {loading ? (
          <View className="mt-6">
            <ActivityIndicator />
          </View>
        ) : user ? (
          <View className="mt-6 w-full items-center gap-2">
            <Text className="text-base text-neutral-700 dark:text-neutral-300">
              Signed in as {user.email}
            </Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">
              role: {profile?.role ?? '…'}
            </Text>
            <Pressable
              onPress={() => supabase.auth.signOut()}
              className="mt-4 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3"
            >
              <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Sign out
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-6 w-full items-center">
            <Text className="text-base text-neutral-500 dark:text-neutral-400">
              Browse without an account, or sign in.
            </Text>
            <Pressable
              onPress={() => router.push('/sign-in')}
              className="mt-4 items-center justify-center rounded-lg bg-neutral-900 px-6 py-3"
            >
              <Text className="text-base font-semibold text-white">Sign in</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
