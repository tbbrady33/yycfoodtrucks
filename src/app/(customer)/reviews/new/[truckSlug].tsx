import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { useTruckBySlug } from '@/lib/queries/trucks';
import { useMyReview, useUpsertReview } from '@/lib/queries/reviews';

/**
 * Write/edit your review of a truck.
 *
 * - Loads any existing review the user already wrote (one per user per
 *   truck — enforced by UNIQUE (truck_id, author_id)) and pre-fills the
 *   form so this screen is both "Write" and "Edit".
 * - Submission upserts the row; the body is optional, rating is required.
 * - On success: back to the truck profile.
 */
export default function WriteReview() {
  const { truckSlug } = useLocalSearchParams<{ truckSlug: string }>();
  const truck = useTruckBySlug(truckSlug);
  const mine = useMyReview(truck.data?.id);
  const upsert = useUpsertReview();

  const [rating, setRating] = useState<number>(0);
  const [body, setBody] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);

  // Hydrate the form once the existing-review query resolves.
  useEffect(() => {
    if (mine.data) {
      setRating(mine.data.rating);
      setBody(mine.data.body ?? '');
    }
  }, [mine.data]);

  const onSubmit = async () => {
    setServerError(null);
    if (!truck.data) return;
    if (rating < 1 || rating > 5) {
      setServerError('Pick a rating.');
      return;
    }
    try {
      await upsert.mutateAsync({
        truckId: truck.data.id,
        rating,
        body: body.trim() ? body.trim() : null,
      });
      router.back();
    } catch (e) {
      setServerError(String(e));
    }
  };

  if (truck.isLoading || mine.isLoading) {
    return (
      <View className="flex-1 bg-white dark:bg-black">
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <ActivityIndicator className="mt-8" />
      </View>
    );
  }

  if (!truck.data) {
    return (
      <View className="flex-1 bg-white dark:bg-black">
        <Stack.Screen options={{ headerShown: true, title: 'Not found' }} />
        <Text className="mx-4 mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          Truck not found.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ padding: 16 }}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: mine.data ? 'Edit your review' : 'Write a review',
        }}
      />

      <Text className="text-base text-neutral-700 dark:text-neutral-300">
        Reviewing {truck.data.name}
      </Text>

      <Text className="mt-6 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Rating
      </Text>
      <View className="mt-2 flex-row gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setRating(n)}
            className={`h-12 w-12 items-center justify-center rounded-full ${
              n <= rating
                ? 'bg-amber-400'
                : 'bg-neutral-200 dark:bg-neutral-800'
            }`}
          >
            <Text className="text-lg">★</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mt-6 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        What did you think? (optional)
      </Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        placeholder="Optional comment…"
        placeholderTextColor="#9ca3af"
        className="mt-2 min-h-[120px] rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 text-base text-neutral-900 dark:text-neutral-100"
      />

      {serverError ? (
        <Text className="mt-4 text-sm text-red-600 dark:text-red-400">{serverError}</Text>
      ) : null}

      <Pressable
        onPress={onSubmit}
        disabled={upsert.isPending}
        className={`mt-6 items-center justify-center rounded-lg bg-neutral-900 px-4 py-3 ${
          upsert.isPending ? 'opacity-60' : ''
        }`}
      >
        {upsert.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-base font-semibold text-white">
            {mine.data ? 'Save changes' : 'Post review'}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
