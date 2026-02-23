import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { clerkAuthService } from '@/services/clerkAuth';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { OAuthButtons } from '@/components/OAuthButtons';
import { useClerk, useAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

// Complete OAuth sessions properly
WebBrowser.maybeCompleteAuthSession();

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

const AuthScreen: React.FC = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
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
  const [verificationCode, setVerificationCode] = useState('');

  const isSignup = mode === 'signup';
  const passwordStrength = isSignup && password ? getPasswordStrength(password) : null;

  // Check if Clerk is available (for showing OAuth buttons)
  const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkEnabled = publishableKey && (publishableKey.startsWith('pk_live_') || (publishableKey.startsWith('pk_test_') && publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk'));

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
    clerkInstance = useClerk();
    clerkAuth = useAuth();
    
    // Get signIn and signUp hooks for email/password authentication
    // These hooks must be called unconditionally (React hooks rule)
    try {
      signInHook = useSignIn();
      signUpHook = useSignUp();
    } catch (e) {
      console.log('useSignIn/useSignUp hooks not available:', e);
    }
  } catch (e) {
    // Not in ClerkProvider - that's okay, we'll handle it in the handlers
    console.log('useClerk/useAuth hooks not available');
  }

  // OAuth handlers - receive OAuth objects from OAuthButtons component
  const handleGoogleSignIn = async (googleOAuthHandler: any, clerkSetActiveHandler: any) => {
    try {
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
      await WebBrowser.warmUpAsync();
      
      // Let Clerk handle the redirect URL automatically
      const result = await googleOAuthHandler.startOAuthFlow();
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
        
        // Check if this might be a network error (empty result after network failure)
        // If we got here, it means startOAuthFlow didn't throw, but returned empty
        // This could be a network issue that Clerk handled silently
        Alert.alert(
          'Sign-In Failed',
          'Google sign-in could not complete. This is usually caused by:\n\n1. ❌ No internet connection\n2. ❌ Network connectivity issues\n3. ❌ Firewall/VPN blocking Clerk servers\n\nPlease check your internet connection and try again.',
          [{ text: 'OK' }]
        );
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
          router.replace('/(tabs)/dashboard');
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
          router.replace('/(tabs)/dashboard');
          setLoading(false);
          return;
        } catch (setActiveError: any) {
          console.error('Failed to set active session:', setActiveError);
          // Check if user is actually signed in despite the error
          const isActuallySignedIn = clerkAuth?.isSignedIn === true && clerkAuth?.isLoaded === true;
          if (isActuallySignedIn) {
            console.log('User is signed in despite setActive error, navigating...');
            router.replace('/(tabs)/dashboard');
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
      
      // Extract error details - try multiple ways to get error info
      const errorCode = error?.error?.errors?.[0]?.code || error?.code || error?.error?.code;
      const errorStatus = error?.error?.status || error?.status || error?.statusCode || (error?.toString?.()?.match(/Status: (\d+)/)?.[1] ? parseInt(error.toString().match(/Status: (\d+)/)?.[1] || '0') : null);
      const clerkErrorMessage = error?.error?.errors?.[0]?.message || error?.message || error?.error?.message || '';
      const errorResponse = error?.response || error?.data || error?.error;
      
      // Try to extract error code from serialized error string
      let extractedErrorCode = errorCode;
      const errorString = String(error);
      if (errorString.includes('session_exists')) {
        extractedErrorCode = 'session_exists';
      } else if (errorString.includes('Serialized errors')) {
        // Try to parse the serialized errors JSON
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
        const isActuallySignedIn = clerkAuth?.isSignedIn === true && clerkAuth?.isLoaded === true;
        
        if (isActuallySignedIn) {
          // User is already signed in - silently navigate, no error needed
          console.log('User already signed in, navigating to app...');
          router.replace('/(tabs)/dashboard');
          return;
        } else {
          // User is NOT signed in, but getting session_exists error
          // This means there's a stale session or OAuth isn't configured properly
          console.log('Session exists error but user is NOT signed in. This suggests OAuth configuration issue.');
          Alert.alert(
            'Sign-In Error',
            'Google Sign-In encountered an issue. This usually means:\n\n1. Google OAuth is not properly configured in Clerk\n2. There\'s a stale session that needs to be cleared\n\nPlease check your Clerk dashboard to ensure Google OAuth is enabled and configured correctly.\n\nSee GOOGLE_OAUTH_SETUP.md for instructions.',
            [{ text: 'OK' }]
          );
          return;
        }
      }
      
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

      await WebBrowser.warmUpAsync();

      const result = await appleOAuthHandler.startOAuthFlow();
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

      if (sessionId && setActive) {
        console.log('Apple OAuth successful, setting active session...');
        await setActive({ session: sessionId });
        console.log('Session set, navigating to app...');
        router.replace('/(tabs)/dashboard');
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
        const isActuallySignedIn = clerkAuth?.isSignedIn === true && clerkAuth?.isLoaded === true;
        
        if (isActuallySignedIn) {
          // User is already signed in - silently navigate, no error needed
          console.log('User already signed in, navigating to app...');
          router.replace('/(tabs)/dashboard');
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

  // Validation helper
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
          // Password strength is just informational, not blocking
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

  const handleSubmit = async () => {
    // Mark all fields as touched
    const fieldsToValidate = isSignup 
      ? ['email', 'password', 'confirmPassword', 'firstName', 'lastName']
      : ['email', 'password'];
    
    fieldsToValidate.forEach(field => {
      setTouched(prev => ({ ...prev, [field]: true }));
    });

    // Validate all fields
    let isValid = true;
    if (isSignup) {
      isValid = validateField('firstName', firstName) && 
                validateField('lastName', lastName) &&
                validateField('email', email) &&
                validateField('password', password) &&
                validateField('confirmPassword', confirmPassword);
    } else {
      isValid = validateField('email', email) && validateField('password', password);
    }

    if (!isValid) {
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
              router.replace('/(tabs)/dashboard');
            } else {
              Alert.alert('Success', 'Account created successfully! Please check your email to verify your account.', [
                {
                  text: 'OK',
                  onPress: () => router.replace('/auth?mode=signin'),
                },
              ]);
            }
          } else {
            // Need to verify email
            Alert.alert('Verify Email', 'Please check your email to verify your account before signing in.');
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
              router.replace('/(tabs)/dashboard');
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
      console.error('Auth error:', error);
      console.error('Auth error details:', JSON.stringify(error, null, 2));
      
      // Extract error message from Clerk error format
      let errorMessage = 'An error occurred. Please try again.';
      
      if (error?.errors && Array.isArray(error.errors) && error.errors.length > 0) {
        errorMessage = error.errors[0].message || error.errors[0].longMessage || errorMessage;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Provide more helpful error messages
      if (errorMessage.includes('password') || errorMessage.includes('Password')) {
        errorMessage = 'Invalid email or password. Please try again.';
      } else if (errorMessage.includes('email') || errorMessage.includes('Email')) {
        errorMessage = 'Invalid email address. Please check and try again.';
      } else if (!errorMessage || errorMessage === 'An error occurred. Please try again.') {
        errorMessage = isSignup ? 'Failed to create account. Please try again.' : 'Invalid email or password. Please try again.';
      }
      
      Alert.alert('Error', errorMessage);
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
          router.replace('/(tabs)/dashboard');
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

  return (
    <View style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Top header – styled like the Dashboard title area */}
            <View style={[styles.headerRow, styles.wideContainer]}>
              {navigation.canGoBack() && (
                <TouchableOpacity onPress={handleBack} hitSlop={12} style={{ marginBottom: 8 }}>
                  <MaterialIcons name="arrow-back-ios" size={18} color={Colors.bg === '#000000' ? "#E5E7EB" : Colors.text} />
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
            <View style={[styles.card, Colors.bg !== '#000000' && { backgroundColor: Colors.bg }]}>
              {/* Mode toggle – visually echoes Overview / Analytics / Insights bar */}
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeChip, isSignup && styles.modeChipActive]}
                  onPress={() => {
                    if (!loading) {
                      setMode('signup');
                      setErrors({});
                      setTouched({});
                    }
                  }}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={14}
                    color={isSignup ? "#022C22" : (Colors.bg === '#000000' ? "#9CA3AF" : "#334155")}
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
                    }
                  }}
                >
                  <Ionicons
                    name="log-in-outline"
                    size={14}
                    color={!isSignup ? "#022C22" : (Colors.bg === '#000000' ? "#9CA3AF" : "#334155")}
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
                        placeholder="Nick"
                        placeholderTextColor="#6B7280"
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
                        placeholder="Lafontaine"
                        placeholderTextColor="#6B7280"
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
                    placeholderTextColor="#6B7280"
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
                    placeholderTextColor="#6B7280"
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
                      color="#6B7280"
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
                      placeholderTextColor="#6B7280"
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
                        color="#6B7280"
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

              {/* Verification Code Input (shown when needs_second_factor) */}
              {needsVerificationCode && !isSignup && (
                <View style={styles.field}>
                  <Text style={styles.label}>Verification Code</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor="#6B7280"
                      keyboardType="number-pad"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      editable={!loading}
                      autoFocus
                      maxLength={6}
                    />
                  </View>
                  <Text style={styles.helperText}>
                    Check your email for the verification code
                  </Text>
                </View>
              )}

              {/* Forgot password (signin only) */}
              {!isSignup && (
                <TouchableOpacity
                  style={styles.forgotRow}
                  onPress={() => router.push('/auth/forgot-password')}
                  disabled={loading}
                >
                  <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
                </TouchableOpacity>
              )}

              {/* Primary CTA */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.primaryBtnWrapper,
                  (loading || (needsVerificationCode && verificationCode.length < 6)) && styles.primaryBtnWrapperDisabled
                ]}
                onPress={needsVerificationCode && !isSignup ? handleVerifyCode : handleSubmit}
                disabled={loading || (needsVerificationCode && verificationCode.length < 6)}
              >
                <LinearGradient
                  colors={["#19E180", "#22c55e"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  {loading ? (
                    <ActivityIndicator color="#022C22" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {isSignup ? t('auth.createAccount') : t('auth.signIn')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider + OAuth */}
              {isClerkEnabled && (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.divider} />
                  </View>

                  {/* OAuth buttons */}
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

const getStyles = (Colors: any) => StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
    justifyContent: "flex-end",
  },
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 8,
  },
  headerRow: {
    marginBottom: 18,
  },
  headerTextBlock: {
    marginTop: 8,
  },
  headerEyebrow: {
    color: "#19E180",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  headerTitle: {
    color: Colors.bg === '#000000' ? "#F9FAFB" : Colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  headerTitleAccent: {
    color: "#19E180",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 1,
  },
  headerSubtitle: {
    color: Colors.bg === '#000000' ? "#9CA3AF" : "#475569",
    fontSize: 13,
    marginTop: 6,
  },
  cardBorder: {
    borderRadius: 30,
    padding: 1,
    shadowColor: Colors.bg === '#000000' ? '#00A6FF' : "transparent",
    shadowOpacity: Colors.bg === '#000000' ? 0.16 : 0,
    shadowRadius: Colors.bg === '#000000' ? 14 : 0,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 10 : 0 },
    elevation: Colors.bg === '#000000' ? 12 : 0,
    borderWidth: Colors.bg === '#000000' ? 0 : 1,
    borderColor: Colors.bg === '#000000' ? "transparent" : "#E2E8F0",
  },
  card: {
    backgroundColor: Colors.bg === '#000000' ? "#000000" : "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: Colors.bg === '#000000' ? "#000000" : "#F1F5F9",
    borderRadius: 999,
    padding: 4,
    borderWidth: Colors.bg === '#000000' ? 1 : 1,
    borderColor: Colors.bg === '#000000' ? "rgba(55, 65, 81, 0.9)" : "#E2E8F0",
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
    color: Colors.bg === '#000000' ? "#9CA3AF" : "#334155",
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
    color: Colors.bg === '#000000' ? "#E5E7EB" : "#0F172A",
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
    backgroundColor: Colors.bg === '#000000' ? "#000000" : "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.bg === '#000000' ? "rgba(148,163,184,0.9)" : "#E2E8F0",
  },
  input: {
    flex: 1,
    color: Colors.bg === '#000000' ? "#F9FAFB" : Colors.text,
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
    color: Colors.bg === '#000000' ? "#6B7280" : "#475569",
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
    backgroundColor: Colors.bg === '#000000' ? "rgba(55,65,81,0.7)" : "#E2E8F0",
    marginRight: 4,
  },
  strengthBarActive: {
    backgroundColor: "#22C55E",
  },
  strengthText: {
    color: Colors.bg === '#000000' ? "#9CA3AF" : "#475569",
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
  primaryBtnWrapper: {
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
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
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.bg === '#000000' ? "#374151" : Colors.line,
  },
  dividerText: {
    marginHorizontal: 10,
    color: Colors.bg === '#000000' ? "#6B7280" : "#475569",
    fontSize: 12,
    fontWeight: "500",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
  },
  footerText: {
    color: Colors.bg === '#000000' ? "#9CA3AF" : "#475569",
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
    color: Colors.bg === '#000000' ? "#6B7280" : "#475569",
    textAlign: "center",
    lineHeight: 16,
  },
  termsLink: {
    color: "#22C55E",
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});

export default AuthScreen;


