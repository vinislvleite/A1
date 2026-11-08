import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CategoryHistoryScreen } from '@/screens/CategoryHistoryScreen';

export default function CategoryHistoryRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <CategoryHistoryScreen id={params.id ?? ''} />;
}
