import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';

/** Keep in sync with `AuthGateWithClerk` in `app/_layout.tsx`. */
export const CLERK_UI_READY_TIMEOUT_MS = 10_000;

/**
 * Clerk `isLoaded` can stay false on native while AuthGate already showed the app (timeout path).
 * `uiReady` matches that gate so landing + OAuth are not stuck waiting forever.
 */
export function useClerkUiReady() {
  const auth = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (auth.isLoaded) {
      setTimedOut(false);
      return;
    }
    const timeout = setTimeout(() => {
      console.warn('[useClerkUiReady] Clerk isLoaded timeout — enabling auth UI');
      setTimedOut(true);
    }, CLERK_UI_READY_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [auth.isLoaded]);

  const uiReady = auth.isLoaded || timedOut;
  const clerkTimedOut = timedOut && !auth.isLoaded;

  return {
    ...auth,
    uiReady,
    clerkTimedOut,
  };
}
