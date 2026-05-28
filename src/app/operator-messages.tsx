import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';

import { useRequireOperator } from '@/lib/auth-gates';
import { useSession } from '@/lib/session';
import {
  useMarkMessageRead,
  useMyMessages,
  useSendOperatorMessage,
  type OperatorMessage,
} from '@/lib/queries/operator-messages';

/**
 * Messages thread for the signed-in user (operator or admin).
 *
 * Shows ALL messages they're in: received cards have a Reply form;
 * sent cards are read-only with a "Sent" label so the user has confirmation
 * their message went through.
 *
 * Auto-marks every unread received message as read on first render —
 * simple enough to skip per-message dismiss for now.
 */
export default function MessagesThread() {
  const gate = useRequireOperator();
  const { user } = useSession();
  const messages = useMyMessages();
  const markRead = useMarkMessageRead();

  useEffect(() => {
    if (!messages.data || !user) return;
    const unread = messages.data.filter(
      (m) => m.recipient_id === user.id && !m.read_at
    );
    if (unread.length === 0) return;
    unread.forEach((m) => markRead.mutate(m.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.data, user?.id]);

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
          No messages yet.
        </Text>
      ) : (
        (messages.data ?? []).map((m) => (
          <MessageCard
            key={m.id}
            message={m}
            mine={!!user && m.sender_id === user.id}
          />
        ))
      )}
    </ScrollView>
  );
}

function MessageCard({ message, mine }: { message: OperatorMessage; mine: boolean }) {
  const date = new Date(message.created_at).toLocaleString();
  const wasUnread = !mine && !message.read_at;
  const [replying, setReplying] = useState(false);

  return (
    <View
      className={`rounded-xl border p-3 ${
        wasUnread
          ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950'
          : mine
            ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900'
            : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950'
      }`}
    >
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {message.subject ?? '(no subject)'}
        </Text>
        <DirectionBadge mine={mine} unread={wasUnread} />
      </View>
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">{date}</Text>
      <Text className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {message.body}
      </Text>

      {/* Reply only on received messages with a real sender to reply to. */}
      {!mine && message.sender_id ? (
        <View className="mt-3">
          <Pressable onPress={() => setReplying((v) => !v)}>
            <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {replying ? 'Cancel reply' : 'Reply'}
            </Text>
          </Pressable>
          {replying ? (
            <ReplyForm
              originalSubject={message.subject}
              recipientId={message.sender_id}
              onDone={() => setReplying(false)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ReplyForm({
  originalSubject,
  recipientId,
  onDone,
}: {
  originalSubject: string | null;
  recipientId: string;
  onDone: () => void;
}) {
  const [subject, setSubject] = useState(
    originalSubject && !originalSubject.toLowerCase().startsWith('re:')
      ? `Re: ${originalSubject}`
      : (originalSubject ?? '')
  );
  const [body, setBody] = useState('');
  const send = useSendOperatorMessage();

  const onSend = async () => {
    if (!body.trim()) {
      Alert.alert('Reply body required');
      return;
    }
    try {
      await send.mutateAsync({
        recipientId,
        subject: subject.trim() || null,
        body: body.trim(),
      });
      setBody('');
      onDone();
    } catch (e) {
      Alert.alert('Send failed', String(e));
    }
  };

  return (
    <View className="mt-2 gap-2 border-t border-neutral-100 dark:border-neutral-900 pt-2">
      <TextInput
        value={subject}
        onChangeText={setSubject}
        placeholder="Subject (optional)"
        placeholderTextColor="#9ca3af"
        className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Your reply…"
        placeholderTextColor="#9ca3af"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        className="min-h-[80px] rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
      />
      <Pressable
        onPress={onSend}
        disabled={send.isPending}
        className={`items-center justify-center rounded-lg bg-neutral-900 px-3 py-2 ${
          send.isPending ? 'opacity-60' : ''
        }`}
      >
        {send.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-sm font-semibold text-white">Send reply</Text>
        )}
      </Pressable>
    </View>
  );
}

function DirectionBadge({ mine, unread }: { mine: boolean; unread: boolean }) {
  if (mine) {
    return (
      <View className="rounded-full bg-neutral-300 dark:bg-neutral-700 px-2 py-0.5">
        <Text className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-200">
          Sent
        </Text>
      </View>
    );
  }
  if (unread) {
    return (
      <View className="rounded-full bg-blue-600 px-2 py-0.5">
        <Text className="text-[10px] font-semibold text-white">New</Text>
      </View>
    );
  }
  return null;
}
