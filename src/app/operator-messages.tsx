import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { useRequireOperator } from '@/lib/auth-gates';
import {
  useMarkMessageRead,
  useReceivedMessages,
  type OperatorMessage,
} from '@/lib/queries/operator-messages';

/**
 * Operator's inbox of messages from admin / management. When the screen
 * opens we mark every unread message read in a single batch — the UI is
 * simple enough that explicit per-message dismiss adds no value.
 */
export default function OperatorMessagesInbox() {
  const gate = useRequireOperator();
  const messages = useReceivedMessages();
  const markRead = useMarkMessageRead();

  // Mark all currently-loaded unread messages as read once the list resolves.
  useEffect(() => {
    if (!messages.data) return;
    const unread = messages.data.filter((m) => !m.read_at);
    if (unread.length === 0) return;
    unread.forEach((m) => markRead.mutate(m.id));
    // markRead is stable across renders; not in deps to avoid re-firing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.data]);

  if (gate) return gate;

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Messages' }} />

      {messages.isLoading ? (
        <ActivityIndicator className="mt-4" />
      ) : (messages.data ?? []).length === 0 ? (
        <Text className="mt-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No messages from admin yet.
        </Text>
      ) : (
        (messages.data ?? []).map((m) => <MessageCard key={m.id} message={m} />)
      )}
    </ScrollView>
  );
}

function MessageCard({ message }: { message: OperatorMessage }) {
  const date = new Date(message.created_at).toLocaleString();
  const wasUnread = !message.read_at;
  return (
    <View
      className={`rounded-xl border p-3 ${
        wasUnread
          ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950'
          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950'
      }`}
    >
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {message.subject ?? '(no subject)'}
        </Text>
        {wasUnread ? (
          <View className="rounded-full bg-blue-600 px-2 py-0.5">
            <Text className="text-[10px] font-semibold text-white">New</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">{date}</Text>
      <Text className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {message.body}
      </Text>
    </View>
  );
}
