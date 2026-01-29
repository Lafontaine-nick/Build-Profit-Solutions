import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';

export default function PaymentSuccess() {
  const { darkMode } = useTheme();
  const router = useRouter();

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
    // Auto-redirect to dashboard after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/(tabs)/dashboard');
    }, 3000);

    return () => clearTimeout(timer);
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
          Your subscription has been activated successfully. Welcome to Build
          Profit Solutions!
        </Text>

        <View style={styles.featuresContainer}>
          <Text style={[styles.featuresTitle, { color: theme.text }]}>
            What's Next?
          </Text>
          <View style={styles.featureRow}>
            <MaterialIcons name='check' size={20} color={theme.success} />
            <Text style={[styles.featureText, { color: theme.subtext }]}>
              Access to all premium features
            </Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialIcons name='check' size={20} color={theme.success} />
            <Text style={[styles.featureText, { color: theme.subtext }]}>
              Advanced lead management
            </Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialIcons name='check' size={20} color={theme.success} />
            <Text style={[styles.featureText, { color: theme.subtext }]}>
              AI-powered analytics
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={() => router.replace('/(tabs)/dashboard')}
        >
          <Text style={styles.buttonText}>Go to Dashboard</Text>
        </TouchableOpacity>

        <Text style={[styles.redirectText, { color: theme.subtext }]}>
          Redirecting automatically in 3 seconds...
        </Text>
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
    marginBottom: 30,
    lineHeight: 24,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 30,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    fontSize: 14,
    marginLeft: 10,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  redirectText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
