import React from 'react';
import { Stack } from 'expo-router';
import SubscriptionPlansModal from '@/components/SubscriptionPlansModal';

export default function PlansScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SubscriptionPlansModal mode='screen' />
    </>
  );
}




