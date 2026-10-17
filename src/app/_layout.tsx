import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuthStore } from '@/lib/auth';
import { QUERY_CACHE_BUSTER, createAppPersister, createAppQueryClient } from '@/lib/queryClient';
import { initSentry } from '@/lib/sentry';
import { initStorage, kvAdapter } from '@/lib/storage';

SplashScreen.preventAutoHideAsync();
initSentry();

export default function RootLayout() {
  const [storageReady, setStorageReady] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    initStorage()
      .then(() => setStorageReady(true))
      .catch((e: unknown) => {
        console.error('storage init failed', e);
        setStorageReady(true);
      });
  }, []);

  const queryClient = useMemo(() => createAppQueryClient(), []);
  const persister = useMemo(
    () => (storageReady ? createAppPersister(kvAdapter) : null),
    [storageReady],
  );

  if (!storageReady || !persister) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            buster: QUERY_CACHE_BUSTER,
            maxAge: 1000 * 60 * 60 * 24 * 7,
          }}
        >
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </PersistQueryClientProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
