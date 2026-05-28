import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';

import {
  useClearManualOverride,
  useMyOperatedTrucks,
  useSetManualOverride,
  type OperatorTruck,
} from '@/lib/queries/operator-trucks';
import { useRequireOperator } from '@/lib/auth-gates';

/**
 * Operator dashboard. Lists the trucks the signed-in user owns (RLS
 * guarantees none of someone else's trucks leak here) and surfaces the
 * one thing operators reach for fastest: the open/closed override.
 *
 * Edit basics + menu live behind their own routes; schedule editing comes
 * in Step 7.
 */
export default function OperatorDashboard() {
  const gate = useRequireOperator();
  const trucks = useMyOperatedTrucks();
  if (gate) return gate;

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Operator' }} />

      {trucks.isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : trucks.error ? (
        <Text className="text-sm text-red-600 dark:text-red-400">
          Couldn't load your trucks: {String(trucks.error)}
        </Text>
      ) : (trucks.data ?? []).length === 0 ? (
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          You don't own any trucks yet. An admin will assign one to you.
        </Text>
      ) : (
        trucks.data!.map((truck) => <TruckCard key={truck.id} truck={truck} />)
      )}
    </ScrollView>
  );
}

function TruckCard({ truck }: { truck: OperatorTruck }) {
  const setOverride = useSetManualOverride();
  const clearOverride = useClearManualOverride();
  const pending = setOverride.isPending || clearOverride.isPending;

  // "End of today" expiry — 23:59:59 local time, ISO string.
  const endOfTodayIso = (() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  })();

  const overrideText = describeOverride(truck);

  return (
    <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
      <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {truck.name}
      </Text>
      <Text className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
        {truck.slug}
      </Text>

      <View className="mt-3 flex-row gap-2">
        <NavButton href={`/trucks/${truck.id}/edit`} label="Edit basics" />
        <NavButton href={`/trucks/${truck.id}/menu`} label="Menu" />
        <NavButton href={`/trucks/${truck.id}/schedule`} label="Schedule" />
      </View>

      <View className="mt-5 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
        <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Open / closed override
        </Text>
        <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {overrideText}
        </Text>

        <View className="mt-3 gap-2">
          <Pressable
            disabled={pending}
            onPress={() =>
              setOverride.mutate({
                id: truck.id,
                status: 'open',
                expiresAt: endOfTodayIso,
              })
            }
            className={`items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 ${
              pending ? 'opacity-60' : ''
            }`}
          >
            <Text className="text-sm font-semibold text-white">
              Force Open (until tonight)
            </Text>
          </Pressable>
          <Pressable
            disabled={pending}
            onPress={() =>
              setOverride.mutate({
                id: truck.id,
                status: 'closed',
                expiresAt: endOfTodayIso,
              })
            }
            className={`items-center justify-center rounded-lg bg-neutral-700 px-4 py-2.5 ${
              pending ? 'opacity-60' : ''
            }`}
          >
            <Text className="text-sm font-semibold text-white">
              Force Closed (until tonight)
            </Text>
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
                Clear override (use schedule)
              </Text>
            </Pressable>
          ) : null}
        </View>
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

function describeOverride(truck: OperatorTruck): string {
  if (!truck.manual_override_status) return 'No override — schedule decides.';
  if (!truck.manual_override_expires_at) {
    return `Override: forced ${truck.manual_override_status} (no expiry).`;
  }
  const expires = new Date(truck.manual_override_expires_at);
  if (expires < new Date()) {
    return `Override expired (was: ${truck.manual_override_status}).`;
  }
  return `Override: forced ${truck.manual_override_status} until ${expires.toLocaleTimeString(
    undefined,
    { hour: 'numeric', minute: '2-digit' }
  )}.`;
}
