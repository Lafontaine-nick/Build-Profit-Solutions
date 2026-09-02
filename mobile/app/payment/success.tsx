import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildProjectDetailHref,
  consumePostCheckoutReturn,
  type PostCheckoutReturn,
} from '@/utils/postCheckoutReturn';
import { setBusinessEntitlementSnapshot } from '@/utils/businessEntitlementCache';
import { isBusinessPlanReleased } from '@/constants/releaseFlags';

export default function PaymentSuccess() {
  const { darkMode } = useTheme();
  const router = useRouter();
  const [redirectLabel, setRedirectLabel] = useState('Returning to your project…');
  const [returnTarget, setReturnTarget] = useState<PostCheckoutReturn | null>(null);

  const theme = darkMode
    ? {
        background: ['#0b1c38', '#142850'] as [string, string],
        card: '#142850',
        text: '#fff',
        subtext: '#aaa',
        accent: '#43cea2',
        success: '#4CAF50',
      }
    : {
        background: ['#f5f7fa', '#c3cfe2'] as [string, string],
        card: '#fff',
        text: '#222',
        subtext: '#555',
        accent: '#1976d2',
        success: '#4CAF50',
      };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = async () => {
      if (isBusinessPlanReleased()) {
        try {
          await AsyncStorage.setItem('bps.cachedPlanId', 'business');
          setBusinessEntitlementSnapshot({ hasBusiness: true });
        } catch {
          // non-blocking
        }
      }

      const target = await consumePostCheckoutReturn();
      if (cancelled) return;

      setReturnTarget(target);

      if (target?.projectId) {
        const tab = target.tab || 'Budget';
        setRedirectLabel(`Returning to ${tab}…`);
        router.replace(buildProjectDetailHref(target.projectId, tab) as never);
        return;
      }

      setRedirectLabel('Redirecting to dashboard…');
      timer = setTimeout(() => {
        if (!cancelled) {
          router.replace('/(tabs)/dashboard');
        }
      }, 2500);
    };

    void finish();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return (
    <LinearGradient colors={theme.background} style={styles.container}>
      <View style={[styles.content, { backgroundColor: theme.card }]}>
        <View
          style={[styles.iconContainer, { backgroundColor: theme.success }]}
        >
          <MaterialIcons name='check' size={48} color='#fff' />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>
          Payment Successful!
        </Text>

        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          {isBusinessPlanReleased()
            ? "Your Business plan is active. We're taking you back to your project Team workspace."
            : 'Your subscription is active. We\u2019re taking you back to your project.'}
        </Text>

        <ActivityIndicator size="large" color={theme.accent} style={{ marginVertical: 20 }} />

        <Text style={[styles.redirectText, { color: theme.subtext }]}>
          {redirectLabel}
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={() => {
            if (returnTarget?.projectId) {
              router.replace(
                buildProjectDetailHref(
                  returnTarget.projectId,
                  returnTarget.tab || 'Budget'
                ) as never
              );
              return;
            }
            router.replace('/(tabs)/dashboard');
          }}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    margin: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 24,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  redirectText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
