import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';

import { useSession } from '@/lib/session';
import { useProfile } from '@/lib/queries/profile';
import { useCategories, type Category } from '@/lib/queries/categories';
import {
  useClearManualOverride,
  useMyOperatedTrucks,
  useSetManualOverride,
  type OperatorTruck,
} from '@/lib/queries/operator-trucks';
import { supabase } from '@/lib/supabase';

/**
 * Landing — dispatches on role.
 *   - customer / anon  → browse-focused (categories grid + all-trucks)
 *   - operator / admin → ops-focused (their trucks + override controls)
 *
 * Both share the top chrome (title + identity row + sign-in/out).
 */
export default function Landing() {
  const { loading, user } = useSession();
  const profile = useProfile().data;
  const role = profile?.role;
  const isOperator = role === 'operator' || role === 'admin';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Chrome
          loading={loading}
          email={user?.email ?? null}
          role={role ?? null}
          isOperator={isOperator}
        />
        {isOperator ? <OperatorView /> : <CustomerView signedIn={!!user} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chrome({
  loading,
  email,
  role,
  isOperator,
}: {
  loading: boolean;
  email: string | null;
  role: string | null;
  isOperator: boolean;
}) {
  return (
    <View className="px-6 pt-6 pb-2">
      <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
        YYC Street Food{isOperator ? ' — Operator' : ''}
      </Text>
      <Text className="mt-1 text-base text-neutral-500 dark:text-neutral-400">
        {isOperator ? 'Manage your truck.' : "Find a truck. See if it's open."}
      </Text>

      <View className="mt-4">
        {loading ? (
          <ActivityIndicator />
        ) : email ? (
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              {email}
              {role ? ` (${role})` : ''}
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
  );
}

// ---------------------------------------------------------------------------
// Customer view
// ---------------------------------------------------------------------------

function CustomerView({ signedIn }: { signedIn: boolean }) {
  const categories = useCategories();

  return (
    <>
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
        {signedIn ? (
          <>
            <NavTile href="/favorites" label="Favorites" />
            <NavTile href="/inbox" label="Inbox" />
          </>
        ) : null}
        <NavTile href="/contact" label="Contact us" />
      </View>
    </>
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

// ---------------------------------------------------------------------------
// Operator view
// ---------------------------------------------------------------------------

function OperatorView() {
  const trucks = useMyOperatedTrucks();

  return (
    <View className="px-6 pt-6 gap-4">
      <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Your trucks
      </Text>

      {trucks.isLoading ? (
        <ActivityIndicator />
      ) : trucks.error ? (
        <Text className="text-sm text-red-600 dark:text-red-400">
          Couldn't load your trucks: {String(trucks.error)}
        </Text>
      ) : (trucks.data ?? []).length === 0 ? (
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          No trucks assigned to you yet. An admin will add one to your account.
        </Text>
      ) : (
        trucks.data!.map((t) => <OperatorTruckCard key={t.id} truck={t} />)
      )}

      {/*
        Operators only see the public-facing "Browse trucks" link here.
        The /contact form is customer-to-management; surfacing it to
        operators conflates roles. Favorites + inbox are deliberately
        omitted too — operators talk to admin out-of-band, not via the
        customer contact pipeline.
      */}
      <View className="mt-2 flex-row flex-wrap gap-3">
        <NavTile href="/trucks" label="Browse trucks" />
      </View>
    </View>
  );
}

function OperatorTruckCard({ truck }: { truck: OperatorTruck }) {
  const setOverride = useSetManualOverride();
  const clearOverride = useClearManualOverride();
  const pending = setOverride.isPending || clearOverride.isPending;

  const endOfTodayIso = (() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  })();

  return (
    <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
      <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {truck.name}
      </Text>
      <Text className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
        {describeOverride(truck)}
      </Text>

      <View className="mt-3 flex-row gap-2">
        <NavButton href={`/trucks/${truck.id}/edit`} label="Edit" />
        <NavButton href={`/trucks/${truck.id}/menu`} label="Menu" />
        <NavButton href={`/trucks/${truck.id}/schedule`} label="Schedule" />
      </View>

      <View className="mt-3 gap-2">
        <Pressable
          disabled={pending}
          onPress={() =>
            setOverride.mutate({ id: truck.id, status: 'open', expiresAt: endOfTodayIso })
          }
          className={`items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 ${
            pending ? 'opacity-60' : ''
          }`}
        >
          <Text className="text-sm font-semibold text-white">Force Open (tonight)</Text>
        </Pressable>
        <Pressable
          disabled={pending}
          onPress={() =>
            setOverride.mutate({ id: truck.id, status: 'closed', expiresAt: endOfTodayIso })
          }
          className={`items-center justify-center rounded-lg bg-neutral-700 px-4 py-2.5 ${
            pending ? 'opacity-60' : ''
          }`}
        >
          <Text className="text-sm font-semibold text-white">Force Closed (tonight)</Text>
        </Pressable>
        {truck.manual_override_status ? (
          <Pressable
            disabled={pending}
            onPress={() => clearOverride.mutate(truck.id)}
            className={`items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 ${
              pending ? 'opacity-60' : ''
            }`}
          >
            <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Clear override
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function NavButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable className="flex-1 items-center justify-center rounded-lg bg-neutral-900 px-4 py-2.5">
        <Text className="text-sm font-semibold text-white">{label}</Text>
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

function describeOverride(truck: OperatorTruck): string {
  if (!truck.manual_override_status) return 'No override — schedule decides.';
  if (!truck.manual_override_expires_at) {
    return `Override: forced ${truck.manual_override_status} (no expiry).`;
  }
  const expires = new Date(truck.manual_override_expires_at);
  if (expires < new Date()) return `Override expired (was: ${truck.manual_override_status}).`;
  return `Override: forced ${truck.manual_override_status} until ${expires.toLocaleTimeString(
    undefined,
    { hour: 'numeric', minute: '2-digit' }
  )}.`;
}
