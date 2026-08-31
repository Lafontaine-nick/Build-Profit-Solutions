import { useOAuth } from '@clerk/clerk-expo';
import { useClerk } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useClerkUiReady } from '@/hooks/useClerkUiReady';
import { isClerkPublishableKeyConfigured } from '@/lib/clerkPublishableKey';

/** Brief guard so OAuth hooks mount; don't wait for full Clerk `isLoaded` (can take ~10s). */
const OAUTH_WARMUP_MS = 600;

/** Matches `RootLayout` / `auth.tsx` — must not rely on `Constants.expoConfig.extra` alone (web). */
export function isClerkConfigured(): boolean {
  return isClerkPublishableKeyConfigured();
}

/**
 * Custom hook to use Clerk OAuth
 * 
 * IMPORTANT: Hooks must be called unconditionally.
 * 
 * This hook will:
 * - Always call Clerk hooks (React requirement)
 * - If Clerk is configured: We're in ClerkProvider (from _layout.tsx), so hooks work ✅
 * - If Clerk is NOT configured: We're NOT in ClerkProvider, hooks will throw ❌
 * 
 * To avoid errors when Clerk isn't configured, only use this hook in components
 * that are conditionally rendered when Clerk is configured, OR ensure Clerk is set up.
 */
export function useClerkOAuth() {
  const isClerkEnabled = isClerkConfigured();
  const googleOAuth = useOAuth({ strategy: 'oauth_google' });
  const appleOAuth = useOAuth({ strategy: 'oauth_apple' });
  const { isLoaded: authLoaded, uiReady } = useClerkUiReady();
  const clerk = useClerk();
  const clerkSetActive = clerk?.setActive;
  const [warmupReady, setWarmupReady] = useState(false);

  useEffect(() => {
    if (uiReady) {
      setWarmupReady(true);
      return;
    }
    const timer = setTimeout(() => setWarmupReady(true), OAUTH_WARMUP_MS);
    return () => clearTimeout(timer);
  }, [uiReady]);

  const hasGoogleFlow =
    !!googleOAuth && typeof googleOAuth.startOAuthFlow === 'function';
  const hasAppleFlow =
    !!appleOAuth && typeof appleOAuth.startOAuthFlow === 'function';

  /** OAuth can run once hooks are mounted — short warmup only, not full AuthGate timeout. */
  const oauthReady =
    isClerkEnabled && hasGoogleFlow && (uiReady || warmupReady);

  if (__DEV__) {
    console.log('useClerkOAuth - Hook called:', {
      isClerkEnabled,
      oauthReady,
      authLoaded,
      uiReady,
      warmupReady,
      hasGoogleFlow,
      hasAppleFlow,
      hasClerkSetActive: !!clerkSetActive,
    });
  }

  return {
    googleOAuth: isClerkEnabled ? googleOAuth : null,
    appleOAuth: isClerkEnabled ? appleOAuth : null,
    clerkSetActive: isClerkEnabled ? clerkSetActive : null,
    useClerk: isClerkEnabled,
    oauthReady,
    oauthWaiting: false,
  };
}

