import React, { useEffect } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { clerkAuthService } from '@/services/clerkAuth';
import Constants from 'expo-constants';

/**
 * Hook to protect routes when Clerk is **disabled** — redirects via `clerkAuthService`.
 *
 * When Clerk is **enabled**, `AuthGateWithClerk` already gates the tree; tab screens must not
 * call `router.replace('/')` on transient `!isSignedIn` (common right after web OAuth → /dashboard).
 */
export function useRequireAuth() {
  const router = useRouter();

  const publishableKey =
    Constants.expoConfig?.extra?.clerkPublishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const useClerk = !!(
    publishableKey &&
    (publishableKey.startsWith('pk_live_') ||
      (publishableKey.startsWith('pk_test_') &&
        publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk'))
  );

  useEffect(() => {
    if (useClerk) return;
    const authState = clerkAuthService.getAuthState();
    if (!authState.isAuthenticated && !authState.loading) {
      if (__DEV__) console.log('useRequireAuth - Not authenticated on mount, redirecting to auth');
      router.replace('/');
    }
  }, [router, useClerk]);

  useFocusEffect(
    React.useCallback(() => {
      if (useClerk) {
        return undefined;
      }

      const checkAuth = () => {
        const authState = clerkAuthService.getAuthState();
        if (!authState.isAuthenticated && !authState.loading) {
          if (__DEV__) console.log('useRequireAuth - Not authenticated, redirecting to auth');
          router.replace('/auth');
        }
      };

      checkAuth();

      const unsubscribe = clerkAuthService.addListener((authState) => {
        if (!authState.isAuthenticated && !authState.loading) {
          if (__DEV__) console.log('useRequireAuth - Auth state changed to not authenticated, redirecting');
          router.replace('/auth');
        }
      });
      return unsubscribe;
    }, [router, useClerk])
  );
}
