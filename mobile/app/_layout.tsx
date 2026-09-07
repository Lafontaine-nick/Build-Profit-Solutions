import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProjectProvider } from '../contexts/ProjectContext';
import { ProjectListProvider } from '../contexts/ProjectListContext';
import { ApiProvider } from '../contexts/ApiContext';
import { UserRoleProvider } from '../contexts/UserRoleContext';
import { ChatProvider } from '../contexts/ChatContext';
import React, { useEffect, useState } from 'react';
import { useFonts as useMontserrat, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { useFonts as useSaira, Saira_400Regular } from '@expo-google-fonts/saira';
import { View, Text, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import ErrorBoundary from '../components/ErrorBoundary';
import notificationService from '../services/notificationService';
import { NotificationProvider } from '../contexts/NotificationContext';
import ProfileCompletionReminderRouteGuard from '../components/ProfileCompletionReminderRouteGuard';
import { LanguageProvider } from '../contexts/LanguageContext';
import { useUserRole } from '../contexts/UserRoleContext';
import { useAuth, useUser } from '@clerk/clerk-react';
import ClerkWebBootstrap from '../components/ClerkWebBootstrap';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { clerkAuthService } from '../services/clerkAuth';
import { syncClerkTokenToAsyncStorage } from '../utils/authTokenHelper';
import { setWorkspaceClerkTokenGetter } from '../utils/workspaceAuthBridge';
import {
  WalkthroughStateProvider,
  WalkthroughStateProviderLegacy,
  useWalkthroughState,
} from '../contexts/WalkthroughStateContext';
import '../i18n/config'; // Initialize i18n
import '@/lib/projectListSessionHydration';
import { BetaFeedbackProvider } from '../contexts/BetaFeedbackContext';
import ClerkVendorDirectoryWrapper from '../components/ClerkVendorDirectoryWrapper';
import { VendorDirectoryProviderLocal } from '../contexts/VendorDirectoryContext';
import { ClerkUiProvider } from '../contexts/ClerkUiContext';
import { getClerkPublishableKey } from '../lib/clerkPublishableKey';
import { applyWorkspaceMemberFirstRunIfNeeded } from '../lib/workspaceMemberOnboarding';

// Web + Safari: native screen containers from react-native-screens can swallow pointer events
// with Expo Router + bottom tabs. JS screens restore reliable Pressable / tab hit testing.
if (Platform.OS === 'web') {
  enableScreens(false);
}

/** RN-web: avoid short viewport / rubber-band glitches when the shell does not fill the window. */
const gestureHandlerRootStyle: StyleProp<ViewStyle> =
  Platform.OS === 'web'
    ? ({ flex: 1, minHeight: '100vh' } as ViewStyle)
    : { flex: 1 };

/** Web: `GestureHandlerRootView` can still steal or confuse pointer routing with RN-web + tabs. */
function RootGestureShell({
  children,
  style,
}: {
  children: React.ReactNode;
  style: StyleProp<ViewStyle>;
}) {
  if (Platform.OS === 'web') {
    return <View style={style}>{children}</View>;
  }
  return <GestureHandlerRootView style={style}>{children}</GestureHandlerRootView>;
}

// Component to apply theme-aware styling and StatusBar
function ThemeAwareLayout({ children }: { children: React.ReactNode }) {
  const { darkMode, theme } = useTheme();
  
  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? '#0b1c38' : '#f5f7fa' }}>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
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
    refresh: refreshWalkthroughState,
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
        if (user?.id) {
          const memberFirstRun = await applyWorkspaceMemberFirstRunIfNeeded(user.id, {
            firstName: user.firstName,
            lastName: user.lastName,
            email:
              user.primaryEmailAddress?.emailAddress ||
              user.emailAddresses?.[0]?.emailAddress ||
              null,
          });
          if (memberFirstRun.applied) {
            clearTimeout(timeoutId);
            await refreshWalkthroughState();
            setNeedsProfileSetup(false);
            return;
          }
        }

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
  }, [isSignedIn, user, user?.firstName, user?.lastName, user?.id, refreshWalkthroughState]);

  // Keep API token storage in sync with active Clerk session.
  useEffect(() => {
    setWorkspaceClerkTokenGetter(isSignedIn ? () => getToken() : null);
    return () => setWorkspaceClerkTokenGetter(null);
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const email =
          user?.primaryEmailAddress?.emailAddress ||
          user?.emailAddresses?.[0]?.emailAddress ||
          null;
        await syncClerkTokenToAsyncStorage(token, email);
        if (user?.id) {
          try {
            const { logInAppleBilling, isAppleBillingAvailable } = await import(
              '@/services/appleBillingService'
            );
            if (isAppleBillingAvailable()) {
              await logInAppleBilling(user.id);
            }
          } catch (billingError) {
            console.warn('AuthGate - Apple billing login failed:', billingError);
          }
        }
      } catch (error) {
        console.warn('AuthGate - token sync failed:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  // Show loading while Clerk is initializing and restoring session
  // This is critical - we must wait for Clerk to check SecureStore for existing session
  // But add timeout to prevent infinite loading
  if (!isLoaded && !clerkTimeout) {
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
    return (
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="loading" />
        <Stack.Screen name="oauth-native-callback" />
      </Stack>
    );
  }

  // Wait for profile + walkthrough hydration
  if (needsProfileSetup === null || !wtHydrated) {
    return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="loading" />
    </Stack>;
  }

  // Flow: sign in → onboarding (first-time) → profile setup (if needed) → role → main app
  if (shouldShowAppOnboarding) {
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
    return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="auth/profile-setup" />
    </Stack>;
  }

  if (isLoading) {
    return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="loading" />
    </Stack>;
  }

  if (!userRole) {
    return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="role-selection" />
    </Stack>;
  }

  // Signed-in returning users always land on the marketing homepage (`index`). Get Started → app
  // (skip sign-in only when “stay signed in” is on) is handled in `landing.tsx`.
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
    return (
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="loading" />
      </Stack>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
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
    return (
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="loading" />
      </Stack>
    );
  }

  if (shouldShowAppOnboarding) {
    return (
      <Stack
        screenOptions={{ headerShown: false, gestureEnabled: false }}
        initialRouteName="onboarding"
      >
        <Stack.Screen name="onboarding" />
      </Stack>
    );
  }

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

  const clerkEnabled = !!(
    publishableKey &&
    (publishableKey.startsWith('pk_live_') ||
      (publishableKey.startsWith('pk_test_') &&
        publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk'))
  );

  if (!clerkEnabled) {
    return (
      <ClerkUiProvider clerkEnabled={false}>
      <RootGestureShell style={gestureHandlerRootStyle}>
        <SafeAreaProvider>
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
                              <ProfileCompletionReminderRouteGuard />
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
        </SafeAreaProvider>
      </RootGestureShell>
      </ClerkUiProvider>
    );
  }

  return (
    <ClerkUiProvider clerkEnabled={true}>
    <RootGestureShell style={gestureHandlerRootStyle}>
      <SafeAreaProvider>
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
                                  <ProfileCompletionReminderRouteGuard />
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
      </SafeAreaProvider>
    </RootGestureShell>
    </ClerkUiProvider>
  );
}
