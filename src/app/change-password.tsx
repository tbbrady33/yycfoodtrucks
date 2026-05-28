import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';

const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });
type Form = z.infer<typeof schema>;

/**
 * Force-change-password screen — shown to operators (and anyone else) whose
 * profiles row has must_change_password=true. AuthRedirect routes here.
 *
 * On success: update the auth password, clear the flag on profiles, and
 * invalidate the profile query so AuthRedirect lets them out of this screen.
 */
export default function ChangePassword() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    if (!user) {
      setServerError('Not signed in.');
      return;
    }
    setServerError(null);

    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      setServerError(updErr.message);
      return;
    }

    const { error: profErr } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id);
    if (profErr) {
      setServerError(profErr.message);
      return;
    }

    await qc.invalidateQueries({ queryKey: ['profile', user.id] });
    router.replace('/');
  });

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top']}>
      <View className="flex-1 px-6 pt-10">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          Set a new password
        </Text>
        <Text className="mt-1 text-base text-neutral-500 dark:text-neutral-400">
          Your admin created this account with a temporary password. Pick one
          you'll remember.
        </Text>

        <View className="mt-8 gap-4">
          <Field label="New password" error={errors.password?.message}>
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <TextInput
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 text-base text-neutral-900 dark:text-neutral-100"
                />
              )}
            />
          </Field>

          <Field label="Confirm password" error={errors.confirm?.message}>
            <Controller
              control={control}
              name="confirm"
              render={({ field }) => (
                <TextInput
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 text-base text-neutral-900 dark:text-neutral-100"
                />
              )}
            />
          </Field>

          {serverError ? (
            <Text className="text-sm text-red-600 dark:text-red-400">{serverError}</Text>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={isSubmitting}
            className={`mt-2 items-center justify-center rounded-lg bg-neutral-900 px-4 py-3 ${
              isSubmitting ? 'opacity-60' : ''
            }`}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-semibold text-white">Update password</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
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
