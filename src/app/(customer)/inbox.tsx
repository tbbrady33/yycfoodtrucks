import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { useMyContactRequests, type ContactRequest } from '@/lib/queries/contact';

export default function Inbox() {
  const { data, isLoading, error } = useMyContactRequests();

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Stack.Screen options={{ headerShown: true, title: 'Your contact requests' }} />

      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : error ? (
        <Text className="mx-4 mt-6 text-sm text-red-600 dark:text-red-400">
          Couldn't load requests: {String(error)}
        </Text>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <Text className="mx-4 mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              You haven't submitted any requests yet.
            </Text>
          }
          renderItem={({ item }) => <RequestRow request={item} />}
        />
      )}
    </View>
  );
}

function RequestRow({ request }: { request: ContactRequest }) {
  const date = new Date(request.created_at).toLocaleDateString();
  return (
    <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {request.subject ?? '(no subject)'}
        </Text>
        <StatusBadge status={request.status} />
      </View>
      <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{date}</Text>
      <Text
        numberOfLines={3}
        className="mt-2 text-sm text-neutral-700 dark:text-neutral-300"
      >
        {request.message}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: ContactRequest['status'] }) {
  const palette: Record<ContactRequest['status'], { bg: string; text: string; label: string }> = {
    new: {
      bg: 'bg-blue-100 dark:bg-blue-900/40',
      text: 'text-blue-700 dark:text-blue-300',
      label: 'New',
    },
    replied: {
      bg: 'bg-green-100 dark:bg-green-900/40',
      text: 'text-green-700 dark:text-green-300',
      label: 'Replied',
    },
    closed: {
      bg: 'bg-neutral-200 dark:bg-neutral-800',
      text: 'text-neutral-600 dark:text-neutral-400',
      label: 'Closed',
    },
  };
  const p = palette[status];
  return (
    <View className={`rounded-full px-2.5 py-1 ${p.bg}`}>
      <Text className={`text-xs font-semibold ${p.text}`}>{p.label}</Text>
    </View>
  );
}
