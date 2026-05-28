import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type SignInForm = z.infer<typeof schema>;

export default function SignIn() {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setServerError(error.message);
      return;
    }
    // The SessionProvider will pick up the new session and re-render.
    // AuthRedirect will route to /change-password if the profile says so;
    // otherwise drop the user back on the landing screen.
    router.replace('/');
  });

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top']}>
      <View className="flex-1 px-6 pt-10">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          Sign in
        </Text>
        <Text className="mt-1 text-base text-neutral-500 dark:text-neutral-400">
          Use the credentials your admin shared.
        </Text>

        <View className="mt-8 gap-4">
          <Field label="Email" error={errors.email?.message}>
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <TextInput
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                  className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 text-base text-neutral-900 dark:text-neutral-100"
                />
              )}
            />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <TextInput
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  secureTextEntry
                  autoComplete="current-password"
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
              <Text className="text-base font-semibold text-white">Sign in</Text>
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
