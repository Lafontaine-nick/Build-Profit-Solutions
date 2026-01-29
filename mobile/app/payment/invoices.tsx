import React from 'react';
import { Stack } from 'expo-router';
import InvoicesList from '@/components/InvoicesList';

export default function InvoicesScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <InvoicesList mode='screen' />
    </>
  );
}


