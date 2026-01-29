import React from 'react';
import { Stack } from 'expo-router';
import PaymentManagementModal from '@/components/PaymentManagementModal';

export default function ManageSubscriptionsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PaymentManagementModal mode='screen' />
    </>
  );
}


