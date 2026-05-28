import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';

import { useSession } from '@/lib/session';
import { useProfile } from '@/lib/queries/profile';
import { useCategories, type Category } from '@/lib/queries/categories';
import { supabase } from '@/lib/supabase';

/**
 * Landing — the customer entry point. No auth required.
 *
 * Layout:
 *   - Header with "YYC Street Food" + sign in / sign out
 *   - "Browse by category" 2-column grid of the 6 categories
 *   - "All trucks" CTA to the full searchable list
 *   - Quick nav row to Favorites / Inbox / Contact
 */
export default function Landing() {
  const { loading: sessionLoading, user } = useSession();
  const profile = useProfile().data;
  const categories = useCategories();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-6 pt-6 pb-2">
          <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            YYC Street Food
          </Text>
          <Text className="mt-1 text-base text-neutral-500 dark:text-neutral-400">
            Find a truck. See if it's open.
          </Text>

          <View className="mt-4">
            {sessionLoading ? (
              <ActivityIndicator />
            ) : user ? (
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-neutral-600 dark:text-neutral-400">
                  Signed in as {user.email}
                  {profile?.role ? ` (${profile.role})` : ''}
                </Text>
                <Pressable
                  onPress={() => supabase.auth.signOut()}
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5"
                >
                  <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    Sign out
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-neutral-600 dark:text-neutral-400">
                  Browse without an account.
                </Text>
                <Pressable
                  onPress={() => router.push('/sign-in')}
                  className="rounded-md bg-neutral-900 px-3 py-1.5"
                >
                  <Text className="text-sm font-semibold text-white">Sign in</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View className="px-6 pt-6">
          <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Browse by category
          </Text>
        </View>

        <View className="px-6 pt-3">
          {categories.isLoading ? (
            <ActivityIndicator className="my-6" />
          ) : categories.error ? (
            <Text className="my-6 text-sm text-red-600 dark:text-red-400">
              Couldn't load categories: {String(categories.error)}
            </Text>
          ) : (
            <FlatList
              data={categories.data ?? []}
              keyExtractor={(c) => String(c.id)}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: 12 }}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              renderItem={({ item }) => <CategoryTile category={item} />}
            />
          )}
        </View>

        <View className="px-6 pt-6">
          <Link href="/trucks" asChild>
            <Pressable className="items-center justify-center rounded-lg bg-neutral-900 px-4 py-3">
              <Text className="text-base font-semibold text-white">See all trucks</Text>
            </Pressable>
          </Link>
        </View>

        <View className="px-6 pt-6 flex-row flex-wrap gap-3">
          {user ? (
            <>
              <NavTile href="/favorites" label="Favorites" />
              <NavTile href="/inbox" label="Inbox" />
            </>
          ) : null}
          <NavTile href="/contact" label="Contact us" />
          {profile?.role === 'operator' || profile?.role === 'admin' ? (
            <NavTile href="/dashboard" label="Operator dashboard" />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CategoryTile({ category }: { category: Category }) {
  return (
    <Link href={`/categories/${category.slug}`} asChild>
      <Pressable className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-4 min-h-[88px] justify-end">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {category.name}
        </Text>
      </Pressable>
    </Link>
  );
}

function NavTile({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable className="flex-1 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-3">
        <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}
