import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
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
  const status = useAuth((s) => s.status);
  const signedIn = status === 'signedIn';

  useEffect(() => {
    void useAuth.getState().restore();
  }, []);

  // A new account must never see the previous account's cached data.
  useEffect(() => {
    if (status === 'signedOut') queryClient.clear();
  }, [status, queryClient]);

  // Reading the saved session takes a moment at start-up.
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Loading />
      </View>
    );
  }

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
        {/* Signed out: only the login / create-account screen exists. */}
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>

        {/* Signed in: the whole app. */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="filtres" options={{ title: t('screen.filters'), presentation: 'modal' }} />
          <Stack.Screen name="consultation/[id]" options={{ title: t('screen.consultation') }} />
          <Stack.Screen name="pdf" options={{ title: t('screen.document') }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
