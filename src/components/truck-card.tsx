import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';

import type { TruckListRow } from '@/lib/queries/trucks';

/**
 * Row card for a truck in any list (full list, category, future favorites).
 * Status pill is colored green/closed based on the view's `status` column,
 * which is server-computed by current_truck_status().
 */
export function TruckCard({ truck }: { truck: TruckListRow }) {
  const isOpen = truck.status === 'open';
  return (
    <Link href={`/trucks/${truck.slug}`} asChild>
      <Pressable className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {truck.name}
            </Text>
            <Text className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {truck.category_name}
            </Text>
            {truck.description ? (
              <Text
                numberOfLines={2}
                className="mt-2 text-sm text-neutral-600 dark:text-neutral-300"
              >
                {truck.description}
              </Text>
            ) : null}
          </View>
          <StatusPill open={isOpen} />
        </View>
        {truck.review_count > 0 ? (
          <Text className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            ★ {truck.avg_rating.toFixed(1)} · {truck.review_count} review
            {truck.review_count === 1 ? '' : 's'}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

export function StatusPill({ open }: { open: boolean }) {
  return (
    <View
      className={`rounded-full px-2.5 py-1 ${
        open
          ? 'bg-green-100 dark:bg-green-900/40'
          : 'bg-neutral-200 dark:bg-neutral-800'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          open
            ? 'text-green-700 dark:text-green-300'
            : 'text-neutral-600 dark:text-neutral-400'
        }`}
      >
        {open ? 'Open' : 'Closed'}
      </Text>
    </View>
  );
}
