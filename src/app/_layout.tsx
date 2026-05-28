import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { SessionProvider } from '@/lib/session';
import { AuthRedirect } from '@/components/auth-redirect';

import '@/global.css';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const queryClient = useMemo(() => new QueryClient(), []);
  const mode = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <GluestackUIProvider mode={mode}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthRedirect />
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </SessionProvider>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
