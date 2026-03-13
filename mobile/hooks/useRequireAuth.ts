import React, { useEffect } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { clerkAuthService } from '@/services/clerkAuth';
import { useAuth } from '@clerk/clerk-expo';
import Constants from 'expo-constants';

/**
 * Hook to protect routes - redirects to auth if not authenticated
 * When Clerk is enabled, checks Clerk's auth state
 * When Clerk is disabled, checks clerkAuthService
 */
export function useRequireAuth() {
  const router = useRouter();
  
  // Check if Clerk is enabled
  const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const useClerk = publishableKey && (
    publishableKey.startsWith('pk_live_') || 
    (publishableKey.startsWith('pk_test_') && publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk')
  );

  // Get Clerk auth state (must be called unconditionally)
  // When Clerk is enabled, we're in ClerkProvider (from _layout.tsx), so this will work
  // When Clerk is disabled, we're not in ClerkProvider, so this will throw
  // But since useRequireAuth is only used in protected routes, and protected routes
  // are only accessible when Clerk is enabled (via AuthGateWithClerk), this should be safe
  const clerkAuth = useAuth();

  // Check auth on mount - but only after Clerk has loaded
  useEffect(() => {
    if (useClerk && clerkAuth) {
      // Wait for Clerk to load before checking auth state
      if (!clerkAuth.isLoaded) {
        // Clerk is still loading, don't redirect yet
        return;
      }
      // Use Clerk's auth state - only redirect if loaded AND not signed in
      if (!clerkAuth.isSignedIn) {
        if (__DEV__) console.log('useRequireAuth - Not authenticated with Clerk on mount, redirecting to auth');
        router.replace('/');
      }
    } else {
      // Use clerkAuthService
      const authState = clerkAuthService.getAuthState();
      if (!authState.isAuthenticated && !authState.loading) {
        if (__DEV__) console.log('useRequireAuth - Not authenticated on mount, redirecting to auth');
        router.replace('/');
      }
    }
  }, [router, useClerk, clerkAuth?.isLoaded, clerkAuth?.isSignedIn]);

  // Check auth when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const checkAuth = () => {
        if (useClerk && clerkAuth) {
          // Wait for Clerk to load before checking
          if (!clerkAuth.isLoaded) {
            // Clerk is still loading, don't redirect yet
            return;
          }
          // Use Clerk's auth state
          const isAuthenticated = clerkAuth.isSignedIn;
          if (!isAuthenticated) {
            if (__DEV__) console.log('useRequireAuth - Not authenticated with Clerk, redirecting to landing page');
            router.replace('/');
          }
        } else {
          // Use clerkAuthService
          const authState = clerkAuthService.getAuthState();
          if (!authState.isAuthenticated && !authState.loading) {
            if (__DEV__) console.log('useRequireAuth - Not authenticated, redirecting to auth');
            router.replace('/auth');
          }
        }
      };

      // Check immediately
      checkAuth();

      // Listen for auth state changes (only if not using Clerk)
      if (!useClerk || !clerkAuth) {
        const unsubscribe = clerkAuthService.addListener((authState) => {
          if (!authState.isAuthenticated && !authState.loading) {
            if (__DEV__) console.log('useRequireAuth - Auth state changed to not authenticated, redirecting');
            router.replace('/auth');
          }
        });
        return unsubscribe;
      }
    }, [router, useClerk, clerkAuth])
  );
}

