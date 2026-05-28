import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';

import { StatusPill } from '@/components/truck-card';
import { useSession } from '@/lib/session';
import { useTruckBySlug } from '@/lib/queries/trucks';
import { useTruckMenu } from '@/lib/queries/menu';
import {
  useTruckSchedule,
  type DatedSlot,
  type TemplateSlot,
} from '@/lib/queries/schedule';
import { useFollow, useIsFollowing, useUnfollow } from '@/lib/queries/follows';
import { useFlagReview, useMyReview, useTruckReviews, type Review } from '@/lib/queries/reviews';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TruckProfile() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const truck = useTruckBySlug(slug);
  const menu = useTruckMenu(truck.data?.id);
  const schedule = useTruckSchedule(truck.data?.id);
  const reviews = useTruckReviews(truck.data?.id);

  const groupedTemplate = useMemo(
    () => groupTemplateByDay(schedule.data?.template ?? []),
    [schedule.data?.template]
  );

  if (truck.isLoading) {
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
          We couldn't find that truck.
        </Text>
      </View>
    );
  }

  const t = truck.data;
  const open = t.status === 'open';

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Stack.Screen options={{ headerShown: true, title: t.name }} />

      <View className="px-6 pt-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {t.name}
            </Text>
            <Text className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              {t.category_name}
            </Text>
          </View>
          <StatusPill open={open} />
        </View>
        {t.review_count > 0 ? (
          <Text className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            ★ {t.avg_rating.toFixed(1)} · {t.review_count} review
            {t.review_count === 1 ? '' : 's'}
          </Text>
        ) : null}
        {t.description ? (
          <Text className="mt-3 text-base text-neutral-700 dark:text-neutral-300">
            {t.description}
          </Text>
        ) : null}

        <View className="mt-4 flex-row gap-2">
          <FavoriteButton truckId={t.id} />
          <Link href={{ pathname: '/contact', params: { truckId: t.id } }} asChild>
            <Pressable className="flex-1 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2.5">
              <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Contact
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <Section title="Menu">
        {menu.isLoading ? (
          <ActivityIndicator />
        ) : (menu.data ?? []).length === 0 ? (
          <Empty>Menu not posted yet.</Empty>
        ) : (
          <View className="gap-2">
            {menu.data!.map((item) => (
              <View
                key={item.id}
                className="flex-row items-baseline justify-between border-b border-neutral-100 dark:border-neutral-900 pb-2"
              >
                <Text className="flex-1 text-base text-neutral-900 dark:text-neutral-100">
                  {item.name}
                </Text>
                <Text className="text-base font-medium text-neutral-700 dark:text-neutral-300">
                  {formatPrice(item.price_cents)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="Weekly schedule">
        {schedule.isLoading ? (
          <ActivityIndicator />
        ) : groupedTemplate.every((d) => d.slots.length === 0) ? (
          <Empty>No published schedule yet.</Empty>
        ) : (
          <View className="gap-3">
            {groupedTemplate.map(({ day, slots }) =>
              slots.length === 0 ? null : (
                <View key={day}>
                  <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    {DAY_NAMES[day]}
                  </Text>
                  <View className="mt-1 gap-1">
                    {slots.map((s) => (
                      <Text
                        key={s.id}
                        className="text-sm text-neutral-600 dark:text-neutral-400"
                      >
                        {formatTime(s.start_time)} – {formatTime(s.end_time)} ·{' '}
                        {s.location_label}
                      </Text>
                    ))}
                  </View>
                </View>
              )
            )}
          </View>
        )}
      </Section>

      {(schedule.data?.dated ?? []).length > 0 ? (
        <Section title="Upcoming exceptions">
          <View className="gap-2">
            {schedule.data!.dated.map((d) => (
              <ExceptionRow key={d.id} slot={d} />
            ))}
          </View>
        </Section>
      ) : null}

      <ReviewsSection truckId={t.id} truckSlug={t.slug} reviews={reviews.data ?? []} loading={reviews.isLoading} />
    </ScrollView>
  );
}

function FavoriteButton({ truckId }: { truckId: string }) {
  const { user } = useSession();
  const isFollowing = useIsFollowing(truckId);
  const follow = useFollow();
  const unfollow = useUnfollow();

  if (!user) {
    return (
      <Link href="/sign-in" asChild>
        <Pressable className="flex-1 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2.5">
          <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Sign in to favorite
          </Text>
        </Pressable>
      </Link>
    );
  }

  const pending = follow.isPending || unfollow.isPending;
  const onPress = () =>
    isFollowing ? unfollow.mutate(truckId) : follow.mutate(truckId);

  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      className={`flex-1 items-center justify-center rounded-lg px-4 py-2.5 ${
        isFollowing
          ? 'bg-amber-100 dark:bg-amber-900/40'
          : 'bg-neutral-900 dark:bg-neutral-100'
      } ${pending ? 'opacity-60' : ''}`}
    >
      <Text
        className={`text-sm font-semibold ${
          isFollowing
            ? 'text-amber-800 dark:text-amber-300'
            : 'text-white dark:text-neutral-900'
        }`}
      >
        {isFollowing ? '★ Favorited' : 'Add to favorites'}
      </Text>
    </Pressable>
  );
}

function ReviewsSection({
  truckId,
  truckSlug,
  reviews,
  loading,
}: {
  truckId: string;
  truckSlug: string;
  reviews: Review[];
  loading: boolean;
}) {
  const { user } = useSession();
  const mine = useMyReview(truckId).data;

  return (
    <Section title="Reviews">
      {loading ? (
        <ActivityIndicator />
      ) : reviews.length === 0 ? (
        <Empty>No reviews yet — be the first.</Empty>
      ) : (
        <View className="gap-3">
          {reviews.map((r) => (
            <ReviewRow key={r.id} review={r} isMine={!!user && r.author_id === user.id} />
          ))}
        </View>
      )}

      {user ? (
        <Link href={`/reviews/new/${truckSlug}`} asChild>
          <Pressable className="mt-4 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3">
            <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {mine ? 'Edit your review' : 'Write a review'}
            </Text>
          </Pressable>
        </Link>
      ) : (
        <Link href="/sign-in" asChild>
          <Pressable className="mt-4 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3">
            <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Sign in to review
            </Text>
          </Pressable>
        </Link>
      )}
    </Section>
  );
}

function ReviewRow({ review, isMine }: { review: Review; isMine: boolean }) {
  const flag = useFlagReview();
  const date = new Date(review.created_at).toLocaleDateString();

  const onFlag = () => {
    Alert.alert(
      'Flag this review?',
      'Reviews you flag go to admins for moderation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Flag',
          style: 'destructive',
          onPress: () => flag.mutate({ reviewId: review.id, reason: null }),
        },
      ]
    );
  };

  return (
    <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="text-base font-semibold text-amber-600 dark:text-amber-400">
          {'★'.repeat(review.rating)}
          <Text className="text-neutral-300 dark:text-neutral-700">
            {'★'.repeat(5 - review.rating)}
          </Text>
        </Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">{date}</Text>
      </View>
      {review.body ? (
        <Text className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          {review.body}
        </Text>
      ) : null}
      <View className="mt-2 flex-row items-center justify-between">
        {isMine ? (
          <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Your review{review.status !== 'visible' ? ` · ${review.status}` : ''}
          </Text>
        ) : (
          <View />
        )}
        {!isMine ? (
          <Pressable onPress={onFlag} disabled={flag.isPending}>
            <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {flag.isSuccess ? 'Flagged' : 'Flag'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6 px-6">
      <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </Text>
      <View className="mt-3">{children}</View>
    </View>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-sm text-neutral-500 dark:text-neutral-400">{children}</Text>
  );
}

function ExceptionRow({ slot }: { slot: DatedSlot }) {
  const labels: Record<DatedSlot['kind'], string> = {
    addition: 'Extra slot',
    closure: 'Closed',
    replacement: 'Moved',
  };
  return (
    <View>
      <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        {formatDate(slot.slot_date)} · {labels[slot.kind]}
      </Text>
      <Text className="text-sm text-neutral-600 dark:text-neutral-400">
        {formatTime(slot.start_time)} – {formatTime(slot.end_time)} · {slot.location_label}
      </Text>
    </View>
  );
}

function groupTemplateByDay(template: TemplateSlot[]) {
  const out = Array.from({ length: 7 }, (_, day) => ({ day, slots: [] as TemplateSlot[] }));
  for (const s of template) out[s.day_of_week]?.slots.push(s);
  return out;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(hms: string): string {
  const [hStr, mStr] = hms.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
