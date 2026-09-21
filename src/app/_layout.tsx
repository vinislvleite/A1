if (typeof (globalThis as { setImmediate?: unknown }).setImmediate === 'undefined') {
  (globalThis as unknown as { setImmediate: (fn: (...args: unknown[]) => void, ...args: unknown[]) => number }).setImmediate = (
    fn: (...args: unknown[]) => void,
    ...args: unknown[]
  ) => setTimeout(fn, 0, ...args) as unknown as number;
}

import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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
      </Stack>


    </ThemeProvider>
  );
}
