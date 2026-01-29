import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

interface SettingsRowProps {
  iconName?: keyof typeof MaterialIcons.glyphMap;
  icon?: string;
  label: string;
  onPress: () => void;
}

const SettingsRow = ({ iconName, icon, label, onPress }: SettingsRowProps) => {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        {iconName ? (
          <MaterialIcons 
            name={iconName} 
            size={20} 
            color='#43cea2' 
          />
        ) : icon ? (
          <Text style={styles.iconText}>
            {icon}
          </Text>
        ) : null}
      </View>
      <Text style={styles.rowLabel}>
        {label}
      </Text>
      <MaterialIcons 
        name='chevron-right' 
        size={20} 
        color='#CFE6FF' 
      />
    </TouchableOpacity>
  );
};

export default function HelpSupportScreen() {
  const router = useRouter();
  const { darkMode } = useTheme();
  
  // Navigation handlers - create placeholder screens or handle inline
  const handleFAQ = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/profile/faq');
  };

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/profile/contact-support');
  };

  const handleReportIssue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/profile/report-issue');
  };

  const handleGettingStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/profile/getting-started');
  };

  const handleCreateEstimate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/profile/estimate-tutorial');
  };

  const handleProjectManagement = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/profile/projects-tutorial');
  };

  const handleLeadManagement = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/profile/leads-tutorial');
  };


  const handleBillingQuestions = () => {
    // Navigate to payment/billing section
    router.push('/payment');
  };

  const handleRefundPolicy = () => {
    // Navigate to legal hub or refund policy
    router.push('/legal-hub?tab=refund');
  };

  // Use dashboard's dark blue gradient background with white cards
  const theme = {
    background: ['#0b1c38', '#1B365D', '#43cea2'] as [string, string, string],
    card: '#FFFFFF',
    text: '#0A2540',
    subtext: '#6C7383',
    accent: '#43cea2',
    border: '#D3D9E6',
    iconBg: '#E8F5F3',
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.background} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.back();
              }}
              style={[
                styles.backButtonHeader,
                {
                  backgroundColor: 'rgba(67, 206, 162, 0.2)',
                  borderColor: 'rgba(67, 206, 162, 0.3)',
                },
              ]}
            >
              <MaterialIcons name='arrow-back' size={24} color='#FFFFFF' />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>Help & Support</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Content Card */}
          <View style={styles.contentCard}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
              {/* Tutorials & Guides */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name='menu-book' size={22} color='#43cea2' />
                  <Text style={styles.sectionTitle}>
                    Tutorials & Guides
                  </Text>
                </View>

                <SettingsRow
                  iconName='play-circle-outline'
                  label='Getting Started'
                  onPress={handleGettingStarted}
                />
                <SettingsRow
                  iconName='calculate'
                  label='How to Create an Estimate'
                  onPress={handleCreateEstimate}
                />
                <SettingsRow
                  iconName='folder'
                  label='Project Management'
                  onPress={handleProjectManagement}
                />
                <SettingsRow
                  iconName='people'
                  label='Lead Management'
                  onPress={handleLeadManagement}
                />
              </View>

              {/* Quick Help */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name='help-outline' size={22} color='#43cea2' />
                  <Text style={styles.sectionTitle}>
                    Quick Help
                  </Text>
                </View>

                <SettingsRow
                  iconName='help-outline'
                  label='FAQ'
                  onPress={handleFAQ}
                />
                <SettingsRow
                  iconName='support-agent'
                  label='Contact Support'
                  onPress={handleContactSupport}
                />
                <SettingsRow
                  iconName='report-problem'
                  label='Report an Issue'
                  onPress={handleReportIssue}
                />
              </View>

              {/* Billing Support */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name='payment' size={22} color='#43cea2' />
                  <Text style={styles.sectionTitle}>
                    Billing Support
                  </Text>
                </View>

                <SettingsRow
                  iconName='payment'
                  label='Billing Questions'
                  onPress={handleBillingQuestions}
                />
                <SettingsRow
                  iconName='receipt'
                  label='Refund Policy'
                  onPress={handleRefundPolicy}
                />
              </View>

              {/* System Status */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name='check-circle' size={22} color='#43cea2' />
                  <Text style={styles.sectionTitle}>
                    System Status
                  </Text>
                </View>

                <View style={styles.statusRow}>
                  <View style={styles.iconContainer}>
                    <View style={styles.statusDot} />
                  </View>
                  <View style={styles.statusTextContainer}>
                    <Text style={styles.statusTitle}>
                      All Systems Operational
                    </Text>
                    <Text style={styles.statusSubtitle}>
                      Our servers and AI services are running normally.
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  contentCard: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 40, 80, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionCard: {
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
    borderColor: 'rgba(67, 206, 162, 0.2)',
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    color: '#FFFFFF',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    position: 'relative',
  },
  backButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(67, 206, 162, 0.15)',
  },
  iconText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#43cea2',
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusSubtitle: {
    fontSize: 13,
    color: '#CFE6FF',
    marginTop: 2,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    marginRight: 12,
  },
});
