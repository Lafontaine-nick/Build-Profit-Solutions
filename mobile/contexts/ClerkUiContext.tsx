import React, { createContext, useContext } from 'react';

/**
 * Mirrors the exact `useClerk` decision in `app/_layout.tsx` (same publishable key rules).
 * Landing and other UI must use this instead of re-reading Constants/env—on Metro web those can
 * disagree with what RootLayout actually mounted (Clerk vs legacy gate).
 */
type ClerkUiContextValue = { clerkEnabled: boolean };

const ClerkUiContext = createContext<ClerkUiContextValue>({ clerkEnabled: false });

export function ClerkUiProvider({
  clerkEnabled,
  children,
}: {
  clerkEnabled: boolean;
  children: React.ReactNode;
}) {
  return <ClerkUiContext.Provider value={{ clerkEnabled }}>{children}</ClerkUiContext.Provider>;
}

export function useClerkUiEnabled(): boolean {
  return useContext(ClerkUiContext).clerkEnabled;
}
