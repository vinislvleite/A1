import React from 'react';
import { useRouter } from 'expo-router';
import { LoginScreen } from '@/screens/LoginScreen';

export default function LoginRoute() {
  const router = useRouter();

  return (
    <LoginScreen
      onLoginSuccess={() => {
        router.replace('/');
      }}
    />
  );
}
