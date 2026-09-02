import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { FORM_KEYBOARD_SCROLL_PROPS } from '@/constants/keyboardScrollProps';
import {
  ESTIMATE_FLOW_NESTED_FIELD_BG_DARK,
  estimateFlowCardStyle,
} from '@/utils/estimateFlowCardStyle';
import { nativeNumericKeyboardProps, resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';

// Conditionally import Clerk - only if configured
let signInHookFactory: any = null;
try {
  const clerkModule = require('@clerk/clerk-react');
  signInHookFactory = clerkModule.useSignIn;
} catch (e) {
  // Clerk not available
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();
  
  // Check if Clerk is configured
  const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const useClerk = publishableKey && (publishableKey.startsWith('pk_live_') || (publishableKey.startsWith('pk_test_') && publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk'));
  
  // Try to use Clerk hooks - must be called unconditionally
  // If Clerk is not configured, this will throw, but we'll handle it
  let clerkSignIn: any = null;
  let clerkSetActive: any = null;
  let isLoaded = false;
  let hasClerk = false;
  
  if (signInHookFactory) {
    try {
      const signInHook = signInHookFactory();
      if (signInHook) {
        clerkSignIn = signInHook.signIn || null;
        clerkSetActive = signInHook.setActive || null;
        isLoaded = signInHook.isLoaded || false;
        hasClerk = true;
      }
    } catch (e) {
      // Not in ClerkProvider - that's okay, we'll show a bypass
      hasClerk = false;
    }
  }
  
  // If Clerk is not configured, redirect to main app
  React.useEffect(() => {
    if (!useClerk || !hasClerk) {
      const timer = setTimeout(() => {
        router.replace('/');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [useClerk, hasClerk, router]);
  
  // If Clerk is not configured, show a simple continue screen
  if (!useClerk || !hasClerk) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={[styles.centeredContent, { paddingHorizontal: 20 }]}>
            <View style={styles.wideContainer}>
              <View style={[estimateFlowCardStyle({ line: '#E2E8F0', surface2: '#FFFFFF' }, true), styles.card]}>
                <Text style={styles.title}>Welcome</Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => router.replace('/')}
                >
                  <Text style={styles.primaryButtonText}>Continue to App</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const sendCode = async () => {
    if (useClerk && clerkSignIn) {
      if (!isLoaded) return;
      setPending(true);
      try {
        await clerkSignIn.create({ identifier: email });
        await clerkSignIn.prepareFirstFactor({ strategy: 'email_code' } as any);
        setSent(true);
      } catch (e: any) {
        alert(e.errors?.[0]?.message || 'Failed to send code');
      } finally {
        setPending(false);
      }
    } else {
      // No Clerk - just bypass login and go to main app
      setPending(true);
      // Simulate sending code
      setTimeout(() => {
        setSent(true);
        setPending(false);
      }, 500);
    }
  };

  const verifyCode = async () => {
    if (useClerk && clerkSignIn && clerkSetActive) {
      if (!isLoaded) return;
      setPending(true);
      try {
        const res = await clerkSignIn.attemptFirstFactor({
          strategy: 'email_code',
          code,
        });
        if (res.status === 'complete') {
          await clerkSetActive({ session: res.createdSessionId });
          router.replace('/');
        } else {
          alert('Check your code and try again');
        }
      } catch (e: any) {
        alert(e.errors?.[0]?.message || 'Verification failed');
      } finally {
        setPending(false);
      }
    } else {
      // No Clerk - just bypass and go to main app
      setPending(true);
      setTimeout(() => {
        router.replace('/');
        setPending(false);
      }, 500);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} {...FORM_KEYBOARD_SCROLL_PROPS}>
            <View style={styles.wideContainer}>
              <View style={[estimateFlowCardStyle({ line: '#E2E8F0', surface2: '#FFFFFF' }, true), styles.card]}>
                <Text style={styles.title}>Sign In</Text>
                {!sent ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Email</Text>
                      <TextInput
                        style={styles.input}
                        placeholder='you@company.com'
                        placeholderTextColor='rgba(255,255,255,0.42)'
                        autoCapitalize='none'
                        keyboardType='email-address'
                        value={email}
                        onChangeText={setEmail}
                        editable={!pending}
                        {...resolveTextInputKeyboardProps({ keyboardType: 'email-address' })}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.primaryButton, (pending || !email) && styles.primaryButtonDisabled]}
                      onPress={sendCode}
                      disabled={pending || !email}
                    >
                      {pending ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Send code</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => router.push('/auth/signup')}
                      style={styles.switchRow}
                    >
                      <Text style={styles.switchText}>
                        Don't have an account?{' '}
                        <Text style={styles.switchLink}>Sign up</Text>
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Verification Code</Text>
                      <TextInput
                        style={styles.input}
                        placeholder='Enter code'
                        placeholderTextColor='rgba(255,255,255,0.42)'
                        autoCapitalize='none'
                        keyboardType='phone-pad'
                        value={code}
                        onChangeText={setCode}
                        editable={!pending}
                        {...nativeNumericKeyboardProps}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.primaryButton, (pending || code.length < 4) && styles.primaryButtonDisabled]}
                      onPress={verifyCode}
                      disabled={pending || code.length < 4}
                    >
                      {pending ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Verify code</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 8,
  },
  card: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  input: {
    borderRadius: 14,
    backgroundColor: ESTIMATE_FLOW_NESTED_FIELD_BG_DARK,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
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
  switchRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  switchLink: {
    color: '#18C58C',
    fontWeight: '600',
  },
});
