import Constants from 'expo-constants';
import { useOAuth, useAuth, useClerk, useSignIn, useSignUp } from '@clerk/clerk-expo';

/**
 * Check if Clerk is configured (without using hooks)
 */
export function isClerkConfigured(): boolean {
  const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return !!(publishableKey && (publishableKey.startsWith('pk_live_') || (publishableKey.startsWith('pk_test_') && publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk')));
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
  // Check if Clerk is configured
  const isClerkEnabled = isClerkConfigured();

  // Always call hooks unconditionally (React requirement)
  // These will work if we're in ClerkProvider (which happens when Clerk is configured)
  // If not in ClerkProvider, these will throw - but that's expected if Clerk isn't set up
  const googleOAuth = useOAuth({ strategy: 'oauth_google' });
  const appleOAuth = useOAuth({ strategy: 'oauth_apple' });
  const { isLoaded: isSignInLoaded } = useSignIn();
  const { isLoaded: isSignUpLoaded } = useSignUp();
  const oauthReady = Boolean(isSignInLoaded && isSignUpLoaded);
  const auth = useAuth();
  const clerk = useClerk();
  // setActive is available on the Clerk instance, not on auth
  const clerkSetActive = clerk?.setActive;

  // Log for debugging
  console.log('useClerkOAuth - Hook called:', {
    isClerkEnabled,
    oauthReady,
    hasGoogleOAuth: !!googleOAuth,
    hasAppleOAuth: !!appleOAuth,
    hasAuth: !!auth,
    hasClerk: !!clerk,
    hasClerkSetActive: !!clerkSetActive,
    clerkSetActiveType: typeof clerkSetActive,
    googleOAuthHasStartFlow: !!(googleOAuth && typeof googleOAuth.startOAuthFlow === 'function'),
  });

  return {
    googleOAuth: isClerkEnabled ? googleOAuth : null,
    appleOAuth: isClerkEnabled ? appleOAuth : null,
    clerkSetActive: isClerkEnabled ? clerkSetActive : null,
    useClerk: isClerkEnabled,
    /** Clerk useOAuth returns an empty session until sign-in/sign-up resources are loaded — wait for this. */
    oauthReady: isClerkEnabled ? oauthReady : false,
  };
}

