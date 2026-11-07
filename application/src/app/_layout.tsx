import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
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
      </Stack>
    </QueryClientProvider>
  );
}
