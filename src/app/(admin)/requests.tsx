import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { useRequireAdmin } from '@/lib/auth-gates';
import {
  useAllContactRequests,
  useUpdateContactRequestStatus,
} from '@/lib/queries/admin';
import type { ContactRequest, ContactStatus } from '@/lib/queries/contact';

export default function AdminRequests() {
  const gate = useRequireAdmin();
  const requests = useAllContactRequests();
  const [filter, setFilter] = useState<ContactStatus | 'all'>('new');
  if (gate) return gate;

  const filtered = (requests.data ?? []).filter(
    (r) => filter === 'all' || r.status === filter
  );

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Contact requests' }} />

      <View className="flex-row gap-2">
        {(['new', 'replied', 'closed', 'all'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setFilter(s)}
            className={`flex-1 items-center rounded-full px-3 py-1.5 ${
              filter === s
                ? 'bg-neutral-900 dark:bg-neutral-100'
                : 'border border-neutral-300 dark:border-neutral-700'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                filter === s
                  ? 'text-white dark:text-neutral-900'
                  : 'text-neutral-900 dark:text-neutral-100'
              }`}
            >
              {s === 'all' ? 'All' : s[0]!.toUpperCase() + s.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {requests.isLoading ? (
        <ActivityIndicator className="mt-4" />
      ) : filtered.length === 0 ? (
        <Text className="mt-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No requests in this view.
        </Text>
      ) : (
        filtered.map((r) => <RequestCard key={r.id} request={r} />)
      )}
    </ScrollView>
  );
}

function RequestCard({ request }: { request: ContactRequest }) {
  const update = useUpdateContactRequestStatus();
  const date = new Date(request.created_at).toLocaleString();

  return (
    <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {request.subject ?? '(no subject)'}
        </Text>
        <StatusBadge status={request.status} />
      </View>
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">{date}</Text>

      <View className="mt-2 gap-0.5">
        <Text className="text-sm text-neutral-700 dark:text-neutral-300">
          {request.name} · {request.email}
          {request.phone ? ` · ${request.phone}` : ''}
        </Text>
        {request.truck_id ? (
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            About truck: {request.truck_id}
          </Text>
        ) : null}
        <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
          {request.message}
        </Text>
      </View>

      <View className="mt-3 flex-row gap-2">
        {request.status !== 'replied' ? (
          <Pressable
            onPress={() => update.mutate({ id: request.id, status: 'replied' })}
            disabled={update.isPending}
            className="flex-1 items-center justify-center rounded-lg bg-green-700 px-3 py-2"
          >
            <Text className="text-xs font-semibold text-white">Mark replied</Text>
          </Pressable>
        ) : null}
        {request.status !== 'closed' ? (
          <Pressable
            onPress={() => update.mutate({ id: request.id, status: 'closed' })}
            disabled={update.isPending}
            className="flex-1 items-center justify-center rounded-lg bg-neutral-700 px-3 py-2"
          >
            <Text className="text-xs font-semibold text-white">Close</Text>
          </Pressable>
        ) : null}
        {request.status !== 'new' ? (
          <Pressable
            onPress={() => update.mutate({ id: request.id, status: 'new' })}
            disabled={update.isPending}
            className="flex-1 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2"
          >
            <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              Re-open
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: ContactStatus }) {
  const p: Record<ContactStatus, { bg: string; fg: string; label: string }> = {
    new: { bg: 'bg-blue-100 dark:bg-blue-900/40', fg: 'text-blue-700 dark:text-blue-300', label: 'New' },
    replied: { bg: 'bg-green-100 dark:bg-green-900/40', fg: 'text-green-700 dark:text-green-300', label: 'Replied' },
    closed: { bg: 'bg-neutral-200 dark:bg-neutral-800', fg: 'text-neutral-600 dark:text-neutral-400', label: 'Closed' },
  };
  return (
    <View className={`rounded-full px-2.5 py-1 ${p[status].bg}`}>
      <Text className={`text-xs font-semibold ${p[status].fg}`}>{p[status].label}</Text>
    </View>
  );
}
