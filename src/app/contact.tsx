import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useSubmitContactRequest } from '@/lib/queries/contact';
import { useSession } from '@/lib/session';

/**
 * Contact / booking request. Routes ALL messages through YYC Food Trucks
 * management per brief — there's no path that exposes the truck operator's
 * direct contact info.
 *
 * Anon-safe: RLS allows inserts with submitter_id = null. Signed-in users
 * get their submitter_id stamped automatically.
 *
 * Optional `truckId` query param prefills the "About truck" field when the
 * user lands here from a truck profile.
 */
const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(10, 'Add a bit more detail (at least 10 characters)'),
});
type Form = z.infer<typeof schema>;

export default function ContactScreen() {
  const { user } = useSession();
  const { truckId } = useLocalSearchParams<{ truckId?: string }>();
  const submit = useSubmitContactRequest();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: user?.email ?? '',
      phone: '',
      subject: '',
      message: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await submit.mutateAsync({ ...values, truckId: truckId ?? null });
      setDone(true);
    } catch (e) {
      setServerError(String(e));
    }
  });

  if (done) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black px-6">
        <Stack.Screen options={{ headerShown: true, title: 'Sent' }} />
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Thanks!
        </Text>
        <Text className="mt-2 text-center text-base text-neutral-500 dark:text-neutral-400">
          Your message is with YYC Food Trucks management.
          {user ? ' You can track its status from your inbox.' : ''}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-8 rounded-lg bg-neutral-900 px-4 py-3"
        >
          <Text className="text-base font-semibold text-white">Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Contact us' }} />

      <Text className="text-sm text-neutral-500 dark:text-neutral-400">
        Questions, booking requests, or feedback go to YYC Food Trucks
        management. We'll get back to you.
      </Text>

      <View className="mt-6 gap-4">
        <Field label="Your name" error={errors.name?.message}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
        </Field>

        <Field label="Email" error={errors.email?.message}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Input
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                autoComplete="email"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            )}
          />
        </Field>

        <Field label="Phone (optional)" error={errors.phone?.message}>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Input
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                keyboardType="phone-pad"
              />
            )}
          />
        </Field>

        <Field label="Subject (optional)" error={errors.subject?.message}>
          <Controller
            control={control}
            name="subject"
            render={({ field }) => (
              <Input value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
        </Field>

        <Field label="Message" error={errors.message?.message}>
          <Controller
            control={control}
            name="message"
            render={({ field }) => (
              <TextInput
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                placeholder="Tell us what's going on…"
                placeholderTextColor="#9ca3af"
                className="min-h-[120px] rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 text-base text-neutral-900 dark:text-neutral-100"
              />
            )}
          />
        </Field>

        {serverError ? (
          <Text className="text-sm text-red-600 dark:text-red-400">{serverError}</Text>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={submit.isPending}
          className={`mt-2 items-center justify-center rounded-lg bg-neutral-900 px-4 py-3 ${
            submit.isPending ? 'opacity-60' : ''
          }`}
        >
          {submit.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-white">Send</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </Text>
      {children}
      {error ? <Text className="text-xs text-red-600 dark:text-red-400">{error}</Text> : null}
    </View>
  );
}

function Input({
  value,
  onChange,
  onBlur,
  autoCapitalize,
  autoComplete,
  keyboardType,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'email' | 'name' | 'tel' | 'off';
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onBlur={onBlur}
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      keyboardType={keyboardType}
      placeholderTextColor="#9ca3af"
      className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 text-base text-neutral-900 dark:text-neutral-100"
    />
  );
}
