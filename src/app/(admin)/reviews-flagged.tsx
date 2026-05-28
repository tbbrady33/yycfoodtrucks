import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { useRequireAdmin } from '@/lib/auth-gates';
import { useFlaggedReviews, useModerateReview } from '@/lib/queries/admin';
import type { Review } from '@/lib/queries/reviews';

export default function ReviewsFlagged() {
  const gate = useRequireAdmin();
  const reviews = useFlaggedReviews();
  if (gate) return gate;

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Flagged reviews' }} />

      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
        Reviews customers have flagged. Restoring marks them visible again;
        removing hides them from public view but keeps the row (the author
        still sees it).
      </Text>

      {reviews.isLoading ? (
        <ActivityIndicator className="mt-4" />
      ) : (reviews.data ?? []).length === 0 ? (
        <Text className="mt-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Nothing in the moderation queue.
        </Text>
      ) : (
        (reviews.data ?? []).map((r) => <ReviewCard key={r.id} review={r} />)
      )}
    </ScrollView>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const moderate = useModerateReview();
  const date = new Date(review.created_at).toLocaleDateString();

  return (
    <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="text-base font-semibold text-amber-600 dark:text-amber-400">
          {'★'.repeat(review.rating)}
          <Text className="text-neutral-300 dark:text-neutral-700">
            {'★'.repeat(5 - review.rating)}
          </Text>
        </Text>
        <StatusBadge status={review.status} />
      </View>
      <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {date} · truck {review.truck_id} · author {review.author_id}
      </Text>
      {review.body ? (
        <Text className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          {review.body}
        </Text>
      ) : (
        <Text className="mt-2 text-sm italic text-neutral-500 dark:text-neutral-400">
          (no body)
        </Text>
      )}

      <View className="mt-3 flex-row gap-2">
        {review.status !== 'visible' ? (
          <Pressable
            onPress={() => moderate.mutate({ id: review.id, status: 'visible' })}
            disabled={moderate.isPending}
            className="flex-1 items-center justify-center rounded-lg bg-green-700 px-3 py-2"
          >
            <Text className="text-xs font-semibold text-white">Restore</Text>
          </Pressable>
        ) : null}
        {review.status !== 'removed' ? (
          <Pressable
            onPress={() => moderate.mutate({ id: review.id, status: 'removed' })}
            disabled={moderate.isPending}
            className="flex-1 items-center justify-center rounded-lg bg-red-700 px-3 py-2"
          >
            <Text className="text-xs font-semibold text-white">Remove</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: Review['status'] }) {
  const p: Record<Review['status'], { bg: string; fg: string; label: string }> = {
    visible: {
      bg: 'bg-green-100 dark:bg-green-900/40',
      fg: 'text-green-700 dark:text-green-300',
      label: 'Visible',
    },
    flagged: {
      bg: 'bg-amber-100 dark:bg-amber-900/40',
      fg: 'text-amber-700 dark:text-amber-300',
      label: 'Flagged',
    },
    removed: {
      bg: 'bg-red-100 dark:bg-red-900/40',
      fg: 'text-red-700 dark:text-red-300',
      label: 'Removed',
    },
  };
  return (
    <View className={`rounded-full px-2.5 py-1 ${p[status].bg}`}>
      <Text className={`text-xs font-semibold ${p[status].fg}`}>{p[status].label}</Text>
    </View>
  );
}
