import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { getPostAuthHref } from '@/lib/postAuthNavigation';
import { MaterialIcons } from '@expo/vector-icons';
import { FORM_KEYBOARD_SCROLL_PROPS } from '@/constants/keyboardScrollProps';
import { nativeNumericKeyboardProps, resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import Constants from 'expo-constants';

// Conditionally import Clerk - only if configured
let signInHookFactory: any = null;
let clerkInstanceFactory: any = null;
try {
  const clerkModule = require('@clerk/clerk-react');
  signInHookFactory = clerkModule.useSignIn;
  clerkInstanceFactory = clerkModule.useClerk;
} catch (e) {
  // Clerk not available
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  
  // Check if Clerk is configured
  const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkEnabled = publishableKey && (publishableKey.startsWith('pk_live_') || (publishableKey.startsWith('pk_test_') && publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk'));
  
  // Try to use Clerk hooks - must be called unconditionally
  let signIn: any = null;
  let setActive: any = null;
  let isLoaded = false;
  
  if (isClerkEnabled && signInHookFactory) {
    try {
      const signInHook = signInHookFactory();
      if (signInHook) {
        signIn = signInHook.signIn || null;
        setActive = signInHook.setActive || null;
        isLoaded = signInHook.isLoaded || false;
      }
    } catch (e) {
      // Not in ClerkProvider - that's okay
      console.log('Clerk hooks not available:', e);
    }
  }
  
  // Try to get setActive from useClerk as fallback
  if (isClerkEnabled && clerkInstanceFactory && !setActive) {
    try {
      const clerkInstance = clerkInstanceFactory();
      if (clerkInstance) {
        setActive = clerkInstance.setActive || null;
      }
    } catch (e) {
      // Not in ClerkProvider - that's okay
      console.log('Clerk instance not available:', e);
    }
  }
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!isClerkEnabled) {
      Alert.alert('Not Available', 'Password reset is only available when Clerk authentication is configured.');
      return;
    }

    if (!isLoaded || !signIn) {
      Alert.alert('Error', 'Authentication service is not ready. Please try again.');
      return;
    }

    setLoading(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setStep('code');
      Alert.alert(
        'Code Sent',
        'Please check your email for the password reset code.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Password reset error:', error);
      const errorMessage = error?.errors?.[0]?.message || error?.message || 'Failed to send reset code. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };


  const handleVerifyCode = async () => {
    // For Clerk, we can't verify code separately - we need to move to password step
    // The code will be validated when we attempt the reset with password
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the reset code');
      return;
    }

    if (code.length < 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code');
      return;
    }

    // Just move to password step - code will be validated when resetting password
    setStep('password');
  };

  const handleResetPassword = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the reset code');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!isClerkEnabled) {
      Alert.alert('Not Available', 'Password reset is only available when Clerk authentication is configured.');
      return;
    }

    if (!isLoaded || !signIn) {
      Alert.alert('Error', 'Authentication service is not ready. Please try again.');
      return;
    }

    setLoading(true);
    try {
      // Clerk's password reset: verify code and set new password in one call
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password: newPassword.trim(),
      });

      console.log('Password reset result:', result.status, result);

      if (result.status === 'complete') {
        if (result.createdSessionId && setActive) {
          await setActive({ session: result.createdSessionId });
          await new Promise((r) => setTimeout(r, 120));
          const uid =
            signIn?.userId ?? (result as { userId?: string })?.userId ?? null;
          const href = await getPostAuthHref(uid);
          Alert.alert(
            'Success',
            'Your password has been reset successfully!',
            [
              {
                text: 'OK',
                onPress: () => router.replace(href),
              },
            ]
          );
        } else {
          Alert.alert(
            'Success',
            'Your password has been reset successfully! Please sign in with your new password.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/auth?mode=signin'),
              },
            ]
          );
        }
      } else {
        Alert.alert('Error', 'Password reset did not complete. Please try again.');
      }
    } catch (error: any) {
      console.error('Password reset error:', error);
      const errorCode = error?.errors?.[0]?.code;
      const errorMessage = error?.errors?.[0]?.message || error?.message || 'Failed to reset password. Please try again.';
      
      // Check if it's a code error
      if (errorCode === 'form_code_incorrect' || errorMessage.includes('code') || errorMessage.includes('Code')) {
        Alert.alert('Error', 'Invalid reset code. Please check your email and try again.');
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#021A35', '#007A70']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            {...FORM_KEYBOARD_SCROLL_PROPS}
          >
            <View style={styles.card}>
              {/* Back button */}
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                hitSlop={10}
              >
                <MaterialIcons name="arrow-back" size={24} color="#4A4F5C" />
              </TouchableOpacity>

              {/* Title */}
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                {step === 'email' && 'Enter your email address and we\'ll send you a reset code'}
                {step === 'code' && 'Enter the code from your email and your new password'}
              </Text>

              {/* Step 1: Email */}
              {step === 'email' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="you@company.com"
                      placeholderTextColor="#A0A7B5"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                      editable={!loading}
                      autoFocus
                      {...resolveTextInputKeyboardProps({ keyboardType: 'email-address' })}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                    onPress={handleSendCode}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* Step 2: Code and Password */}
              {step === 'code' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Reset Code</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor="#A0A7B5"
                      keyboardType="phone-pad"
                      value={code}
                      onChangeText={setCode}
                      editable={!loading}
                      autoFocus
                      maxLength={6}
                      {...nativeNumericKeyboardProps}
                    />
                    <Text style={styles.helperText}>
                      Check your email for the reset code
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="••••••••"
                        placeholderTextColor="#A0A7B5"
                        secureTextEntry={!showPassword}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        editable={!loading}
                        {...resolveTextInputKeyboardProps({ secureTextEntry: true })}
                      />
                      <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowPassword(!showPassword)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <MaterialIcons
                          name={showPassword ? 'visibility' : 'visibility-off'}
                          size={20}
                          color="#6C7383"
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.helperText}>
                      Must be at least 8 characters
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="••••••••"
                        placeholderTextColor="#A0A7B5"
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        editable={!loading}
                        {...resolveTextInputKeyboardProps({ secureTextEntry: true })}
                      />
                      <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <MaterialIcons
                          name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                          size={20}
                          color="#6C7383"
                        />
                      </TouchableOpacity>
                    </View>
                    {confirmPassword && newPassword === confirmPassword && (
                      <Text style={styles.successText}>✓ Passwords match</Text>
                    )}
                    {confirmPassword && newPassword !== confirmPassword && (
                      <Text style={styles.errorText}>Passwords do not match</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (loading || code.length < 6 || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword) &&
                      styles.primaryButtonDisabled,
                    ]}
                    onPress={handleResetPassword}
                    disabled={loading || code.length < 6 || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Reset Password</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleSendCode}
                    disabled={loading}
                  >
                    <Text style={styles.resendText}>Resend code</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Back to sign in */}
              <TouchableOpacity
                style={styles.backToSignIn}
                onPress={() => router.replace('/auth?mode=signin')}
                disabled={loading}
              >
                <Text style={styles.backToSignInText}>
                  Back to sign in
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  card: {
    borderRadius: 28,
    backgroundColor: '#F9FBFF',
    paddingHorizontal: 24,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 30,
    elevation: 8,
  },
  backButton: {
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6C7383',
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#6C7383',
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D3D9E6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D3D9E6',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  eyeIcon: {
    paddingRight: 14,
    paddingLeft: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#6C7383',
    marginTop: 4,
    marginLeft: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 2,
  },
  successText: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 4,
    marginLeft: 2,
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: '#18C58C',
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 13,
    color: '#18C58C',
    fontWeight: '500',
  },
  backToSignIn: {
    marginTop: 20,
    alignItems: 'center',
  },
  backToSignInText: {
    fontSize: 13,
    color: '#6C7383',
  },
});

