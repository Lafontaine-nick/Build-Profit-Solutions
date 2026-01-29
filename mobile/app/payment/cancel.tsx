import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';

export default function PaymentCancel() {
  const { darkMode } = useTheme();
  const router = useRouter();

  const theme = darkMode
    ? {
        background: ['#0b1c38', '#142850'] as [string, string],
        card: '#142850',
        text: '#fff',
        subtext: '#aaa',
        accent: '#43cea2',
        warning: '#FF9800',
      }
    : {
        background: ['#f5f7fa', '#c3cfe2'] as [string, string],
        card: '#fff',
        text: '#222',
        subtext: '#555',
        accent: '#1976d2',
        warning: '#FF9800',
      };

  return (
    <LinearGradient colors={theme.background} style={styles.container}>
      <View style={[styles.content, { backgroundColor: theme.card }]}>
        <View
          style={[styles.iconContainer, { backgroundColor: theme.warning }]}
        >
          <MaterialIcons name='cancel' size={48} color='#fff' />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>
          Payment Cancelled
        </Text>

        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          Your subscription was not completed. No charges have been made to your
          account.
        </Text>

        <View style={styles.infoContainer}>
          <Text style={[styles.infoTitle, { color: theme.text }]}>
            Need Help?
          </Text>
          <Text style={[styles.infoText, { color: theme.subtext }]}>
            If you encountered any issues during checkout, please contact our
            support team or try again.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              { backgroundColor: theme.accent },
            ]}
            onPress={() => router.replace('/(tabs)/dashboard')}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.secondaryButton,
              { borderColor: theme.accent },
            ]}
            onPress={() => router.replace('/(tabs)/dashboard')}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.accent }]}>
              Back to Dashboard
            </Text>
          </TouchableOpacity>
        </View>
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
  infoContainer: {
    width: '100%',
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  primaryButton: {
    // backgroundColor set by theme
  },
  secondaryButton: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
