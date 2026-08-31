import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useClerkOAuth } from '@/hooks/useClerkOAuth';
import { isClerkPublishableKeyConfigured } from '@/lib/clerkPublishableKey';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { theme } = useTheme();
  const isDarkBg = theme.bg === '#000000';
  const oauthStyles = useMemo(
    () =>
      StyleSheet.create({
        dividerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginVertical: 18,
        },
        dividerLine: {
          flex: 1,
          height: 1,
          backgroundColor: isDarkBg ? 'rgba(255,255,255,0.35)' : '#D3D9E6',
        },
        dividerText: {
          marginHorizontal: 10,
          color: isDarkBg ? '#FFFFFF' : '#64748B',
          fontSize: 12,
          fontWeight: '500',
        },
      }),
    [isDarkBg]
  );

  const oauthResult = useClerkOAuth();
  const clerkConfigured = isClerkPublishableKeyConfigured();

  if (!clerkConfigured || !oauthResult?.useClerk || !oauthResult?.googleOAuth) {
    return null;
  }

  const oauthReady = oauthResult.oauthReady !== false;

  if (__DEV__) {
    console.log('OAuthButtons - Showing OAuth buttons:', {
      hasGoogleOAuth: !!oauthResult.googleOAuth,
      hasClerkSetActive: !!oauthResult.clerkSetActive,
      oauthReady,
    });
  }

  return (
    <>
      <View style={oauthStyles.dividerRow}>
        <View style={oauthStyles.dividerLine} />
        <Text style={oauthStyles.dividerText}>OR</Text>
        <View style={oauthStyles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.socialButton, (loading || !oauthReady) && styles.socialButtonDisabled]}
        onPress={() => {
          console.log('🔵 OAuthButtons - Google button pressed:', {
            hasGoogleOAuth: !!oauthResult.googleOAuth,
            hasClerkSetActive: !!oauthResult.clerkSetActive,
            loading: loading,
            oauthReady,
            googleOAuthType: typeof oauthResult.googleOAuth,
            googleOAuthKeys: oauthResult.googleOAuth ? Object.keys(oauthResult.googleOAuth) : [],
          });
          try {
            if (!oauthReady) {
              console.warn('OAuthButtons - Clerk sign-in/sign-up not ready yet');
              return;
            }
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
        disabled={loading || !oauthReady}
      >
        {loading ? (
          <ActivityIndicator color="#111827" size="small" />
        ) : (
          <>
            <View style={styles.googleIconContainer}>
              <Text style={styles.googleIconText}>G</Text>
            </View>
            <Text style={[styles.socialButtonText, !oauthReady && { opacity: 0.65 }]}>
              Continue with Google
            </Text>
          </>
        )}
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.socialButton, (loading || !oauthReady) && styles.socialButtonDisabled]}
          onPress={() => {
            if (!oauthReady) return;
            onApplePress(oauthResult.appleOAuth, oauthResult.clerkSetActive);
          }}
          disabled={loading || !oauthReady}
        >
          {loading ? (
            <ActivityIndicator color="#111827" size="small" />
          ) : (
            <>
              <MaterialIcons name="apple" size={20} color="#000000" style={styles.socialIcon} />
              <Text style={[styles.socialButtonText, !oauthReady && { opacity: 0.65 }]}>
                Continue with Apple
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
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

