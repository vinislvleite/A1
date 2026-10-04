import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TransactionDetailScreen } from '@/screens/TransactionDetailScreen';

export default function TransactionDetailRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <TransactionDetailScreen id={params.id ?? ''} />;
}
