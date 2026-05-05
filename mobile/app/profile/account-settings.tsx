import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserRole } from '@/contexts/UserRoleContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { clerkAuthService } from '@/services/clerkAuth';
import {
  clearAllOnboardingCompletionKeys,
  clearOnboardingCompleteForUser,
} from '@/lib/onboardingStorage';
import WebPageShell from '@/components/layout/WebPageShell';
import {
  FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY,
  FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY,
} from '@/lib/firstEstimateWalkthroughStorage';
import { resetActiveProjectWalkthroughStorage } from '@/lib/activeProjectWalkthroughStorage';
import { resetAllWalkthroughsForAccount } from '@/lib/walkthroughStateService';

interface SettingItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  type: 'toggle' | 'button' | 'select';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

export default function AccountSettingsScreen() {
  const { darkMode, setDarkMode } = useTheme();
  const { userRole, clearUserRole } = useUserRole();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
    marketingEmails: false,
    autoSync: true,
    locationServices: true,
    analytics: true,
  });

  const handleSettingToggle = (settingKey: string, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings(prev => ({ ...prev, [settingKey]: value }));
  };

  const handleThemeToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDarkMode(!darkMode);
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    clearUserRole();
    setShowLogoutModal(false);
  };

  const handleExportData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Export Data',
      'Your data will be exported to your email address.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => console.log('Exporting data...') },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => console.log('Deleting account...'),
        },
      ]
    );
  };

  const handleResetOnboarding = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Reset Onboarding',
      'This will show the onboarding flow again and clear all current estimate data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset & View',
          onPress: async () => {
            try {
              // Clear onboarding flags
              const uid = clerkAuthService.getAuthState().user?.id;
              if (uid) {
                await clearOnboardingCompleteForUser(uid);
                await resetAllWalkthroughsForAccount(uid);
              } else {
                await clearAllOnboardingCompletionKeys();
              }
              await AsyncStorage.setItem('bps.showEstimateCoachFlags', 'true');
              await AsyncStorage.setItem('bps.showEstimateGuideRail', 'true');
              await AsyncStorage.removeItem('bps.dismissEstimateGuideRail');
              await AsyncStorage.setItem('bps.isFirstTimeEstimate', 'true');
              await AsyncStorage.setItem('bps.forceEstimateOnboarding', 'true');
              
              // Clear all bid storage keys to remove customer information and bid data
              await AsyncStorage.removeItem('bps.currentBid.v2');
              await AsyncStorage.removeItem('bps.currentBid');
              await AsyncStorage.removeItem('bps.currentBid.v1');
              
              // Clear first estimate flags
              await AsyncStorage.removeItem('bps.firstEstimateCreated');
              await AsyncStorage.removeItem('bps.firstEstimateSubmitted');
              await AsyncStorage.removeItem(FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY);
              await AsyncStorage.removeItem(FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY);
              await resetActiveProjectWalkthroughStorage();
              
              // Navigate directly to onboarding
              router.push('/onboarding');
            } catch (error) {
              console.error('Error resetting onboarding:', error);
              Alert.alert('Error', 'Failed to reset onboarding.');
            }
          },
        },
      ]
    );
  };

  const theme = darkMode
    ? {
        background: ['#0b1c38', '#1B365D', '#2d5a3d', '#43cea2'] as [
          any,
          any,
          any,
          any,
        ],
        card: '#142850',
        text: '#fff',
        subtext: '#FFFFFF',
        accent: '#43cea2',
      }
    : {
        background: ['#f5f7fa', '#c3cfe2', '#e8f5e8', '#fff'] as [
          any,
          any,
          any,
          any,
        ],
        card: '#fff',
        text: '#222',
        subtext: '#555',
        accent: '#1976d2',
      };

  const settingItems: SettingItem[] = [
    {
      id: 'theme',
      title: 'Light Mode',
      subtitle: 'Switch between light and dark themes',
      icon: darkMode ? 'light-mode' : 'dark-mode',
      type: 'toggle',
      value: !darkMode,
      onToggle: () => handleThemeToggle(),
    },
    {
      id: 'push',
      title: 'Push Notifications',
      subtitle: 'Receive notifications about leads and projects',
      icon: 'notifications',
      type: 'toggle',
      value: settings.pushNotifications,
      onToggle: value => handleSettingToggle('pushNotifications', value),
    },
    {
      id: 'email',
      title: 'Email Notifications',
      subtitle: 'Receive email updates and reports',
      icon: 'email',
      type: 'toggle',
      value: settings.emailNotifications,
      onToggle: value => handleSettingToggle('emailNotifications', value),
    },
    {
      id: 'sms',
      title: 'SMS Notifications',
      subtitle: 'Receive text message alerts',
      icon: 'sms',
      type: 'toggle',
      value: settings.smsNotifications,
      onToggle: value => handleSettingToggle('smsNotifications', value),
    },
    {
      id: 'marketing',
      title: 'Marketing Emails',
      subtitle: 'Receive promotional content and updates',
      icon: 'campaign',
      type: 'toggle',
      value: settings.marketingEmails,
      onToggle: value => handleSettingToggle('marketingEmails', value),
    },
    {
      id: 'sync',
      title: 'Auto Sync',
      subtitle: 'Automatically sync data when online',
      icon: 'sync',
      type: 'toggle',
      value: settings.autoSync,
      onToggle: value => handleSettingToggle('autoSync', value),
    },
    {
      id: 'location',
      title: 'Location Services',
      subtitle: 'Use location for project tracking',
      icon: 'location-on',
      type: 'toggle',
      value: settings.locationServices,
      onToggle: value => handleSettingToggle('locationServices', value),
    },
    {
      id: 'analytics',
      title: 'Analytics',
      subtitle: 'Help improve the app with usage data',
      icon: 'analytics',
      type: 'toggle',
      value: settings.analytics,
      onToggle: value => handleSettingToggle('analytics', value),
    },
    {
      id: 'export',
      title: 'Export Data',
      subtitle: 'Download your data as a backup',
      icon: 'file-download',
      type: 'button',
      onPress: handleExportData,
    },
    {
      id: 'logout',
      title: 'Sign Out',
      subtitle: 'Sign out of your account',
      icon: 'logout',
      type: 'button',
      onPress: handleLogout,
    },
    {
      id: 'delete',
      title: 'Delete Account',
      subtitle: 'Permanently delete your account and data',
      icon: 'delete-forever',
      type: 'button',
      onPress: handleDeleteAccount,
    },
    {
      id: 'reset-onboarding',
      title: 'Reset Onboarding',
      subtitle: 'Show onboarding flow again (dev/test)',
      icon: 'refresh',
      type: 'button',
      onPress: handleResetOnboarding,
    },
  ];

  const renderSettingItem = (item: SettingItem) => (
    <View
      key={item.id}
      style={[styles.settingItem, { backgroundColor: theme.card }]}
    >
      <View style={styles.settingLeft}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: theme.accent + '20' },
          ]}
        >
          <MaterialIcons
            name={item.icon as any}
            size={24}
            color={theme.accent}
          />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: theme.text }]}>
            {item.title}
          </Text>
          <Text style={[styles.settingSubtitle, { color: theme.subtext }]}>
            {item.subtitle}
          </Text>
        </View>
      </View>

      {item.type === 'toggle' && (
        <Switch
          value={item.value}
          onValueChange={item.onToggle}
          trackColor={{ false: '#767577', true: theme.accent }}
          thumbColor={item.value ? '#fff' : '#f4f3f4'}
        />
      )}

      {item.type === 'button' && (
        <TouchableOpacity onPress={item.onPress}>
          <MaterialIcons name='chevron-right' size={24} color={theme.subtext} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <LinearGradient colors={theme.background} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={Platform.OS === 'web' ? { paddingHorizontal: 0 } : undefined}
        showsVerticalScrollIndicator={false}
      >
        <WebPageShell size="profile" scroll={false} contentStyle={{ paddingBottom: 0 }}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Account Settings
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
            Manage your account preferences and privacy
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Appearance
          </Text>
          {settingItems
            .filter(item => item.id === 'theme')
            .map(renderSettingItem)}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Notifications
          </Text>
          {settingItems
            .filter(item =>
              ['push', 'email', 'sms', 'marketing'].includes(item.id)
            )
            .map(renderSettingItem)}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Privacy & Data
          </Text>
          {settingItems
            .filter(item => ['sync', 'location', 'analytics'].includes(item.id))
            .map(renderSettingItem)}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Account
          </Text>
          {settingItems
            .filter(item => ['export', 'reset-onboarding'].includes(item.id))
            .map(renderSettingItem)}
        </View>

        {/* iOS-style Action Buttons */}
        <View style={styles.actionButtonsSection}>
          <TouchableOpacity
            style={[
              styles.iosButton,
              styles.logoutButton,
              {
                backgroundColor: darkMode ? '#2a2a2a' : (theme as any).cardDark ?? theme.card,
                shadowOpacity: darkMode ? 0.3 : 0.1,
                borderColor: darkMode
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name='logout'
              size={20}
              color={darkMode ? '#fff' : '#007AFF'}
              style={styles.buttonIcon}
            />
            <Text
              style={[
                styles.iosButtonText,
                { color: darkMode ? '#fff' : '#007AFF' },
              ]}
            >
              Sign Out
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.iosButton,
              styles.deleteButton,
              {
                backgroundColor: darkMode ? '#2a1a1a' : theme.card,
                shadowOpacity: darkMode ? 0.3 : 0.1,
                borderColor: darkMode
                  ? 'rgba(255, 59, 48, 0.3)'
                  : 'rgba(255, 59, 48, 0.2)',
              },
            ]}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name='delete-forever'
              size={20}
              color='#FF3B30'
              style={styles.buttonIcon}
            />
            <Text style={[styles.iosButtonText, styles.deleteButtonText]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.subtext }]}>
            Build Profit Solutions v1.0.0
          </Text>
        </View>
        </WebPageShell>
      </ScrollView>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType='fade'
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <MaterialIcons
              name='logout'
              size={48}
              color={theme.accent}
              style={styles.modalIcon}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Sign Out
            </Text>
            <Text style={[styles.modalMessage, { color: theme.subtext }]}>
              Are you sure you want to sign out? You can sign back in anytime.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  {
                    backgroundColor: darkMode ? '#2a2a2a' : (theme as any).cardDark ?? theme.card,
                  },
                ]}
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    { color: darkMode ? '#fff' : '#007AFF' },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmLogout}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: '85%',
    maxWidth: 320,
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cancelButton: {
    // Background color set dynamically
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    // Color set dynamically
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  actionButtonsSection: {
    marginBottom: 30,
    paddingHorizontal: 0,
    marginTop: 8,
  },
  iosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    minHeight: 50,
  },
  logoutButton: {
    // iOS-style secondary button
  },
  deleteButton: {
    // iOS-style destructive button
    borderColor: 'rgba(255, 59, 48, 0.3)',
    marginTop: 4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  iosButtonText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  deleteButtonText: {
    color: '#FF3B30',
  },
});
