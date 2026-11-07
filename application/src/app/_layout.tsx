import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { initAuth, refreshUser } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  const t = useT();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
      }),
  );

  // Load the saved login, then re-check the account (Premium status) whenever the app comes back.
  useEffect(() => {
    initAuth();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshUser();
    });
    return () => sub.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="filtres" options={{ title: t('screen.filters'), presentation: 'modal' }} />
        <Stack.Screen name="consultation/[id]" options={{ title: t('screen.consultation') }} />
        <Stack.Screen name="pdf" options={{ title: t('screen.document') }} />
        <Stack.Screen name="connexion" options={{ title: t('screen.login') }} />
        <Stack.Screen name="inscription" options={{ title: t('screen.register') }} />
        <Stack.Screen name="mot-de-passe" options={{ title: t('screen.forgot') }} />
        <Stack.Screen name="premium" options={{ title: t('screen.premium') }} />
        <Stack.Screen name="compte" options={{ title: t('screen.account') }} />
      </Stack>
    </QueryClientProvider>
  );
}
