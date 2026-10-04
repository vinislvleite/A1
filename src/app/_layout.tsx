if (typeof (globalThis as { setImmediate?: unknown }).setImmediate === 'undefined') {
  (globalThis as unknown as { setImmediate: (fn: (...args: unknown[]) => void, ...args: unknown[]) => number }).setImmediate = (
    fn: (...args: unknown[]) => void,
    ...args: unknown[]
  ) => setTimeout(fn, 0, ...args) as unknown as number;
}

import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { LogService } from '@/services/LogService';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    LogService.getInstance().purgeOldLogs(15);
  }, []);

  return (
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
        <Stack.Screen name="transfer" />
        <Stack.Screen name="budgets" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="transaction-detail" />
        <Stack.Screen name="data-cleanup" />
        <Stack.Screen name="privacy-policy" />
      </Stack>


    </ThemeProvider>
  );
}
