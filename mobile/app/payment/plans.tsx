import React from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import SubscriptionPlansModal from '@/components/SubscriptionPlansModal';

export default function PlansScreen() {
  const { required } = useLocalSearchParams<{ required?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: required !== '1' }} />
      <SubscriptionPlansModal mode='screen' required={required === '1'} />
    </>
  );
}




