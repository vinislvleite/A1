import React from 'react';
import { useRouter } from 'expo-router';
import { LoginScreen } from '@/screens/LoginScreen';

//ShiroFofo

export default function IndexScreen() {
  const router = useRouter();

  return (
    <LoginScreen
      onLoginSuccess={() => {
        router.push('/home' as unknown as Parameters<typeof router.push>[0]);
      }}
    />
  );
}
