import React from 'react';
import { useUser } from '@clerk/clerk-react';
import { VendorDirectoryProvider } from '@/contexts/VendorDirectoryContext';

/** Bridges Clerk user id into VendorDirectoryProvider. Must render under ClerkProvider. */
export default function ClerkVendorDirectoryWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  return <VendorDirectoryProvider clerkUserId={user?.id ?? null}>{children}</VendorDirectoryProvider>;
}
