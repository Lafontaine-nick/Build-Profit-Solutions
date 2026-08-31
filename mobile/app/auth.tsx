import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { clerkAuthService } from '@/services/clerkAuth';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { isClerkPublishableKeyConfigured } from '@/lib/clerkPublishableKey';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { OAuthButtons } from '@/components/OAuthButtons';
import {
  useClerk as clerkInstanceHook,
  useAuth as clerkAuthHook,
  useSignIn as clerkSignInHook,
  useSignUp as clerkSignUpHook,
} from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { getPostAuthHref } from '@/lib/postAuthNavigation';
import {
  getStaySignedInPreference,
  setStaySignedInPreference,
} from '@/lib/authSessionPreference';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import {
  WEB_CENTERED_COLUMN_MAX_WIDTH,
  WEB_CENTERED_COLUMN_MIN_WIDTH,
} from '@/constants/ScreenLayout';
import { showAuthFeedback } from '@/utils/authFeedback';
import { useClerkUiReady } from '@/hooks/useClerkUiReady';

// Complete OAuth sessions properly
WebBrowser.maybeCompleteAuthSession();

/** Android-only in practice; on web `warmUpAsync` throws UnavailabilityError before the OS check. */
async function warmUpWebBrowserForOAuth(): Promise<void> {
  try {
    await WebBrowser.warmUpAsync();
  } catch (e) {
    if (__DEV__) {
      console.warn('[OAuth] WebBrowser.warmUpAsync skipped (expected on web):', e);
    }
  }
}

/**
 * OAuth return URL passed to Clerk `startOAuthFlow({ redirectUrl })`.
 *
 * - **Web:** Use a fixed path on the current origin so Google/Clerk see an https/http URL
 *   (not a custom scheme). Register the exact URL in Clerk:
 *   Dashboard → Configure → Paths → Redirect URLs / allowed list
 *   (e.g. `http://localhost:8081/oauth-native-callback` and your production origin + same path).
 * - **Native:** `expo-auth-session` resolves the app scheme + path (see `app/oauth-native-callback.tsx`).
 */
function getClerkOAuthRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    const uri = `${window.location.origin.replace(/\/$/, "")}/oauth-native-callback`;
    if (__DEV__) {
      console.log(
        "[Clerk OAuth] Web redirect URL — allowlist this in Clerk (Paths / redirect URLs):",
        uri
      );
    }
    return uri;
  }

  const uri = AuthSession.makeRedirectUri({ path: "oauth-native-callback" });
  if (__DEV__) {
    console.log(
      "[Clerk OAuth] Native redirect URL (register in Clerk if OAuth fails):",
      uri
    );
  }
  return uri;
}

// Password strength checker
const getPasswordStrength = (password: string): { strength: 'weak' | 'medium' | 'strong'; score: number; feedback: string[] } => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('At least 8 characters');
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Mix of uppercase and lowercase');
  }

  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include numbers');
  }

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include special characters');
  }

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (score >= 3) strength = 'strong';
  else if (score >= 2) strength = 'medium';

  return { strength, score, feedback: feedback.length > 0 ? feedback : [] };
};

// Email validation
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const AuthScreen: React.FC<{ authUiReady?: boolean }> = ({ authUiReady = true }) => {
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(
    () => getStyles(Colors, darkMode, windowWidth),
    [Colors, darkMode, windowWidth]
  );
  const inputPlaceholderColor = darkMode ? '#6B7280' : '#64748B';
  const params = useLocalSearchParams<{ mode?: string }>();

  const initialMode = params.mode === 'signin' ? 'signin' : 'signup';
  const [mode, setMode] = useState<'signup' | 'signin'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [needsVerificationCode, setNeedsVerificationCode] = useState(false);
  /** Clerk sign-up: email_code after signUp.create when status is not complete */
  const [needsSignupEmailCode, setNeedsSignupEmailCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [staySignedIn, setStaySignedIn] = useState(false);
  const [formBanner, setFormBanner] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const passwordStrength = isSignup && password ? getPasswordStrength(password) : null;

  /** Same key resolution as RootLayout + landing (manifest/env fallbacks — Expo web often omits `expoConfig.extra`). */
  const isClerkEnabled = isClerkPublishableKeyConfigured();

  // OAuth handlers are passed from OAuthButtons component which safely calls the hooks

  // Handle back button - check if we can go back, otherwise do nothing
  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      // If we can't go back (e.g., redirected from protected route), just do nothing
      // or navigate to home if needed
      // For now, we'll just do nothing to avoid the error
    }
  };

  // Get Clerk instance and auth state (must be called unconditionally)
  // Since we're in ClerkProvider when Clerk is configured, this should work
  let clerkInstance: any = null;
  let clerkAuth: any = null;
  let signInHook: any = null;
  let signUpHook: any = null;
  
  try {
    clerkInstance = clerkInstanceHook();
    clerkAuth = clerkAuthHook();
    
    // Get signIn and signUp hooks for email/password authentication
    // These hooks must be called unconditionally (React hooks rule)
    try {
      signInHook = clerkSignInHook();
      signUpHook = clerkSignUpHook();
    } catch (e) {
      console.log('useSignIn/useSignUp hooks not available:', e);
    }
  } catch (e) {
    // Not in ClerkProvider - that's okay, we'll handle it in the handlers
    console.log('useClerk/useAuth hooks not available');
  }

  useEffect(() => {
    void getStaySignedInPreference().then(setStaySignedIn);
  }, []);

  /** Prefer onboarding until this Clerk user has completed it; avoids router jumping past AuthGate. */
  const navigateAfterClerkSession = async (opts?: {
    oauthResult?: any;
    signInResource?: any;
    signUpResource?: any;
    /** Email/password; omit on OAuth so the stored preference is only set from the sign-in switch. */
    staySignedIn?: boolean;
  }) => {
    const oauth = opts?.oauthResult;
    const rIn = opts?.signInResource ?? oauth?.signIn;
    const rUp = opts?.signUpResource ?? oauth?.signUp;
    const resolveUid = () =>
      rIn?.userId ??
      rUp?.createdUserId ??
      rUp?.userId ??
      oauth?.userId ??
      clerkInstance?.user?.id ??
      clerkAuth?.userId ??
      null;

    let uid = resolveUid();
    if (!uid) {
      await new Promise((r) => setTimeout(r, 120));
      uid = resolveUid();
    }

    try {
      if (opts?.staySignedIn !== undefined) {
        await setStaySignedInPreference(opts.staySignedIn);
      }
    } catch {
      // non-fatal
    }

    try {
      router.replace(await getPostAuthHref(uid));
    } catch {
      router.replace('/onboarding');
    }
  };

  // OAuth handlers - receive OAuth objects from OAuthButtons component
  const handleGoogleSignIn = async (googleOAuthHandler: any, clerkSetActiveHandler: any) => {
    try {
      /**
       * Web (Safari/Chrome): `@clerk/clerk-expo` `useOAuth` uses `WebBrowser.openAuthSessionAsync`
       * then parses `rotating_token_nonce` from `URL.searchParams` — that often fails on web/Safari.
       * Use Clerk's redirect flow + `AuthenticateWithRedirectCallback` on `/oauth-native-callback` instead.
       */
      if (Platform.OS === "web") {
        const signIn = signInHook?.signIn;
        const signUp = signUpHook?.signUp;
        if ((!authUiReady && (!signInHook?.isLoaded || !signUpHook?.isLoaded)) || !signIn) {
          Alert.alert(
            "Sign-in not ready",
            "Please wait until authentication finishes loading, then try again—or use email and password."
          );
          return;
        }
        if (typeof window === "undefined") return;
        setLoading(true);
        /**
         * Path-style URLs match Clerk's Next.js examples; Clerk resolves against the current origin.
         * Allowlist the **absolute** equivalents in Clerk (same origin + path).
         */
        const redirectPath = "/oauth-native-callback";
        const completePath = "/(tabs)/dashboard";
        if (__DEV__) {
          const o = window.location.origin;
          console.log(
            "[Clerk OAuth] Add to Clerk allowed redirect URLs:",
            `${o}${redirectPath}`,
            `${o}${completePath}`
          );
        }
        try {
          await signIn.authenticateWithRedirect({
            strategy: "oauth_google",
            redirectUrl: redirectPath,
            redirectUrlComplete: completePath,
          });
        } catch (webErr: any) {
          const su: any = signUp;
          if (typeof su?.authenticateWithRedirect === "function") {
            try {
              await su.authenticateWithRedirect({
                strategy: "oauth_google",
                redirectUrl: redirectPath,
                redirectUrlComplete: completePath,
              });
              return;
            } catch (upErr) {
              console.error("Google web redirect (signUp fallback):", upErr);
            }
          }
          const msg = webErr?.message || String(webErr);
          if (
            !msg.includes("cancel") &&
            !msg.includes("dismiss") &&
            !msg.includes("user_cancelled")
          ) {
            console.error("Google web redirect OAuth error:", webErr);
            const full = msg || "Could not start Google sign-in. Check Clerk allowed redirect URLs for this origin.";
            Alert.alert("Google Sign-In Error", full);
            if (typeof window !== "undefined" && __DEV__) {
              window.alert(`Google Sign-In (dev): ${full}`);
            }
          }
          setLoading(false);
        }
        return;
      }

      console.log('🔵 handleGoogleSignIn called with:', {
        hasGoogleOAuthHandler: !!googleOAuthHandler,
        hasClerkSetActiveHandler: !!clerkSetActiveHandler,
        hasClerkInstance: !!clerkInstance,
        googleOAuthHandlerType: typeof googleOAuthHandler,
        clerkSetActiveHandlerType: typeof clerkSetActiveHandler,
        googleOAuthHandlerKeys: googleOAuthHandler ? Object.keys(googleOAuthHandler) : [],
      });

      // Check if OAuth handler is valid
      if (!googleOAuthHandler) {
        console.error('❌ OAuth handler missing:', {
          googleOAuthHandler: googleOAuthHandler,
        });
        Alert.alert(
          'OAuth Not Configured',
          'Google Sign-In requires Clerk to be set up with OAuth providers.\n\nTo enable:\n1. Enable Google OAuth in Clerk dashboard\n2. Add your Google Client ID and Secret\n3. Make sure redirect URI matches: https://nearby-collie-1.clerk.accounts.dev/v1/oauth_callback\n\nSee GOOGLE_OAUTH_SETUP.md for detailed instructions.',
          [{ text: 'OK' }]
        );
        return;
      }

    // Get setActive from handler, clerk instance, or try to get it from useClerk
    const setActive = clerkSetActiveHandler || clerkInstance?.setActive;
    
    if (!setActive) {
      console.error('setActive method not available:', {
        clerkSetActiveHandler: clerkSetActiveHandler,
        clerkInstance: clerkInstance,
      });
      Alert.alert(
        'OAuth Not Configured',
        'Google Sign-In requires Clerk to be set up with OAuth providers.\n\nTo enable:\n1. Enable Google OAuth in Clerk dashboard\n2. Add your Google Client ID and Secret\n3. Make sure redirect URI matches: https://nearby-collie-1.clerk.accounts.dev/v1/oauth_callback\n\nSee GOOGLE_OAUTH_SETUP.md for detailed instructions.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if startOAuthFlow method exists
    if (typeof googleOAuthHandler.startOAuthFlow !== 'function') {
      console.error('❌ startOAuthFlow method missing from googleOAuthHandler:', {
        googleOAuthHandler,
        type: typeof googleOAuthHandler,
        keys: Object.keys(googleOAuthHandler || {}),
      });
      Alert.alert(
        'OAuth Not Configured',
        'Google Sign-In requires Clerk to be set up with OAuth providers.\n\nTo enable:\n1. Enable Google OAuth in Clerk dashboard\n2. Add your Google Client ID and Secret\n3. Make sure redirect URI matches: https://nearby-collie-1.clerk.accounts.dev/v1/oauth_callback\n\nSee GOOGLE_OAUTH_SETUP.md for detailed instructions.',
        [{ text: 'OK' }]
      );
      return;
    }

    console.log('✅ All checks passed, starting OAuth flow...');

    setLoading(true);
    try {
      console.log('Starting Google OAuth flow...');
      console.log('Google OAuth handler:', {
        hasStartOAuthFlow: typeof googleOAuthHandler.startOAuthFlow === 'function',
        handlerType: typeof googleOAuthHandler,
      });
      
      // Warm up browser for better performance
      await warmUpWebBrowserForOAuth();

      const oauthRedirectUrl = getClerkOAuthRedirectUrl();
      const result = await googleOAuthHandler.startOAuthFlow({ redirectUrl: oauthRedirectUrl });
      console.log('Google OAuth flow result:', {
        hasCreatedSessionId: !!result?.createdSessionId,
        createdSessionId: result?.createdSessionId,
        hasSignIn: !!result?.signIn,
        hasSignUp: !!result?.signUp,
        signInSessionId: result?.signIn?.createdSessionId,
        signUpSessionId: result?.signUp?.createdSessionId,
        hasSetActiveInResult: !!result?.setActive,
        resultKeys: result ? Object.keys(result) : [],
        fullResult: result,
      });
      
      // Check if user cancelled or flow didn't complete
      // Empty result with no session usually means cancellation or incomplete flow
      const hasNoSessionData = !result?.createdSessionId && 
                               !result?.signIn?.createdSessionId && 
                               !result?.signUp?.createdSessionId &&
                               !result?.setActive;
      
      if (hasNoSessionData && (!result || Object.keys(result).length === 0 || 
          (result.createdSessionId === "" && !result.signIn && !result.signUp))) {
        console.log('OAuth flow cancelled or incomplete - no session data');
        console.log('Result details:', JSON.stringify(result, null, 2));
        // Empty result is usually user dismissed the browser or redirect URL mismatch — not a network outage.
        setLoading(false);
        return;
      }
      
      // Use setActive from result if available, otherwise use the one we have
      const resultSetActive = result?.setActive || setActive;
      
      // Extract session ID from various possible locations
      let sessionId = result?.createdSessionId || 
                      result?.signIn?.createdSessionId || 
                      result?.signUp?.createdSessionId;
      
      // If we have signIn or signUp objects, try to get session from them
      if (!sessionId && result?.signIn) {
        // Try to complete the sign-in if needed
        if (result.signIn.status === 'complete') {
          sessionId = result.signIn.createdSessionId;
        } else if (result.signIn.status === 'needs_second_factor') {
          throw new Error('Two-factor authentication required. Please use email/password sign-in.');
        }
      }
      
      if (!sessionId && result?.signUp) {
        // Try to complete the sign-up if needed
        if (result.signUp.status === 'complete') {
          sessionId = result.signUp.createdSessionId;
        } else if (result.signUp.status === 'needs_verification') {
          throw new Error('Email verification required. Please check your email.');
        }
      }
      
      // If result.setActive is available, use it directly (it handles the session automatically)
      if (result?.setActive && typeof result.setActive === 'function') {
        console.log('Using setActive from result...');
        try {
          await result.setActive();
          console.log('Session set via result.setActive, navigating to app...');
          await navigateAfterClerkSession({ oauthResult: result });
          setLoading(false);
          return;
        } catch (setActiveError: any) {
          console.warn('result.setActive() failed, trying fallback method:', setActiveError);
          // Fall through to try alternative method below
        }
      }
      
      if (sessionId && resultSetActive) {
        console.log('Google OAuth successful, setting active session...');
        try {
          await resultSetActive({ session: sessionId });
          console.log('Session set, navigating to app...');
          await navigateAfterClerkSession({ oauthResult: result });
          setLoading(false);
          return;
        } catch (setActiveError: any) {
          console.error('Failed to set active session:', setActiveError);
          // Check if user is actually signed in despite the error
          const isActuallySignedIn = clerkAuth?.isSignedIn === true;
          if (isActuallySignedIn) {
            console.log('User is signed in despite setActive error, navigating...');
            await navigateAfterClerkSession({ oauthResult: result });
            setLoading(false);
            return;
          }
          // If not signed in, throw the error to be caught by outer catch
          throw setActiveError;
        }
      } else {
        console.error('Google OAuth flow incomplete:', {
          hasCreatedSessionId: !!result?.createdSessionId,
          hasSignIn: !!result?.signIn,
          hasSignUp: !!result?.signUp,
          signInStatus: result?.signIn?.status,
          signUpStatus: result?.signUp?.status,
          hasSetActive: !!resultSetActive,
          hasResultSetActive: !!result?.setActive,
          result: result,
        });
        // Check if this is likely a configuration issue
        const isEmptyResult = result?.createdSessionId === "" && !result?.signIn && !result?.signUp;
        if (isEmptyResult) {
          throw new Error('OAuth flow completed but no session was created. This usually means Google OAuth is not properly configured in your Clerk dashboard. Please check your Clerk settings and ensure Google OAuth is enabled with correct credentials.');
        }
        throw new Error('No session created from OAuth flow');
      }
    } catch (error: any) {
      const errorCode =
        error?.errors?.[0]?.code ||
        error?.error?.errors?.[0]?.code ||
        error?.code ||
        error?.error?.code;
      const errorStatus =
        error?.status ||
        error?.error?.status ||
        error?.statusCode ||
        (error?.toString?.()?.match(/Status: (\d+)/)?.[1]
          ? parseInt(error.toString().match(/Status: (\d+)/)?.[1] || '0')
          : null);
      const clerkErrorMessage =
        error?.errors?.[0]?.message ||
        error?.error?.errors?.[0]?.message ||
        error?.message ||
        error?.error?.message ||
        '';
      const errorString = String(error);
      let extractedErrorCode = errorCode;
      if (errorString.includes('session_exists')) {
        extractedErrorCode = 'session_exists';
      }

      // Already signed in — navigate quietly (no red error overlay).
      if (
        extractedErrorCode === 'session_exists' ||
        errorCode === 'session_exists' ||
        clerkErrorMessage.includes('already signed in') ||
        clerkErrorMessage.includes('Session already exists') ||
        errorString.includes('session_exists')
      ) {
        if (clerkAuth?.isSignedIn === true) {
          console.log('User already signed in, navigating to app...');
          setLoading(false);
          void navigateAfterClerkSession({});
          return;
        }
      }

      // Log full error details for debugging
      console.error('❌ Error in handleGoogleSignIn:', {
        error,
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        toString: String(error),
        errorType: typeof error,
        errorKeys: error ? Object.keys(error) : [],
        // Extract status from error string if present
        statusFromString: error?.toString?.()?.match(/Status: (\d+)/)?.[1],
        // Try to get nested error info
        nestedError: error?.error,
        nestedErrorKeys: error?.error ? Object.keys(error.error) : [],
      });
      
      // Don't show error if user cancelled
      const errorMessage = error?.message || String(error) || '';
      if (errorMessage.includes('cancel') || errorMessage.includes('dismiss') || errorMessage.includes('user_cancelled') || errorMessage.includes('cancelled')) {
        console.log('User cancelled Google sign-in');
        setLoading(false);
        return;
      }

      if (
        extractedErrorCode === 'session_exists' ||
        errorCode === 'session_exists' ||
        (errorStatus === 400 && extractedErrorCode === 'session_exists')
      ) {
        console.log('Session exists error but user is NOT signed in. This suggests OAuth configuration issue.');
        setLoading(false);
        Alert.alert(
          'Sign-In Error',
          'Google Sign-In encountered an issue. This usually means:\n\n1. Google OAuth is not properly configured in Clerk\n2. There\'s a stale session that needs to be cleared\n\nPlease check your Clerk dashboard to ensure Google OAuth is enabled and configured correctly.\n\nSee GOOGLE_OAUTH_SETUP.md for instructions.',
          [{ text: 'OK' }]
        );
        return;
      }

      const errorResponse = error?.response || error?.data || error?.error;
      
      // Only log errors for actual failures (not session_exists when already signed in)
      // Try to serialize error for better logging
      let errorDetails: any = {};
      try {
        errorDetails = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
      } catch (e) {
        errorDetails = {
          message: error?.message,
          name: error?.name,
          stack: error?.stack,
          toString: String(error),
        };
      }
      
      console.error('Google sign-in error - Full details:', {
        errorDetails,
        errorCode,
        extractedErrorCode,
        errorStatus,
        clerkErrorMessage,
        errorResponse,
        errorKeys: error ? Object.keys(error) : [],
        errorString: errorString,
        errorType: typeof error,
      });
      
      // Provide helpful error message based on error type
      let userFriendlyMessage = 'Google sign-in failed. Please try again or use email and password.';
      
      // Check for various error types
      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('_fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Network request failed');
      const isConfigError = errorCode === 'configuration_error' || errorStatus === 400 || errorStatus === 401 || errorStatus === 403;
      
      if (isNetworkError) {
        userFriendlyMessage = 'Network Connection Error\n\nThe app cannot reach Clerk\'s servers. This usually means:\n\n1. ❌ No internet connection\n   → Check your Wi-Fi or cellular data\n\n2. ❌ Firewall/VPN blocking\n   → Try disabling VPN or firewall\n   → Try a different network\n\n3. ❌ Network restrictions\n   → Some networks block certain domains\n   → Try using cellular data instead of Wi-Fi\n\n4. ❌ Device/Emulator network issue\n   → Restart your device\n   → If using emulator, check network settings\n\nPlease check your internet connection and try again.';
      } else if (isConfigError) {
        // More specific message for 400 errors
        if (errorStatus === 400) {
          userFriendlyMessage = 'Google Sign-In Configuration Error (400)\n\nThis usually means:\n\n1. ❌ Google OAuth not enabled in Clerk\n   → Go to Clerk Dashboard → Social Connections → Enable Google\n\n2. ❌ Missing or invalid Google credentials\n   → Add Google Client ID and Secret in Clerk Dashboard\n   → Verify credentials in Google Cloud Console\n\n3. ❌ Redirect URI mismatch\n   → Google Console: https://accounts.clerk.dev/v1/oauth_callback\n   → Or your instance: https://[your-instance].clerk.accounts.dev/v1/oauth_callback\n\n4. ❌ Invalid OAuth request format\n   → Check Clerk dashboard for any error messages\n   → Verify OAuth settings are saved correctly\n\nSee GOOGLE_OAUTH_SETUP.md for detailed instructions.';
        } else {
          userFriendlyMessage = 'Google Sign-In is not properly configured.\n\nTo fix:\n1. Go to Clerk Dashboard → User & Authentication → Social Connections\n2. Click "Configure" next to Google\n3. Make sure Google OAuth is enabled and credentials are set\n4. Verify redirect URI in Google Console: https://accounts.clerk.dev/v1/oauth_callback\n5. Save and try again\n\nSee GOOGLE_OAUTH_SETUP.md for detailed instructions.';
        }
      } else if (errorCode || errorStatus) {
        userFriendlyMessage = `Google sign-in error: ${errorCode || errorStatus}\n\n${clerkErrorMessage || errorMessage}\n\nPlease check your Clerk dashboard configuration.`;
      }
      
        Alert.alert(
        'Google Sign-In Error',
        userFriendlyMessage,
          [{ text: 'OK' }]
        );
    } finally {
      setLoading(false);
    }
    } catch (outerError: any) {
      // Catch any errors that happen in the initial checks
      console.error('❌ Outer error in handleGoogleSignIn (before OAuth flow):', outerError);
      Alert.alert(
        'Google Sign-In Error',
        `An unexpected error occurred: ${outerError?.message || String(outerError)}\n\nPlease check the console for more details.`
      );
      setLoading(false);
    }
  };

  const handleAppleSignIn = async (appleOAuthHandler: any, clerkSetActiveHandler: any) => {
    console.log('handleAppleSignIn called with:', {
      hasAppleOAuthHandler: !!appleOAuthHandler,
      hasClerkSetActiveHandler: !!clerkSetActiveHandler,
      hasClerkInstance: !!clerkInstance,
      appleOAuthHandlerType: typeof appleOAuthHandler,
      clerkSetActiveHandlerType: typeof clerkSetActiveHandler,
    });

    if (Platform.OS !== 'ios') {
      Alert.alert('Not Available', 'Apple Sign In is only available on iOS devices.');
      return;
    }

    // Check if OAuth handler is valid
    if (!appleOAuthHandler) {
      console.error('OAuth handler missing:', {
        appleOAuthHandler: appleOAuthHandler,
      });
      Alert.alert(
        'OAuth Not Configured',
        'Apple Sign-In requires Clerk to be set up with OAuth providers.\n\nTo enable:\n1. Enable Apple OAuth in Clerk dashboard\n2. Configure Apple Sign-In credentials in Apple Developer Portal\n3. Add Service ID, Key ID, Team ID, and Key file to Clerk\n\nSee APPLE_OAUTH_SETUP.md for detailed instructions.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Get setActive from handler, clerk instance, or try to get it from useClerk
    const setActive = clerkSetActiveHandler || clerkInstance?.setActive;
    
    if (!setActive) {
      console.error('setActive method not available:', {
        clerkSetActiveHandler: clerkSetActiveHandler,
        clerkInstance: clerkInstance,
      });
      Alert.alert(
        'OAuth Not Configured',
        'Apple Sign-In requires Clerk to be set up with OAuth providers.\n\nTo enable:\n1. Enable Apple OAuth in Clerk dashboard\n2. Configure Apple Sign-In credentials in Apple Developer Portal\n3. Add Service ID, Key ID, Team ID, and Key file to Clerk\n\nSee APPLE_OAUTH_SETUP.md for detailed instructions.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if startOAuthFlow method exists
    if (typeof appleOAuthHandler.startOAuthFlow !== 'function') {
      console.error('startOAuthFlow method missing from appleOAuthHandler:', appleOAuthHandler);
      Alert.alert(
        'OAuth Not Configured',
        'Apple Sign-In requires Clerk to be set up with OAuth providers.\n\nTo enable:\n1. Enable Apple OAuth in Clerk dashboard\n2. Configure Apple Sign-In credentials in Apple Developer Portal\n3. Add Service ID, Key ID, Team ID, and Key file to Clerk\n\nSee APPLE_OAUTH_SETUP.md for detailed instructions.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);
    try {
      console.log('Starting Apple OAuth flow...');
      console.log('Apple OAuth handler:', {
        hasStartOAuthFlow: typeof appleOAuthHandler.startOAuthFlow === 'function',
        handlerType: typeof appleOAuthHandler,
      });

      await warmUpWebBrowserForOAuth();

      const oauthRedirectUrl = getClerkOAuthRedirectUrl();
      const result = await appleOAuthHandler.startOAuthFlow({ redirectUrl: oauthRedirectUrl });
      console.log('Apple OAuth flow result:', {
        hasCreatedSessionId: !!result?.createdSessionId,
        createdSessionId: result?.createdSessionId,
        hasSignIn: !!result?.signIn,
        hasSignUp: !!result?.signUp,
        signInSessionId: result?.signIn?.createdSessionId,
        signUpSessionId: result?.signUp?.createdSessionId,
        resultKeys: result ? Object.keys(result) : [],
        fullResult: result,
      });

      const authSession = (result as any)?.authSessionResult;
      if (authSession && authSession.type && authSession.type !== 'success') {
        console.log('Apple OAuth dismissed or cancelled:', authSession.type);
        return;
      }

      const resultSetActive = result?.setActive || setActive;

      // Extract session ID from various possible locations
      let sessionId =
        result?.createdSessionId ||
        result?.signIn?.createdSessionId ||
        result?.signUp?.createdSessionId;

      if (!sessionId && result?.signIn) {
        if (result.signIn.status === 'complete') {
          sessionId = result.signIn.createdSessionId;
        } else if (result.signIn.status === 'needs_second_factor') {
          throw new Error('Two-factor authentication required. Please use email/password sign-in.');
        }
      }

      if (!sessionId && result?.signUp) {
        if (result.signUp.status === 'complete') {
          sessionId = result.signUp.createdSessionId;
        } else if (result.signUp.status === 'needs_verification') {
          throw new Error('Email verification required. Please check your email.');
        }
      }

      if (result?.setActive && typeof result.setActive === 'function') {
        try {
          await result.setActive();
          await navigateAfterClerkSession({ oauthResult: result });
          return;
        } catch (setActiveError: any) {
          console.warn('Apple result.setActive() failed, trying session id:', setActiveError);
        }
      }

      if (sessionId && resultSetActive) {
        console.log('Apple OAuth successful, setting active session...');
        await resultSetActive({ session: sessionId });
        await navigateAfterClerkSession({ oauthResult: result });
      } else {
        console.error('Apple OAuth flow incomplete:', {
          hasCreatedSessionId: !!result?.createdSessionId,
          hasSignIn: !!result?.signIn,
          hasSignUp: !!result?.signUp,
          signInStatus: result?.signIn?.status,
          signUpStatus: result?.signUp?.status,
          hasSetActive: !!setActive,
          result: result,
        });
        const isEmptyResult =
          result?.createdSessionId === '' && !result?.signIn && !result?.signUp;
        if (isEmptyResult) {
          throw new Error(
            'Apple Sign-In did not return a session. Add the redirect URL from the Metro log ([Clerk OAuth] Redirect URL) to Clerk → Native applications → your iOS app, and ensure Apple is enabled under Social connections.'
          );
        }
        throw new Error('No session created from OAuth flow');
      }
    } catch (error: any) {
      const errorCode = error?.error?.errors?.[0]?.code || error?.code;
      const errorStatus = error?.error?.status || error?.status;
      const clerkErrorMessage = error?.error?.errors?.[0]?.message || error?.message || '';
      const errorResponse = error?.response || error?.data;

      let extractedErrorCode = errorCode;
      const errorString = String(error);
      if (errorString.includes('session_exists')) {
        extractedErrorCode = 'session_exists';
      } else if (errorString.includes('Serialized errors')) {
        try {
          const serializedMatch = errorString.match(/Serialized errors: ({[^}]+})/);
          if (serializedMatch) {
            const serializedErrors = JSON.parse(serializedMatch[1]);
            extractedErrorCode = serializedErrors.code || extractedErrorCode;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Handle "session_exists" error FIRST - check if user is actually signed in
      // If user is already signed in, silently navigate without logging error
      if (extractedErrorCode === 'session_exists' || errorCode === 'session_exists' ||
          clerkErrorMessage.includes('already signed in') ||
          clerkErrorMessage.includes('Session already exists') ||
          errorString.includes('already signed in') ||
          errorString.includes('Session already exists') ||
          (errorStatus === 400 && extractedErrorCode === 'session_exists')) {
        
        // Check Clerk's actual auth state
        const isActuallySignedIn = clerkAuth?.isSignedIn === true;
        
        if (isActuallySignedIn) {
          // User is already signed in - silently navigate, no error needed
          console.log('User already signed in, navigating to app...');
          void navigateAfterClerkSession({});
          return;
        } else {
          // User is NOT signed in, but getting session_exists error
          // This means there's a stale session or OAuth isn't configured properly
          console.log('Session exists error but user is NOT signed in. This suggests OAuth configuration issue.');
          Alert.alert(
            'Sign-In Error',
            'Apple Sign-In encountered an issue. This usually means:\n\n1. Apple OAuth is not properly configured in Clerk\n2. There\'s a stale session that needs to be cleared\n3. Apple Developer account setup is incomplete\n\nPlease check your Clerk dashboard and Apple Developer Portal to ensure Apple OAuth is enabled and configured correctly.\n\nSee APPLE_OAUTH_SETUP.md for instructions.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      // Only log errors for actual failures (not session_exists when already signed in)
      console.error('Apple sign-in error - Full details:', {
        errorDetails: (() => {
          try {
            return JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
          } catch (e) {
            return {
              message: error?.message,
              name: error?.name,
              stack: error?.stack,
              toString: String(error),
            };
          }
        })(),
        errorCode,
        extractedErrorCode,
        errorStatus,
        clerkErrorMessage,
        errorResponse,
        errorKeys: error ? Object.keys(error) : [],
        errorString: errorString,
        errorType: typeof error,
      });
      
      // Don't show alert if user cancelled
      const errorMessage = error?.message || String(error) || '';
      if (errorMessage.includes('cancel') || errorMessage.includes('dismiss') || errorMessage.includes('user_cancelled')) {
        console.log('User cancelled Apple sign-in');
        return;
      }

      let userFriendlyMessage = 'Apple sign-in failed. Please try again or use email and password.';

      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('_fetch') || errorMessage.includes('ECONNREFUSED');
      const isConfigError = errorCode === 'configuration_error' || errorStatus === 400 || errorStatus === 401 || errorStatus === 403;

      if (isNetworkError || isConfigError) {
        userFriendlyMessage = 'Apple Sign-In is not properly configured.\n\nTo fix:\n1. Go to Clerk Dashboard → User & Authentication → Social Connections\n2. Click "Configure" next to Apple\n3. Verify all credentials are set:\n   - Service ID\n   - Key ID\n   - Team ID\n   - Key file (.p8)\n4. Check Apple Developer Portal:\n   - App ID has "Sign in with Apple" enabled\n   - Service ID is configured with correct return URLs\n   - Key file is valid\n5. Save and try again\n\nSee APPLE_OAUTH_SETUP.md for detailed instructions.';
      } else if (errorCode || errorStatus) {
        userFriendlyMessage = `Apple sign-in error: ${errorCode || errorStatus}\n\n${clerkErrorMessage || errorMessage}\n\nPlease check your Clerk dashboard and Apple Developer Portal configuration.`;
      }

      Alert.alert(
        'Apple Sign-In Error',
        userFriendlyMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Validation helper — single-field edits (blur / onChange). Submit uses batch validation below.
  const validateField = (field: string, value: string): boolean => {
    const newErrors: Record<string, string> = { ...errors };
    let isValid = true;

    switch (field) {
      case 'email':
        if (!value) {
          newErrors.email = t('auth.emailRequired');
          isValid = false;
        } else if (!isValidEmail(value)) {
          newErrors.email = t('auth.emailInvalid');
          isValid = false;
        } else {
          delete newErrors.email;
        }
        break;
      case 'password':
        if (!value) {
          newErrors.password = t('auth.passwordRequired');
          isValid = false;
        } else if (isSignup && value.length < 8) {
          newErrors.password = t('auth.passwordTooShort');
          isValid = false;
        } else {
          delete newErrors.password;
        }
        break;
      case 'confirmPassword':
        if (!value) {
          newErrors.confirmPassword = t('auth.confirmPasswordRequired');
          isValid = false;
        } else if (value !== password) {
          newErrors.confirmPassword = t('auth.passwordsDontMatch');
          isValid = false;
        } else {
          delete newErrors.confirmPassword;
        }
        break;
      case 'firstName':
        if (!value) {
          newErrors.firstName = t('auth.firstNameRequired');
          isValid = false;
        } else if (value.length < 2) {
          newErrors.firstName = 'First name must be at least 2 characters';
          isValid = false;
        } else {
          delete newErrors.firstName;
        }
        break;
      case 'lastName':
        if (!value) {
          newErrors.lastName = t('auth.lastNameRequired');
          isValid = false;
        } else if (value.length < 2) {
          newErrors.lastName = 'Last name must be at least 2 characters';
          isValid = false;
        } else {
          delete newErrors.lastName;
        }
        break;
    }

    setErrors(newErrors);
    return isValid;
  };

  /** Submit-time validation: merged errors for all relevant fields (fixes stale `errors` on web). */
  const validateAllForSubmit = (): boolean => {
    const next: Record<string, string> = {};
    const keys: string[] = isSignup
      ? ['firstName', 'lastName', 'email', 'password', 'confirmPassword']
      : ['email', 'password'];

    if (isSignup) {
      if (!firstName.trim()) next.firstName = t('auth.firstNameRequired');
      else if (firstName.trim().length < 2) next.firstName = 'First name must be at least 2 characters';
      if (!lastName.trim()) next.lastName = t('auth.lastNameRequired');
      else if (lastName.trim().length < 2) next.lastName = 'Last name must be at least 2 characters';
    }
    const em = email.trim();
    if (!em) next.email = t('auth.emailRequired');
    else if (!isValidEmail(em)) next.email = t('auth.emailInvalid');
    if (!password) next.password = t('auth.passwordRequired');
    else if (isSignup && password.length < 8) next.password = t('auth.passwordTooShort');
    if (isSignup) {
      if (!confirmPassword) next.confirmPassword = t('auth.confirmPasswordRequired');
      else if (confirmPassword !== password) next.confirmPassword = t('auth.passwordsDontMatch');
    }

    setErrors((prev) => {
      const merged = { ...prev };
      keys.forEach((k) => {
        if (next[k]) merged[k] = next[k];
        else delete merged[k];
      });
      return merged;
    });
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    // Mark all fields as touched
    const fieldsToValidate = isSignup 
      ? ['email', 'password', 'confirmPassword', 'firstName', 'lastName']
      : ['email', 'password'];
    
    fieldsToValidate.forEach(field => {
      setTouched(prev => ({ ...prev, [field]: true }));
    });

    // Validate all fields (single merge — avoids stale `errors` losing messages on web)
    const isValid = validateAllForSubmit();

    if (!isValid) {
      const banner = 'Please check the highlighted fields above.';
      setFormBanner(banner);
      showAuthFeedback('Missing information', banner);
      return;
    }

    setFormBanner(null);

    /** Avoid falling through to `clerkAuthService` — Clerk-only accounts would always “fail” to sign in. */
    if (isClerkEnabled) {
      if (!signInHook || !signUpHook) {
        const msg =
          'Authentication is still initializing. Wait a few seconds and try again, or refresh the page.';
        setFormBanner(msg);
        showAuthFeedback('Sign-in unavailable', msg);
        return;
      }
      if (!authUiReady && (!signInHook.isLoaded || !signUpHook.isLoaded)) {
        const msg = 'Sign-in is still loading. Try again in a moment.';
        setFormBanner(msg);
        showAuthFeedback('Please wait', msg);
        return;
      }
    }

    // Clerk rejects signIn.create / signUp.create while a session already exists
    if (isClerkEnabled && clerkAuth?.isSignedIn) {
      void navigateAfterClerkSession({});
      return;
    }
      
    setLoading(true);
    try {
      // Use Clerk for email/password authentication if available
      if (isClerkEnabled && signInHook && signUpHook) {
        const setActive = signInHook.setActive || signUpHook.setActive || clerkInstance?.setActive;
        
        if (isSignup) {
          // Sign up with Clerk
          const signUpResult = await signUpHook.signUp.create({
            emailAddress: email.trim(),
            password: password.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          });

          console.log('Sign up result:', signUpResult.status);

          if (signUpResult.status === 'complete') {
            // Account created, set active session
            if (signUpResult.createdSessionId && setActive) {
              await setActive({ session: signUpResult.createdSessionId });
              await navigateAfterClerkSession({
                signUpResource: signUpHook?.signUp,
                staySignedIn: true,
              });
            } else {
              const msg =
                'Account created successfully! Please check your email to verify your account.';
              showAuthFeedback('Success', msg);
              router.replace('/auth?mode=signin');
            }
          } else {
            // Email verification (or other requirements) — must prepare so Clerk sends the code
            const su = signUpHook.signUp;
            try {
              if (su && typeof su.prepareEmailAddressVerification === 'function') {
                await su.prepareEmailAddressVerification({ strategy: 'email_code' });
              }
              setVerificationCode('');
              setNeedsSignupEmailCode(true);
              setFormBanner('Enter the verification code we emailed you.');
            } catch (prepErr: any) {
              console.error('Sign-up email verification prepare:', prepErr);
              const prepMsg =
                prepErr?.errors?.[0]?.longMessage ||
                prepErr?.errors?.[0]?.message ||
                prepErr?.message ||
                'Could not start email verification. Check Clerk sign-up settings or try again.';
              setFormBanner(prepMsg);
              showAuthFeedback('Verify Email', prepMsg);
            }
          }
        } else {
          // Sign in with Clerk
          console.log('Attempting sign in with Clerk:', { email: email.trim(), hasPassword: !!password });
          
          const signInResult = await signInHook.signIn.create({
            identifier: email.trim(),
            password: password.trim(),
          });

          console.log('Sign in result:', {
            status: signInResult.status,
            hasSessionId: !!signInResult.createdSessionId,
            supportedSecondFactors: signInResult.supportedSecondFactors,
            errors: signInResult.errors,
            fullResult: signInResult
          });

          if (signInResult.status === 'complete') {
            // Sign in successful, set active session
            if (signInResult.createdSessionId && setActive) {
              await setActive({ session: signInResult.createdSessionId });
              await navigateAfterClerkSession({
                signInResource: signInHook?.signIn,
                staySignedIn: staySignedIn,
              });
            } else {
              Alert.alert('Error', 'Sign in successful but session could not be created. Please try again.');
            }
          } else if (signInResult.status === 'needs_second_factor') {
            // User needs to complete second factor (email verification code)
            // Password is correct, but Clerk requires email verification
            console.log('Clerk requires second factor, preparing email code');
            console.log('Sign in requires second factor, available strategies:', signInResult.supportedSecondFactors);
            
            // Find email code strategy
            const emailCodeStrategy = signInResult.supportedSecondFactors?.find(
              (factor: any) => factor.strategy === 'email_code'
            );
            
            if (emailCodeStrategy) {
              try {
                // Prepare and send the email code
                await signInHook.signIn.prepareSecondFactor({
                  strategy: 'email_code',
                });
                // Show code input UI
                setNeedsVerificationCode(true);
                Alert.alert(
                  'Verification Code Sent',
                  'Please check your email for a verification code to complete sign in.',
                  [{ text: 'OK' }]
                );
              } catch (prepError: any) {
                console.error('Error preparing second factor:', prepError);
                Alert.alert(
                  'Error',
                  'Failed to send verification code. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            } else {
              Alert.alert(
                'Verification Required',
                'Please check your email for a verification code to complete sign in.',
                [{ text: 'OK' }]
              );
            }
          } else if (signInResult.status === 'needs_email_verification') {
            // Email needs to be verified
            Alert.alert(
              'Email Verification Required',
              'Please check your email and verify your account before signing in.',
              [{ text: 'OK' }]
            );
          } else {
            // Other status - show generic error
            const errorMsg = signInResult.errors?.[0]?.message || signInResult.errors?.[0]?.longMessage || 'Sign in requires additional verification. Please try again.';
            Alert.alert('Error', errorMsg);
          }
        }
      } else {
        // Fallback to backend API if Clerk is not available
        if (isSignup) {
          await clerkAuthService.signUp(email, password, firstName, lastName);
          await new Promise(resolve => setTimeout(resolve, 100));
          Alert.alert('Success', 'Account created successfully!', [
            {
              text: 'OK',
              onPress: () => router.replace('/(tabs)/dashboard'),
            },
          ]);
        } else {
          await clerkAuthService.signIn(email, password);
          await new Promise(resolve => setTimeout(resolve, 100));
          router.replace('/(tabs)/dashboard');
        }
      }
    } catch (error: any) {
      console.warn('Auth error:', error?.message ?? error);
      if (__DEV__) {
        console.log('Auth error details:', JSON.stringify(error, null, 2));
      }

      const clerkErrCode = error?.errors?.[0]?.code;
      if (clerkErrCode === 'session_exists') {
        showAuthFeedback(
          'Already signed in',
          'Your session is still active. Continuing to the app.'
        );
        void navigateAfterClerkSession({});
        return;
      }

      // Extract error message from Clerk error format
      let errorMessage = 'An error occurred. Please try again.';
      
      if (error?.errors && Array.isArray(error.errors) && error.errors.length > 0) {
        errorMessage = error.errors[0].message || error.errors[0].longMessage || errorMessage;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Sign-in: map vague credential errors. Sign-up: keep Clerk's message — it often
      // contains "password" (policy, pwned list) and must not become "invalid login".
      if (isSignup) {
        const code = error?.errors?.[0]?.code;
        const lower = errorMessage.toLowerCase();
        if (
          code === 'form_identifier_exists' ||
          code === 'form_param_exists' ||
          lower.includes('already exists') ||
          lower.includes('identifier_exists') ||
          lower.includes('is taken')
        ) {
          errorMessage =
            'An account with this email already exists. Try Sign in, or use a different email.';
        } else if (!errorMessage || errorMessage === 'An error occurred. Please try again.') {
          errorMessage = 'Could not create account. Please check your details and try again.';
        }
      } else {
        if (errorMessage.includes('password') || errorMessage.includes('Password')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (errorMessage.includes('email') || errorMessage.includes('Email')) {
          errorMessage = 'Invalid email address. Please check and try again.';
        } else if (!errorMessage || errorMessage === 'An error occurred. Please try again.') {
          errorMessage = 'Invalid email or password. Please try again.';
        }
      }
      
      setFormBanner(errorMessage);
      showAuthFeedback('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle verification code submission
  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (!isClerkEnabled || !signInHook) {
      Alert.alert('Error', 'Authentication service is not ready.');
      return;
    }

    setLoading(true);
    try {
      const result = await signInHook.signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: verificationCode.trim(),
      });

      console.log('Second factor result:', result.status);

      if (result.status === 'complete') {
        const setActive = signInHook.setActive || clerkInstance?.setActive;
        if (result.createdSessionId && setActive) {
          await setActive({ session: result.createdSessionId });
          await navigateAfterClerkSession({
            signInResource: signInHook?.signIn,
            staySignedIn: staySignedIn,
          });
        } else {
          Alert.alert('Error', 'Sign in successful but session could not be created. Please try again.');
        }
      } else {
        Alert.alert('Error', 'Invalid verification code. Please try again.');
      }
    } catch (error: any) {
      console.error('Code verification error:', error);
      const errorMessage = error?.errors?.[0]?.message || error?.message || 'Invalid verification code. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignupCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (!isClerkEnabled || !signUpHook?.signUp) {
      Alert.alert('Error', 'Authentication service is not ready.');
      return;
    }

    const setActive = signInHook?.setActive || signUpHook.setActive || clerkInstance?.setActive;

    setLoading(true);
    try {
      const result = await signUpHook.signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (result.status === 'complete' && result.createdSessionId && setActive) {
        await setActive({ session: result.createdSessionId });
        setNeedsSignupEmailCode(false);
        setVerificationCode('');
        await navigateAfterClerkSession({
          signUpResource: signUpHook?.signUp,
          staySignedIn: true,
        });
      } else if (result.status === 'complete' && !result.createdSessionId) {
        Alert.alert(
          'Success',
          'Email verified. You can sign in now.',
          [{ text: 'OK', onPress: () => router.replace('/auth?mode=signin') }]
        );
        setNeedsSignupEmailCode(false);
        setVerificationCode('');
      } else {
        Alert.alert('Error', 'Could not complete sign up. Check the code and try again.');
      }
    } catch (error: any) {
      console.error('Sign-up code verification error:', error);
      const errorMessage =
        error?.errors?.[0]?.longMessage ||
        error?.errors?.[0]?.message ||
        error?.message ||
        'Invalid verification code. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const awaitingCode =
    (needsVerificationCode && !isSignup) || (needsSignupEmailCode && isSignup);
  const codeTooShort = verificationCode.trim().length < 6;

  return (
    <View style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            {...KEYBOARD_SCROLL_DEFAULTS}
          >
            {/* Top header – styled like the Dashboard title area */}
            <View style={[styles.headerRow, styles.wideContainer]}>
              {navigation.canGoBack() && (
                <TouchableOpacity
                  onPress={handleBack}
                  hitSlop={12}
                  style={styles.headerBackBtn}
                >
                  <MaterialIcons name="arrow-back-ios" size={18} color={darkMode ? "#FFFFFF" : Colors.text} />
                </TouchableOpacity>
              )}

              <View style={styles.headerTextBlock}>
                <Text style={styles.headerEyebrow}>
                  {isSignup ? t('auth.getStarted') : t('auth.welcomeBack')}
                </Text>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerTitle}>
                    {isSignup ? t('auth.createYour') : t('auth.signInTo')}
                  </Text>
                </View>
                <Text style={styles.headerTitleAccent}>
                  Build Profit Solutions
                </Text>
                <Text style={styles.headerSubtitle}>
                  {t('auth.subtitle')}
                </Text>
              </View>
            </View>

            {/* Card – mirrors your rounded dashboard surface */}
            <View style={styles.wideContainer}>
              <LinearGradient
                colors={["#2DFFC4", "#00A6FF"]}
                start={{ x: 0.05, y: 0.1 }}
                end={{ x: 0.95, y: 0.9 }}
                style={styles.cardBorder}
              >
            <View style={[styles.card, Colors.bg !== '#000000' && { backgroundColor: Colors.cardDark, borderColor: Colors.line, borderWidth: 1 }]}>
              {/* Mode toggle – visually echoes Overview / Analytics / Insights bar */}
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeChip, isSignup && styles.modeChipActive]}
                  onPress={() => {
                    if (!loading) {
                      setMode('signup');
                      setErrors({});
                      setTouched({});
                      setFormBanner(null);
                      setNeedsSignupEmailCode(false);
                      setNeedsVerificationCode(false);
                      setVerificationCode('');
                    }
                  }}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={14}
                    color={isSignup ? "#022C22" : (darkMode ? "#FFFFFF" : "#334155")}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.modeChipText,
                      isSignup && styles.modeChipTextActive,
                    ]}
                  >
                    {t('auth.createAccount')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeChip, !isSignup && styles.modeChipActive]}
                  onPress={() => {
                    if (!loading) {
                      setMode('signin');
                      setErrors({});
                      setTouched({});
                      setFormBanner(null);
                      setNeedsSignupEmailCode(false);
                      setNeedsVerificationCode(false);
                      setVerificationCode('');
                    }
                  }}
                >
                  <Ionicons
                    name="log-in-outline"
                    size={14}
                    color={!isSignup ? "#022C22" : (darkMode ? "#FFFFFF" : "#334155")}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.modeChipText,
                      !isSignup && styles.modeChipTextActive,
                    ]}
                  >
                    {t('auth.signIn')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Name fields (signup only) */}
              {isSignup && (
                <View style={styles.row}>
                  <View style={[styles.field, { marginRight: 8 }]}>
                    <Text style={styles.label}>{t('auth.firstName')}</Text>
                    <View style={[
                      styles.inputWrapper,
                      touched.firstName && errors.firstName && styles.inputError
                    ]}>
                      <TextInput
                        style={styles.input}
                        placeholder={t('auth.firstNamePlaceholder')}
                        placeholderTextColor={inputPlaceholderColor}
                        autoCapitalize="words"
                        value={firstName}
                        onChangeText={(text) => {
                          setFirstName(text);
                          if (touched.firstName) {
                            validateField('firstName', text);
                          }
                        }}
                        onBlur={() => {
                          setTouched(prev => ({ ...prev, firstName: true }));
                          validateField('firstName', firstName);
                        }}
                        editable={!loading}
                      />
                    </View>
                    {touched.firstName && errors.firstName && (
                      <Text style={styles.errorText}>{errors.firstName}</Text>
                    )}
                  </View>

                  <View style={[styles.field, { marginLeft: 8 }]}>
                    <Text style={styles.label}>{t('auth.lastName')}</Text>
                    <View style={[
                      styles.inputWrapper,
                      touched.lastName && errors.lastName && styles.inputError
                    ]}>
                      <TextInput
                        style={styles.input}
                        placeholder={t('auth.lastNamePlaceholder')}
                        placeholderTextColor={inputPlaceholderColor}
                        autoCapitalize="words"
                        value={lastName}
                        onChangeText={(text) => {
                          setLastName(text);
                          if (touched.lastName) {
                            validateField('lastName', text);
                          }
                        }}
                        onBlur={() => {
                          setTouched(prev => ({ ...prev, lastName: true }));
                          validateField('lastName', lastName);
                        }}
                        editable={!loading}
                      />
                    </View>
                    {touched.lastName && errors.lastName && (
                      <Text style={styles.errorText}>{errors.lastName}</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Email */}
              <View style={styles.field}>
                <Text style={styles.label}>{t('auth.email')}</Text>
                <View style={[
                  styles.inputWrapper,
                  touched.email && errors.email && styles.inputError
                ]}>
                  <TextInput
                    style={styles.input}
                    placeholder="you@company.com"
                    placeholderTextColor={inputPlaceholderColor}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (touched.email) {
                        validateField('email', text);
                      }
                    }}
                    onBlur={() => {
                      setTouched(prev => ({ ...prev, email: true }));
                      validateField('email', email);
                    }}
                    editable={!loading}
                  />
                </View>
                {touched.email && errors.email && (
                  <Text style={styles.errorText}>{errors.email}</Text>
                )}
              </View>

              {/* Password */}
              <View style={styles.field}>
                <Text style={styles.label}>{t('auth.password')}</Text>
                <View style={[
                  styles.inputWrapper,
                  touched.password && errors.password && styles.inputError
                ]}>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={inputPlaceholderColor}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (touched.password) {
                        validateField('password', text);
                      }
                    }}
                    onBlur={() => {
                      setTouched(prev => ({ ...prev, password: true }));
                      validateField('password', password);
                    }}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialIcons
                      name={showPassword ? "visibility" : "visibility-off"}
                      size={20}
                      color={darkMode ? '#FFFFFF' : '#64748B'}
                    />
                  </TouchableOpacity>
                </View>
                {touched.password && errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              {/* Confirm password (signup only) */}
              {isSignup && (
                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
                  <View style={[
                    styles.inputWrapper,
                    touched.confirmPassword && errors.confirmPassword && styles.inputError
                  ]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Repeat password"
                      placeholderTextColor={inputPlaceholderColor}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (touched.confirmPassword) {
                          validateField('confirmPassword', text);
                        }
                      }}
                      onBlur={() => {
                        setTouched(prev => ({ ...prev, confirmPassword: true }));
                        validateField('confirmPassword', confirmPassword);
                      }}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword((prev) => !prev)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons
                        name={showConfirmPassword ? "visibility" : "visibility-off"}
                        size={20}
                        color={darkMode ? '#FFFFFF' : '#64748B'}
                      />
                    </TouchableOpacity>
                  </View>
                  {touched.confirmPassword && errors.confirmPassword && (
                    <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                  )}
                  {touched.confirmPassword && !errors.confirmPassword && confirmPassword && password === confirmPassword && (
                    <Text style={styles.successText}>✓ Passwords match</Text>
                  )}
                </View>
              )}

              {/* Password strength (signup only) */}
              {isSignup && password && passwordStrength && (
                <View style={styles.strengthRow}>
                  <View
                    style={[
                      styles.strengthBar,
                      passwordStrength.score >= 1 && styles.strengthBarActive,
                    ]}
                  />
                  <View
                    style={[
                      styles.strengthBar,
                      passwordStrength.score >= 2 && styles.strengthBarActive,
                    ]}
                  />
                  <View
                    style={[
                      styles.strengthBar,
                      passwordStrength.score >= 3 && styles.strengthBarActive,
                    ]}
                  />
                  <View
                    style={[
                      styles.strengthBar,
                      passwordStrength.score >= 4 && styles.strengthBarActive,
                    ]}
                  />
                  <Text style={styles.strengthText}>
                    {passwordStrength.strength === "weak"
                      ? t('auth.weakPassword')
                      : passwordStrength.strength === "medium"
                      ? t('auth.goodPassword')
                      : t('auth.strongPassword')}
                  </Text>
                </View>
              )}

              {/* Email code: sign-in 2FA or sign-up verification */}
              {awaitingCode && (
                <View style={styles.field}>
                  <Text style={styles.label}>Verification Code</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={inputPlaceholderColor}
                      keyboardType="phone-pad"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      editable={!loading}
                      autoFocus
                      maxLength={6}
                    />
                  </View>
                  <Text style={styles.helperText}>
                    {needsSignupEmailCode
                      ? 'Enter the code we emailed you to finish creating your account.'
                      : 'Check your email for the verification code to sign in.'}
                  </Text>
                </View>
              )}

              {/* Forgot password (signin only, not while entering 2FA code) */}
              {!isSignup && !needsVerificationCode && (
                <TouchableOpacity
                  style={styles.forgotRow}
                  onPress={() => router.push('/auth/forgot-password')}
                  disabled={loading}
                >
                  <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
                </TouchableOpacity>
              )}

              {!isSignup && !needsVerificationCode && (
                <View style={styles.staySignedInRow}>
                  <Switch
                    value={staySignedIn}
                    onValueChange={(v) => {
                      setStaySignedIn(v);
                      void setStaySignedInPreference(v);
                    }}
                    disabled={loading}
                    trackColor={{ false: '#64748B', true: 'rgba(34, 197, 94, 0.45)' }}
                    thumbColor={staySignedIn ? '#22c55e' : '#f4f4f5'}
                    ios_backgroundColor="#64748B"
                  />
                  <Text style={styles.staySignedInLabel}>{t('auth.staySignedIn')}</Text>
                </View>
              )}

              {formBanner ? (
                <View style={styles.formBanner}>
                  <Text style={styles.formBannerText}>{formBanner}</Text>
                </View>
              ) : null}

              {/* Primary CTA */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.primaryBtnWrapper,
                  (loading || (awaitingCode && codeTooShort)) && styles.primaryBtnWrapperDisabled,
                  Platform.OS === 'web' && styles.primaryBtnWrapperWeb,
                ]}
                onPress={
                  awaitingCode
                    ? isSignup
                      ? handleVerifySignupCode
                      : handleVerifyCode
                    : handleSubmit
                }
                disabled={loading || (awaitingCode && codeTooShort)}
                accessibilityRole="button"
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={["#19E180", "#22c55e"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  {loading ? (
                    <ActivityIndicator color="#022C22" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {awaitingCode
                        ? 'Verify code'
                        : isSignup
                          ? t('auth.createAccount')
                          : t('auth.signIn')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* OAuth (OAuthButtons includes the OR divider) */}
              {isClerkEnabled && (
                <>
                  <OAuthButtons
                    onGooglePress={handleGoogleSignIn}
                    onApplePress={handleAppleSignIn}
                    loading={loading}
                  />
                </>
              )}

              {/* Terms and Privacy (only for signup) */}
              {isSignup && (
                <View style={styles.termsRow}>
                  <Text style={styles.termsText}>
                    By creating an account, you agree to our{' '}
                    <Text style={styles.termsLink} onPress={() => router.push('/legal-hub?tab=terms')}>
                      Terms of Service
                    </Text>
                    {' '}and{' '}
                    <Text style={styles.termsLink} onPress={() => router.push('/legal-hub?tab=privacy')}>
                      Privacy Policy
                    </Text>
                  </Text>
                </View>
              )}

              {/* Bottom text – matches dashboard typography / green accent */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>
                  {isSignup
                    ? t('auth.alreadyHaveAccount')
                    : t('auth.dontHaveAccount')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!loading) {
                      setMode(isSignup ? 'signin' : 'signup');
                      // Clear form when switching modes
                      setEmail('');
                      setPassword('');
                      setConfirmPassword('');
                      setFirstName('');
                      setLastName('');
                      setErrors({});
                      setTouched({});
                      setShowPassword(false);
                      setShowConfirmPassword(false);
                    }
                  }}
                  disabled={loading}
                >
                  <Text style={styles.footerLink}>
                    {isSignup ? ` ${t('auth.signIn')}` : ` ${t('auth.createAccount')}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const getStyles = (Colors: any, isDark: boolean, windowWidth: number) => {
  const wideWeb =
    Platform.OS === "web" && windowWidth >= WEB_CENTERED_COLUMN_MIN_WIDTH;

  return StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: wideWeb ? 24 : 20,
    paddingBottom: 24,
    paddingTop: wideWeb ? 12 : 0,
    justifyContent: wideWeb ? "flex-start" : "flex-end",
  },
  wideContainer: {
    ...(wideWeb
      ? {
          marginHorizontal: 0,
          paddingHorizontal: 0,
          maxWidth: WEB_CENTERED_COLUMN_MAX_WIDTH,
          alignSelf: "center" as const,
          width: "100%",
        }
      : {
          marginHorizontal: -20,
          paddingHorizontal: 8,
        }),
  },
  headerRow: {
    marginBottom: wideWeb ? 14 : 18,
    ...(wideWeb ? { alignItems: "center" as const } : {}),
  },
  headerBackBtn: {
    marginBottom: 8,
    ...(wideWeb ? { alignSelf: "flex-start" as const } : {}),
  },
  headerTextBlock: {
    marginTop: 8,
    ...(wideWeb
      ? {
          alignItems: "center" as const,
          alignSelf: "center" as const,
          width: "100%",
          maxWidth: 560,
        }
      : {}),
  },
  headerEyebrow: {
    color: "#19E180",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
    ...(wideWeb ? { textAlign: "center" as const, alignSelf: "stretch" as const } : {}),
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    ...(wideWeb ? { justifyContent: "center" as const, alignSelf: "stretch" as const } : {}),
  },
  headerTitle: {
    color: isDark ? "#F9FAFB" : Colors.text,
    fontSize: 28,
    fontWeight: "800",
    ...(wideWeb ? { textAlign: "center" as const } : {}),
  },
  headerTitleAccent: {
    color: "#19E180",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 1,
    ...(wideWeb ? { textAlign: "center" as const, alignSelf: "stretch" as const } : {}),
  },
  headerSubtitle: {
    color: isDark ? "#FFFFFF" : "#475569",
    fontSize: 13,
    marginTop: 6,
    ...(wideWeb ? { textAlign: "center" as const, alignSelf: "stretch" as const } : {}),
  },
  cardBorder: {
    borderRadius: 30,
    padding: 1,
    shadowColor: isDark ? '#00A6FF' : "transparent",
    shadowOpacity: isDark ? 0.16 : 0,
    shadowRadius: isDark ? 14 : 0,
    shadowOffset: { width: 0, height: isDark ? 10 : 0 },
    elevation: isDark ? 12 : 0,
    borderWidth: isDark ? 0 : 1,
    borderColor: isDark ? "transparent" : "#E2E8F0",
  },
  card: {
    backgroundColor: isDark ? "#000000" : "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: wideWeb ? 20 : 18,
    paddingVertical: wideWeb ? 18 : 20,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: isDark ? "#000000" : "#F1F5F9",
    borderRadius: 999,
    padding: 4,
    borderWidth: isDark ? 1 : 1,
    borderColor: isDark ? "rgba(55, 65, 81, 0.9)" : "#E2E8F0",
    marginBottom: 18,
  },
  modeChip: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  modeChipActive: {
    backgroundColor: "#19E180",
    shadowColor: "#19E180",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  modeChipText: {
    color: isDark ? "#FFFFFF" : "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  modeChipTextActive: {
    color: "#022C22",
  },
  row: {
    flexDirection: "row",
  },
  field: {
    marginBottom: 12,
    flex: 1,
  },
  label: {
    color: isDark ? "#FFFFFF" : "#0F172A",
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "600", // Increased from 500
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: isDark ? "#000000" : "#FFFFFF",
    borderWidth: 1,
    borderColor: isDark ? "#FFFFFF" : "#E2E8F0",
  },
  input: {
    flex: 1,
    color: isDark ? "#FFFFFF" : Colors.text,
    fontSize: 15,
  },
  inputError: {
    borderColor: "#ef4444",
    borderWidth: 1.5,
  },
  errorText: {
    color: "#F97373",
    fontSize: 12,
    marginTop: 4,
  },
  successText: {
    fontSize: 12,
    color: "#10b981",
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: isDark ? "#F3F4F6" : "#475569",
    marginTop: 4,
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: isDark ? "rgba(55,65,81,0.7)" : "#E2E8F0",
    marginRight: 4,
  },
  strengthBarActive: {
    backgroundColor: "#22C55E",
  },
  strengthText: {
    color: isDark ? "#FFFFFF" : "#475569",
    fontSize: 11,
    marginLeft: 8,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginTop: 4,
    marginBottom: 6,
  },
  forgotText: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "500",
  },
  staySignedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  staySignedInLabel: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: isDark ? '#F3F4F6' : '#475569',
  },
  formBanner: {
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  formBannerText: {
    color: isDark ? '#FCA5A5' : '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  primaryBtnWrapper: {
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
  },
  primaryBtnWrapperWeb: {
    cursor: 'pointer' as const,
  },
  primaryBtnWrapperDisabled: {
    opacity: 0.6,
  },
  primaryBtn: {
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryBtnText: {
    color: "#022C22",
    fontSize: 16,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
  },
  footerText: {
    color: isDark ? "#FFFFFF" : "#475569",
    fontSize: 13,
  },
  footerLink: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "600",
  },
  termsRow: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  termsText: {
    fontSize: 11,
    color: isDark ? "#F3F4F6" : "#475569",
    textAlign: "center",
    lineHeight: 16,
  },
  termsLink: {
    color: "#22C55E",
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});
};

export default function AuthScreenRouter() {
  const isClerkEnabled = isClerkPublishableKeyConfigured();
  if (isClerkEnabled) {
    return <AuthScreenClerk />;
  }
  return <AuthScreen authUiReady />;
}

function AuthScreenClerk() {
  const { uiReady } = useClerkUiReady();
  return <AuthScreen authUiReady={uiReady} />;
}


