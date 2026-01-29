import React from 'react';
import { Stack } from 'expo-router';
import PaymentMethodsList from '@/components/PaymentMethodsList';

export default function ManageCardsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PaymentMethodsList mode='screen' />
    </>
  );
}


