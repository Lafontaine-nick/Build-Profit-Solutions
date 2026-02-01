import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useClerkOAuth } from '@/hooks/useClerkOAuth';
import Constants from 'expo-constants';

interface OAuthButtonsProps {
  onGooglePress: (googleOAuth: any, clerkSetActive: any) => void;
  onApplePress: (appleOAuth: any, clerkSetActive: any) => void;
  loading: boolean;
}

/**
 * OAuth Buttons Component
 * Only renders when Clerk is configured and we're in ClerkProvider
 */
export function OAuthButtons({ onGooglePress, onApplePress, loading }: OAuthButtonsProps) {
  // Check if Clerk is configured
  const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const useClerk = publishableKey && (publishableKey.startsWith('pk_live_') || (publishableKey.startsWith('pk_test_') && publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk'));

  if (!useClerk) {
    return null;
  }

  // Try to use OAuth hooks - must be called unconditionally
  // Will throw if not in ClerkProvider, which we'll catch
  let oauthResult: any = null;
  try {
    oauthResult = useClerkOAuth();
    console.log('OAuthButtons - useClerkOAuth result:', {
      useClerk: oauthResult?.useClerk,
      hasGoogleOAuth: !!oauthResult?.googleOAuth,
      hasAppleOAuth: !!oauthResult?.appleOAuth,
      hasClerkSetActive: !!oauthResult?.clerkSetActive,
    });
  } catch (e) {
    // Not in ClerkProvider - don't show buttons
    console.log('OAuthButtons - useClerkOAuth threw error (not in ClerkProvider):', e);
    return null;
  }

  // Only show buttons if OAuth is actually available
  // Note: We show buttons even if clerkSetActive is not available yet
  // The handler will deal with that case
  if (!oauthResult?.useClerk || !oauthResult?.googleOAuth) {
    console.log('OAuthButtons - Not showing buttons:', {
      useClerk: oauthResult?.useClerk,
      hasGoogleOAuth: !!oauthResult?.googleOAuth,
      hasClerkSetActive: !!oauthResult?.clerkSetActive,
      oauthResult: oauthResult,
    });
    return null;
  }

  // Log that we're showing buttons
  console.log('OAuthButtons - Showing OAuth buttons:', {
    hasGoogleOAuth: !!oauthResult.googleOAuth,
    hasClerkSetActive: !!oauthResult.clerkSetActive,
    googleOAuthType: typeof oauthResult.googleOAuth,
  });

  return (
    <>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.socialButton, loading && styles.socialButtonDisabled]}
        onPress={() => {
          console.log('🔵 OAuthButtons - Google button pressed:', {
            hasGoogleOAuth: !!oauthResult.googleOAuth,
            hasClerkSetActive: !!oauthResult.clerkSetActive,
            loading: loading,
            googleOAuthType: typeof oauthResult.googleOAuth,
            googleOAuthKeys: oauthResult.googleOAuth ? Object.keys(oauthResult.googleOAuth) : [],
          });
          try {
            if (!oauthResult.googleOAuth) {
              console.error('❌ Google OAuth handler is null/undefined when button pressed');
              return;
            }
            console.log('✅ Calling onGooglePress handler...');
            onGooglePress(oauthResult.googleOAuth, oauthResult.clerkSetActive);
          } catch (error) {
            console.error('❌ Error in Google button onPress:', error);
          }
        }}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#111827" size="small" />
        ) : (
          <>
            <View style={styles.googleIconContainer}>
              <Text style={styles.googleIconText}>G</Text>
            </View>
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.socialButton, loading && styles.socialButtonDisabled]}
          onPress={() => onApplePress(oauthResult.appleOAuth, oauthResult.clerkSetActive)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#111827" size="small" />
          ) : (
            <>
              <MaterialIcons name="apple" size={20} color="#000000" style={styles.socialIcon} />
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D3D9E6',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#9AA3B6',
    fontSize: 12,
    fontWeight: '500',
  },
  socialButton: {
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D3D9E6',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 44,
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  socialIcon: {
    marginRight: 8,
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  googleIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  socialButtonText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
});

