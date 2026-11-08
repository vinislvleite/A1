if (typeof (globalThis as { setImmediate?: unknown }).setImmediate === 'undefined') {
  (globalThis as unknown as { setImmediate: (fn: (...args: unknown[]) => void, ...args: unknown[]) => number }).setImmediate = (
    fn: (...args: unknown[]) => void,
    ...args: unknown[]
  ) => setTimeout(fn, 0, ...args) as unknown as number;
}

import React, { useEffect } from 'react';
import { DarkTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { LogService } from '@/services/LogService';
import { seedDemoUser } from '@/data/database/seed';
import { PrivacyProvider } from '@/context/PrivacyContext';

SplashScreen.preventAutoHideAsync();

(async () => {
  try {
    await seedDemoUser();
    await LogService.getInstance().purgeOldLogs(15);
  } catch {}
})();

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      try {
        await seedDemoUser();
        await LogService.getInstance().purgeOldLogs(15);
      } catch {}
    })();
  }, []);

  return (
    <PrivacyProvider>
      <ThemeProvider value={DarkTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="home" />
          <Stack.Screen name="login" />
          <Stack.Screen name="starter-home" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="transaction-form" />
          <Stack.Screen name="transactions-list" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="account" />
          <Stack.Screen name="accounts" />
          <Stack.Screen name="account-form" />
          <Stack.Screen name="card-detail" />
          <Stack.Screen name="statement" />
          <Stack.Screen name="transfer" />
          <Stack.Screen name="budgets" />
          <Stack.Screen name="zero-based-budget" />
          <Stack.Screen name="events" />
          <Stack.Screen name="spending-limits" />
          <Stack.Screen name="spending-goals" />
          <Stack.Screen name="bills" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="backup" />
          <Stack.Screen name="categories" />
          <Stack.Screen name="category-history" />
          <Stack.Screen name="transaction-detail" />
          <Stack.Screen name="data-cleanup" />
          <Stack.Screen name="privacy-policy" />
          <Stack.Screen name="delete-transaction" />
        </Stack>
      </ThemeProvider>
    </PrivacyProvider>
  );
}
