import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';

import { useRequireAdmin } from '@/lib/auth-gates';
import { useAllOperators, useInviteOperator, type InviteOperatorResult } from '@/lib/queries/admin';
import { useCategories } from '@/lib/queries/categories';
import { useSendOperatorMessage } from '@/lib/queries/operator-messages';

export default function Operators() {
  const gate = useRequireAdmin();
  const operators = useAllOperators();
  const categories = useCategories();
  const invite = useInviteOperator();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [truckName, setTruckName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [result, setResult] = useState<InviteOperatorResult | null>(null);

  if (gate) return gate;

  const onInvite = async () => {
    if (!email.trim()) {
      Alert.alert('Email required');
      return;
    }
    try {
      const r = await invite.mutateAsync({
        email: email.trim(),
        display_name: displayName.trim() || undefined,
        truck_name: truckName.trim() || undefined,
        category_id: truckName.trim() ? categoryId ?? undefined : undefined,
      });
      setResult(r);
      setEmail('');
      setDisplayName('');
      setTruckName('');
      setCategoryId(null);
    } catch (e) {
      Alert.alert('Invite failed', String(e));
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Operators' }} />

      {result ? <InviteResultCard result={result} onDismiss={() => setResult(null)} /> : null}

      <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 gap-2">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Invite a new operator
        </Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          A temporary password is generated and shown once. Share it with
          the operator out-of-band; they'll be forced to change it on
          first sign-in.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="operator@example.com"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
        />
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name (optional)"
          placeholderTextColor="#9ca3af"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
        />

        <Text className="mt-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Optional: also create an initial truck for them
        </Text>
        <TextInput
          value={truckName}
          onChangeText={setTruckName}
          placeholder="Truck name (e.g. Holy Crepe)"
          placeholderTextColor="#9ca3af"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
        />
        {truckName.trim() ? (
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Category</Text>
            <View className="mt-1 flex-row flex-wrap gap-2">
              {(categories.data ?? []).map((c) => {
                const selected = categoryId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategoryId(c.id)}
                    className={`rounded-full px-3 py-1 ${
                      selected
                        ? 'bg-neutral-900 dark:bg-neutral-100'
                        : 'border border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        selected
                          ? 'font-semibold text-white dark:text-neutral-900'
                          : 'text-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={onInvite}
          disabled={invite.isPending}
          className={`mt-2 items-center justify-center rounded-lg bg-neutral-900 px-4 py-2.5 ${
            invite.isPending ? 'opacity-60' : ''
          }`}
        >
          {invite.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-sm font-semibold text-white">Send invite</Text>
          )}
        </Pressable>
      </View>

      <View className="gap-2">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Existing operators
        </Text>
        {operators.isLoading ? (
          <ActivityIndicator />
        ) : (operators.data ?? []).length === 0 ? (
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            No operators yet.
          </Text>
        ) : (
          (operators.data ?? []).map((op) => <OperatorRow key={op.id} operator={op} />)
        )}
      </View>
    </ScrollView>
  );
}

function OperatorRow({
  operator,
}: {
  operator: { id: string; display_name: string | null; must_change_password: boolean; created_at: string };
}) {
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const send = useSendOperatorMessage();

  const onSend = async () => {
    if (!body.trim()) {
      Alert.alert('Message body required');
      return;
    }
    try {
      await send.mutateAsync({
        recipientId: operator.id,
        subject: subject.trim() || null,
        body: body.trim(),
      });
      setSubject('');
      setBody('');
      setComposing(false);
      Alert.alert('Sent');
    } catch (e) {
      Alert.alert('Send failed', String(e));
    }
  };

  return (
    <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
      <View className="flex-row items-baseline justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {operator.display_name ?? operator.id}
          </Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Joined {new Date(operator.created_at).toLocaleDateString()}
            {operator.must_change_password ? ' · awaiting first sign-in' : ''}
          </Text>
        </View>
        <Pressable onPress={() => setComposing((v) => !v)}>
          <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {composing ? 'Cancel' : 'Message'}
          </Text>
        </Pressable>
      </View>

      {composing ? (
        <View className="mt-3 gap-2 border-t border-neutral-100 dark:border-neutral-900 pt-3">
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
            placeholder="Message…"
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
              <Text className="text-sm font-semibold text-white">Send</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function InviteResultCard({
  result,
  onDismiss,
}: {
  result: InviteOperatorResult;
  onDismiss: () => void;
}) {
  return (
    <View className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-3 gap-1">
      <Text className="text-base font-semibold text-amber-900 dark:text-amber-200">
        Invite sent — capture the password now
      </Text>
      <Text className="text-xs text-amber-800 dark:text-amber-300">
        This is shown ONCE. Copy it and share with the operator over a
        secure channel.
      </Text>
      <Text className="mt-2 text-sm text-amber-900 dark:text-amber-200">
        Email: {result.email}
      </Text>
      <Text className="text-sm font-mono text-amber-900 dark:text-amber-200" selectable>
        Temp password: {result.temp_password}
      </Text>
      {result.warning ? (
        <Text className="mt-2 text-xs text-amber-800 dark:text-amber-300">
          ⚠ {result.warning}
        </Text>
      ) : null}
      <Pressable
        onPress={onDismiss}
        className="mt-3 items-center justify-center rounded-lg bg-amber-700 px-3 py-2"
      >
        <Text className="text-sm font-semibold text-white">I've copied it</Text>
      </Pressable>
    </View>
  );
}
