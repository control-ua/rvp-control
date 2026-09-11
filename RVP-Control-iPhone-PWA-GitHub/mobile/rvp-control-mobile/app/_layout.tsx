import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/auth';
import { theme } from '@/constants/theme';
import type { AdminUser } from '@/types';

export default function RootLayout() {
  const [admin, setAdmin] = useState<AdminUser | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const current = await getCurrentAdmin();
      setAdmin(current);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async () => {
      const current = await getCurrentAdmin();
      setAdmin(current);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (admin === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.textMuted, marginTop: 12, fontSize: 14 }}>Завантаження…</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
        {admin ? (
          <Stack.Screen name="(tabs)" />
        ) : (
          <Stack.Screen name="login" />
        )}
        <Stack.Screen name="application/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
