import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AccountFormScreen } from '@/screens/AccountFormScreen';

export default function AccountFormRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  return <AccountFormScreen id={params.id} />;
}
