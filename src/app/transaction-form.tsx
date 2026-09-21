import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TransactionFormScreen } from '@/screens/TransactionFormScreen';

export default function TransactionFormRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  return <TransactionFormScreen id={params.id} />;
}
