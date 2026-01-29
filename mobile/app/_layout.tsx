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
import { View, Text } from 'react-native';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import ErrorBoundary from '../components/ErrorBoundary';
import notificationService from '../services/notificationService';
import { NotificationProvider } from '../contexts/NotificationContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { useUserRole } from '../contexts/UserRoleContext';
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import clerkTokenCache from '../utils/clerkTokenCache';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { clerkAuthService } from '../services/clerkAuth';
import '../i18n/config'; // Initialize i18n

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
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { userRole, isLoading } = useUserRole();

  // IMPORTANT: All hooks must be declared BEFORE any conditional returns
  // Check if profile setup is needed
  const [needsProfileSetup, setNeedsProfileSetup] = useState<boolean | null>(null);

  // Initialize notification service
  useEffect(() => {
    notificationService.initialize();
  }, []);

  // Check profile completeness (only when authenticated)
  useEffect(() => {
    const checkProfileCompleteness = async () => {
      try {
        // Check Clerk user data
        const hasClerkName = !!(user.firstName && user.lastName);
        
        // Check contractor profile in AsyncStorage
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const contractorProfileData = await AsyncStorage.getItem('bps.contractorProfile');
        let hasContractorProfile = false;
        let hasName = false;
        let hasCompany = false;

        if (contractorProfileData) {
          const profile = JSON.parse(contractorProfileData);
          hasName = !!(profile.name && profile.name.trim());
          hasCompany = !!(profile.company && profile.company.trim());
          hasContractorProfile = hasName && hasCompany;
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
        console.error('Error checking profile completeness:', error);
        // If there's an error, only check Clerk name
        setNeedsProfileSetup(!(user.firstName && user.lastName));
      }
    };

    if (isSignedIn && user) {
      checkProfileCompleteness();
    } else {
      // Reset when not signed in
      setNeedsProfileSetup(null);
    }
  }, [isSignedIn, user, user?.firstName, user?.lastName]);

  // Debug logging
  console.log('AuthGate - isLoaded:', isLoaded, 'isSignedIn:', isSignedIn, 'user:', !!user, 'userId:', user?.id);

  // Show loading while Clerk is initializing and restoring session
  // This is critical - we must wait for Clerk to check SecureStore for existing session
  if (!isLoaded) {
    console.log('AuthGate - Clerk is loading, waiting for session restoration...');
    return <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="loading" />
    </Stack>;
  }

  // Show login/signup if not authenticated (only after Clerk has fully loaded)
  // This ensures we've checked SecureStore for existing sessions
  if (!isSignedIn || !user) {
    console.log('AuthGate - No active session found after Clerk loaded, showing landing + auth screens');
    return (
      <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="auth/forgot-password" />
      </Stack>
    );
  }

  // Show profile setup if needed (wait for check to complete)
  if (needsProfileSetup === true) {
    console.log('AuthGate - Showing profile setup (missing profile information)');
    return <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth/profile-setup" />
    </Stack>;
  }

  // Don't proceed until profile check is complete (only show loading if we're checking)
  if (needsProfileSetup === null) {
    console.log('AuthGate - Checking profile completeness...');
    return <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="loading" />
    </Stack>;
  }

  // Show loading while user role is loading
  if (isLoading) {
    console.log('AuthGate - Showing loading for user role');
    return <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="loading" />
    </Stack>;
  }

  // Show role selection if no role is set
  if (!userRole) {
    console.log('AuthGate - Showing role selection');
    return <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="role-selection" />
    </Stack>;
  }

  // User is fully authenticated and set up
  console.log('AuthGate - Showing main app');
  return <Stack screenOptions={{ headerShown: false }} />;
}

function AuthGateWithoutClerk() {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="loading" />
      </Stack>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    console.log('AuthGate - User not authenticated, showing auth screen');
    return (
      <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
      </Stack>
    );
  }

  // User is authenticated, show main app (all routes including tabs)
  console.log('AuthGate - User authenticated, showing main app');
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* All routes are accessible when authenticated */}
    </Stack>
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

  // Get the Clerk publishable key from the extra config
  const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // Debug logging
  console.log('RootLayout - Clerk publishable key:', publishableKey ? 'Found' : 'Not found');
  console.log('RootLayout - Key value:', publishableKey);
  console.log('RootLayout - Constants.expoConfig?.extra:', Constants.expoConfig?.extra);

  // Temporarily bypass Clerk authentication if key is invalid or missing
  const useClerk = publishableKey && (
    publishableKey.startsWith('pk_live_') || 
    (publishableKey.startsWith('pk_test_') && publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk')
  );

  console.log('RootLayout - useClerk:', useClerk, 'publishableKey:', publishableKey?.substring(0, 20) + '...');

  if (!useClerk) {
    console.log('⚠️  Running without Clerk authentication (using placeholder key or missing)');
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorBoundary>
          <ApiProvider>
            <UserRoleProvider>
              <ProjectListProvider>
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
              </ProjectListProvider>
            </UserRoleProvider>
          </ApiProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ApiProvider>
          <ClerkProvider publishableKey={publishableKey} tokenCache={clerkTokenCache}>
            <UserRoleProvider>
              <ProjectListProvider>
                <ProjectProvider>
                  <ChatProvider>
                    <ThemeProvider>
                      <LanguageProvider>
                        <NotificationProvider>
                          <ThemeAwareLayout>
                            <AuthGate useClerk={true} />
                          </ThemeAwareLayout>
                        </NotificationProvider>
                      </LanguageProvider>
                    </ThemeProvider>
                  </ChatProvider>
                </ProjectProvider>
              </ProjectListProvider>
            </UserRoleProvider>
          </ClerkProvider>
        </ApiProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
