import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProjectProvider } from '../contexts/ProjectContext';
import { ProjectListProvider } from '../contexts/ProjectListContext';
import { ApiProvider } from '../contexts/ApiContext';
import { UserRoleProvider } from '../contexts/UserRoleContext';
import { ChatProvider } from '../contexts/ChatContext';
import React, { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { useFonts as useMontserrat, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { useFonts as useSaira, Saira_400Regular } from '@expo-google-fonts/saira';
import { View, Text, Platform, Keyboard, type StyleProp, type ViewStyle } from 'react-native';
import KeyboardDoneBar from '../components/KeyboardDoneBar';
import { KEYBOARD_ACCESSORY_IDS } from '../constants/keyboard';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import ErrorBoundary from '../components/ErrorBoundary';
import notificationService from '../services/notificationService';
import { NotificationProvider } from '../contexts/NotificationContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { useUserRole } from '../contexts/UserRoleContext';
import { useAuth, useUser } from '@clerk/clerk-react';
import ClerkWebBootstrap from '../components/ClerkWebBootstrap';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { clerkAuthService } from '../services/clerkAuth';
import { syncClerkTokenToAsyncStorage } from '../utils/authTokenHelper';
import {
  WalkthroughStateProvider,
  WalkthroughStateProviderLegacy,
  useWalkthroughState,
} from '../contexts/WalkthroughStateContext';
import '../i18n/config'; // Initialize i18n
import { BetaFeedbackProvider } from '../contexts/BetaFeedbackContext';
import ClerkVendorDirectoryWrapper from '../components/ClerkVendorDirectoryWrapper';
import { VendorDirectoryProviderLocal } from '../contexts/VendorDirectoryContext';
import { ClerkUiProvider } from '../contexts/ClerkUiContext';
import { getClerkPublishableKey } from '../lib/clerkPublishableKey';

/** RN-web: avoid short viewport / rubber-band glitches when the shell does not fill the window. */
const gestureHandlerRootStyle: StyleProp<ViewStyle> =
  Platform.OS === 'web'
    ? ({ flex: 1, minHeight: '100vh' } as ViewStyle)
    : { flex: 1 };

// Component to apply theme-aware styling and StatusBar
function ThemeAwareLayout({ children }: { children: React.ReactNode }) {
  const { darkMode, theme } = useTheme();
  
  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? '#0b1c38' : '#f5f7fa' }}>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      {Platform.OS === 'ios' ? (
        <KeyboardDoneBar
          inputAccessoryViewID={KEYBOARD_ACCESSORY_IDS.bpsKeyboardDone}
          onDone={() => Keyboard.dismiss()}
        />
      ) : null}
      {children}
    </View>
  );
}

function AuthGateWithClerk() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const { userRole, isLoading } = useUserRole();
  const {
    hydrated: wtHydrated,
    shouldShowAppOnboarding,
  } = useWalkthroughState();

  // IMPORTANT: All hooks must be declared BEFORE any conditional returns
  // Check if profile setup is needed
  const [needsProfileSetup, setNeedsProfileSetup] = useState<boolean | null>(null);
  // Timeout for Clerk loading
  const [clerkTimeout, setClerkTimeout] = useState(false);

  // Initialize notification service
  useEffect(() => {
    notificationService.initialize();
  }, []);

  // Add timeout for Clerk loading (prevent infinite loading)
  useEffect(() => {
    if (!isLoaded) {
      const timeout = setTimeout(() => {
        console.warn('Clerk loading timeout - proceeding anyway');
        setClerkTimeout(true);
      }, 10000); // 10 second timeout for Clerk
      
      return () => clearTimeout(timeout);
    } else {
      setClerkTimeout(false);
    }
  }, [isLoaded]);

  // Check profile completeness (only when authenticated)
  useEffect(() => {
    const checkProfileCompleteness = async () => {
      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        console.warn('Profile check timeout - defaulting to Clerk name check only');
        setNeedsProfileSetup(!(user?.firstName && user?.lastName));
      }, 3000); // 3 second timeout

      try {
        // Check Clerk user data
        const hasClerkName = !!(user?.firstName && user?.lastName);
        
        // Check contractor profile in AsyncStorage with timeout
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const contractorProfileData = await Promise.race([
          AsyncStorage.getItem('bps.contractorProfile'),
          new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 2000))
        ]);
        
        clearTimeout(timeoutId);
        
        let hasContractorProfile = false;
        let hasName = false;
        let hasCompany = false;

        if (contractorProfileData) {
          try {
            const profile = JSON.parse(contractorProfileData);
            hasName = !!(profile.name && profile.name.trim());
            hasCompany = !!(profile.company && profile.company.trim());
            hasContractorProfile = hasName && hasCompany;
          } catch (parseError) {
            console.warn('Error parsing contractor profile:', parseError);
          }
        }

        // Show profile setup if:
        // 1. Missing Clerk firstName/lastName (for new users who signed up without providing them)
        // 2. Missing contractor profile completely (new users who haven't completed setup)
        // 3. Missing name or company in contractor profile (existing users with incomplete profiles)
        const needsSetup = !hasClerkName || !hasContractorProfile;
        
        console.log('AuthGate - Profile check:', {
          hasClerkName,
          hasName,
          hasCompany,
          hasContractorProfile,
          needsSetup,
          message: needsSetup 
            ? 'Profile setup required - will show profile setup screen' 
            : 'Profile complete - proceeding to app'
        });
        
        setNeedsProfileSetup(needsSetup);
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Error checking profile completeness:', error);
        // If there's an error, only check Clerk name
        setNeedsProfileSetup(!(user?.firstName && user?.lastName));
      }
    };

    if (isSignedIn && user) {
      checkProfileCompleteness();
    } else {
      // Reset when not signed in
      setNeedsProfileSetup(null);
    }
  }, [isSignedIn, user, user?.firstName, user?.lastName]);

  // Keep API token storage in sync with active Clerk session.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        await syncClerkTokenToAsyncStorage(token);
      } catch (error) {
        console.warn('AuthGate - token sync failed:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  // Debug logging
  console.log('AuthGate - isLoaded:', isLoaded, 'isSignedIn:', isSignedIn, 'user:', !!user, 'userId:', user?.id);

  // Show loading while Clerk is initializing and restoring session
  // This is critical - we must wait for Clerk to check SecureStore for existing session
  // But add timeout to prevent infinite loading
  if (!isLoaded && !clerkTimeout) {
    console.log('AuthGate - Clerk is loading, waiting for session restoration...');
    return (
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="loading" />
        <Stack.Screen name="oauth-native-callback" />
      </Stack>
    );
  }
  
  // If Clerk timed out, proceed anyway (might be network issue)
  if (!isLoaded && clerkTimeout) {
    console.warn('AuthGate - Clerk loading timed out, showing auth screens anyway');
    return (
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} initialRouteName="index">
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="auth/forgot-password" />
        <Stack.Screen name="oauth-native-callback" />
      </Stack>
    );
  }

  // Truly signed out → landing + auth
  if (!isSignedIn) {
    console.log('AuthGate - Not signed in, showing landing + auth screens');
    return (
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} initialRouteName="index">
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="auth/forgot-password" />
        <Stack.Screen name="oauth-native-callback" />
      </Stack>
    );
  }

  // Session exists but Clerk user object not ready yet — do NOT show sign-in (Clerk returns session_exists)
  if (!user) {
    console.log('AuthGate - Session active, waiting for Clerk user...');
    return (
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="loading" />
        <Stack.Screen name="oauth-native-callback" />
      </Stack>
    );
  }

  // Wait for profile + walkthrough hydration
  if (needsProfileSetup === null || !wtHydrated) {
    console.log('AuthGate - Checking profile and/or walkthrough state...');
    return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="loading" />
    </Stack>;
  }

  // Flow: sign in → onboarding (first-time) → profile setup (if needed) → role → main app
  if (shouldShowAppOnboarding) {
    console.log('AuthGate - Showing onboarding');
    return (
      <Stack
        screenOptions={{ headerShown: false, gestureEnabled: false }}
        initialRouteName="onboarding"
      >
        <Stack.Screen name="onboarding" />
      </Stack>
    );
  }

  if (needsProfileSetup === true) {
    console.log('AuthGate - Showing profile setup (missing profile information)');
    return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="auth/profile-setup" />
    </Stack>;
  }

  if (isLoading) {
    console.log('AuthGate - Showing loading for user role');
    return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="loading" />
    </Stack>;
  }

  if (!userRole) {
    console.log('AuthGate - Showing role selection');
    return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="role-selection" />
    </Stack>;
  }

  // Signed-in returning users always land on the marketing homepage (`index`). Get Started → app
  // (skip sign-in only when “stay signed in” is on) is handled in `landing.tsx`.
  console.log('AuthGate - Showing main app shell (homepage first)');
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} initialRouteName="index" />
  );
}

function AuthGateWithoutClerk() {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const {
    hydrated: wtHydrated,
    shouldShowAppOnboarding,
  } = useWalkthroughState();

  // Initialize notification service
  useEffect(() => {
    notificationService.initialize();
  }, []);

  // Check authentication state on mount and listen for changes
  useEffect(() => {
    // Initial check
    const checkAuth = () => {
      const authState = clerkAuthService.getAuthState();
      setIsAuthenticated(authState.isAuthenticated);
      setIsLoading(authState.loading);
    };

    checkAuth();

    // Listen for auth state changes
    const unsubscribe = clerkAuthService.addListener((authState) => {
      setIsAuthenticated(authState.isAuthenticated);
      setIsLoading(authState.loading);
    });

    return unsubscribe;
  }, []);

  // Show loading while checking auth state
  if (isLoading || isAuthenticated === null) {
    console.log('AuthGate - Checking authentication state...');
    return (
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="loading" />
      </Stack>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    console.log('AuthGate - User not authenticated, showing auth screen');
    return (
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} initialRouteName="index">
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="auth/forgot-password" />
      </Stack>
    );
  }

  if (!wtHydrated) {
    console.log('AuthGate - Waiting for walkthrough state...');
    return (
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="loading" />
      </Stack>
    );
  }

  if (shouldShowAppOnboarding) {
    console.log('AuthGate - Showing onboarding');
    return (
      <Stack
        screenOptions={{ headerShown: false, gestureEnabled: false }}
        initialRouteName="onboarding"
      >
        <Stack.Screen name="onboarding" />
      </Stack>
    );
  }

  console.log('AuthGate - User authenticated, main app (homepage first)');
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} initialRouteName="index" />
  );
}

// Wrapper that chooses the right AuthGate
function AuthGate({ useClerk }: { useClerk: boolean }) {
  if (useClerk) {
    return <AuthGateWithClerk />;
  }
  return <AuthGateWithoutClerk />;
}

export default function RootLayout() {
  const [montserratLoaded] = useMontserrat({ Montserrat_700Bold });
  const [sairaLoaded] = useSaira({ Saira_400Regular });
  const fontsLoaded = montserratLoaded && sairaLoaded;

  if (!fontsLoaded) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0b1c38' }}><Text style={{ color: '#fff' }}>Loading...</Text></View>;
  }

  // Same resolution as `isClerkEnabled()` / landing (web-safe extras + manifest fallbacks).
  const publishableKey = getClerkPublishableKey();

  // Debug logging
  console.log('RootLayout - Clerk publishable key:', publishableKey ? 'Found' : 'Not found');
  console.log('RootLayout - Key value:', publishableKey);
  console.log('RootLayout - Constants.expoConfig?.extra:', Constants.expoConfig?.extra);

  const clerkEnabled = !!(
    publishableKey &&
    (publishableKey.startsWith('pk_live_') ||
      (publishableKey.startsWith('pk_test_') &&
        publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk'))
  );

  console.log('RootLayout - clerkEnabled:', clerkEnabled, 'publishableKey:', publishableKey?.substring(0, 20) + '...');

  if (!clerkEnabled) {
    console.log('⚠️  Running without Clerk authentication (using placeholder key or missing)');
    return (
      <ClerkUiProvider clerkEnabled={false}>
      <GestureHandlerRootView style={gestureHandlerRootStyle}>
        <ErrorBoundary>
        <ApiProvider>
          <WalkthroughStateProviderLegacy>
            <UserRoleProvider>
              <ProjectListProvider>
                <VendorDirectoryProviderLocal>
                  <ProjectProvider>
                    <ChatProvider>
                      <ThemeProvider>
                        <LanguageProvider>
                          <NotificationProvider>
                            <ThemeAwareLayout>
                              <AuthGate useClerk={false} />
                            </ThemeAwareLayout>
                          </NotificationProvider>
                        </LanguageProvider>
                      </ThemeProvider>
                    </ChatProvider>
                  </ProjectProvider>
                </VendorDirectoryProviderLocal>
              </ProjectListProvider>
            </UserRoleProvider>
          </WalkthroughStateProviderLegacy>
        </ApiProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
      </ClerkUiProvider>
    );
  }

  return (
    <ClerkUiProvider clerkEnabled={true}>
    <GestureHandlerRootView style={gestureHandlerRootStyle}>
      <ErrorBoundary>
        <ApiProvider>
          <ClerkWebBootstrap publishableKey={publishableKey}>
            <WalkthroughStateProvider>
              <UserRoleProvider>
                <ProjectListProvider>
                  <ClerkVendorDirectoryWrapper>
                    <ProjectProvider>
                      <ChatProvider>
                        <ThemeProvider>
                          <LanguageProvider>
                            <NotificationProvider>
                              <BetaFeedbackProvider>
                                <ThemeAwareLayout>
                                  <AuthGate useClerk={true} />
                                </ThemeAwareLayout>
                              </BetaFeedbackProvider>
                            </NotificationProvider>
                          </LanguageProvider>
                        </ThemeProvider>
                      </ChatProvider>
                    </ProjectProvider>
                  </ClerkVendorDirectoryWrapper>
                </ProjectListProvider>
              </UserRoleProvider>
            </WalkthroughStateProvider>
          </ClerkWebBootstrap>
        </ApiProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
    </ClerkUiProvider>
  );
}
