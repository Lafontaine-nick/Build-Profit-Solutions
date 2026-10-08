import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useTabScrollBottomInset } from '@/hooks/useTabScrollBottomInset';
import { isLeadsNetworkingReleased } from '@/constants/releaseFlags';
import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import HelpSupportSubpageWebHeader from '@/components/profile/HelpSupportSubpageWebHeader';
import BackButton from '@/components/ui/BackButton';
import WebPageShell from '@/components/layout/WebPageShell';
import { PHONE_CARD_GUTTER } from '@/constants/ScreenLayout';
import {
  PROFILE_HELP_CHROME_H_MARGIN,
  useWebProfileHelpHeaderMargins,
} from '@/lib/useWebProfileHelpHeaderMargins';

interface SettingsRowProps {
  iconName?: keyof typeof MaterialIcons.glyphMap;
  icon?: string;
  label: string;
  onPress: () => void;
  last?: boolean;
}

const SettingsRow = ({ iconName, icon, label, onPress, last }: SettingsRowProps) => {
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  
  return (
    <TouchableOpacity
      style={[
        styles.row,
        {
          borderBottomColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line,
          borderBottomWidth: last ? 0 : 1,
        },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: darkMode ? '#3A3A3C' : '#e2e8f0' }]}>
        {iconName ? (
          <MaterialIcons 
            name={iconName} 
            size={20} 
            color={Colors.primary} 
          />
        ) : icon ? (
          <Text style={[styles.iconText, { color: Colors.primary }]}>
            {icon}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowLabel, { color: Colors.text }]}>
        {label}
      </Text>
      <MaterialIcons 
        name='chevron-right' 
        size={20} 
        color={Colors.sub} 
      />
    </TouchableOpacity>
  );
};

export default function HelpSupportScreen() {
  const tabScrollBottomInset = useTabScrollBottomInset();
  const router = useRouter();
  const webHelpHeaderMargins = useWebProfileHelpHeaderMargins();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);

  // Navigation handlers - create placeholder screens or handle inline
  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/profile/contact-support');
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
    router.push('/(tabs)/leads');
  };


  const handleRefundPolicy = () => {
    // Navigate to legal hub or refund policy
    router.push('/legal-hub?tab=refund');
  };

  // Use same theme system as payment page
  const sectionCardStyle = [
    styles.sectionCard,
    {
      backgroundColor: darkMode ? '#1C1D20' : Colors.surface2,
      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
    },
  ];

  const helpSections = (
    <>
      <View style={sectionCardStyle}>
        <View style={[styles.sectionHeader, { borderBottomColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line }]}>
          <MaterialIcons name='menu-book' size={22} color={Colors.primary} />
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>
            Tutorials & Guides
          </Text>
        </View>
        <SettingsRow iconName='play-circle-outline' label='Getting Started' onPress={handleGettingStarted} />
        <SettingsRow iconName='calculate' label='How to Create an Estimate' onPress={handleCreateEstimate} />
        <SettingsRow
          iconName='folder'
          label='Project Management'
          onPress={handleProjectManagement}
          last={!isLeadsNetworkingReleased()}
        />
        {isLeadsNetworkingReleased() ? (
          <SettingsRow iconName='people' label='Lead Management' onPress={handleLeadManagement} last />
        ) : null}
      </View>

      <View style={sectionCardStyle}>
        <View style={[styles.sectionHeader, { borderBottomColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line }]}>
          <MaterialIcons name='help-outline' size={22} color={Colors.primary} />
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Quick Help</Text>
        </View>
        <SettingsRow iconName='support-agent' label='Contact Support' onPress={handleContactSupport} last />
      </View>

      <View style={sectionCardStyle}>
        <View style={[styles.sectionHeader, { borderBottomColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line }]}>
          <MaterialIcons name='payment' size={22} color={Colors.primary} />
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Billing Support</Text>
        </View>
        <SettingsRow iconName='receipt' label='Refund Policy' onPress={handleRefundPolicy} last />
      </View>

      <View style={sectionCardStyle}>
        <View style={[styles.sectionHeader, { borderBottomColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line }]}>
          <MaterialIcons name='check-circle' size={22} color={Colors.primary} />
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>System Status</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.iconContainer, { backgroundColor: darkMode ? '#3A3A3C' : '#e2e8f0' }]}>
            <View style={[styles.statusDot, { marginRight: 0 }]} />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusTitle, { color: darkMode ? '#FFFFFF' : '#000000' }]}>
              All Systems Operational
            </Text>
            <Text style={[styles.statusSubtitle, { color: Colors.sub }]}>
              Servers and AI services are running normally.
            </Text>
          </View>
        </View>
      </View>
    </>
  );

  const theme = useMemo(() => ({
    background: [Colors.bg, Colors.bg, Colors.bg] as [string, string, string],
    card: Colors.surface2,
    text: Colors.text,
    subtext: Colors.sub,
    accent: Colors.primary,
    border: Colors.line,
    iconBg: Colors.iconBg || 'rgba(67, 206, 162, 0.15)',
  }), [Colors]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.background} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header — web: shared payment-style row; native: centered title */}
          {Platform.OS === 'web' ? (
            <HelpSupportSubpageWebHeader
              title='Help & Support'
              darkMode={darkMode}
              lightBg={Colors.bg}
              webHelpHeaderMargins={webHelpHeaderMargins}
            />
          ) : (
            <View style={styles.headerRow}>
              <View style={styles.backButton}>
                <BackButton darkMode={darkMode} onPress={() => router.back()} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={[styles.screenTitle, { color: darkMode ? '#f9fafb' : '#000000' }]}>
                  Help & Support
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
                  Guides and billing
                </Text>
              </View>
            </View>
          )}

          {/* Content Card */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: Platform.OS === 'web' ? 0 : 16,
              paddingBottom: tabScrollBottomInset,
              paddingHorizontal: 0,
            }}
            showsVerticalScrollIndicator={true}
          >
            <WebPageShell size="profile" scroll={false} contentStyle={{ paddingBottom: 0 }}>
            {Platform.OS === 'web' ? (
            <LinearGradient
              colors={["#2DFFC4", "#00A6FF"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.chromeFrame}
            >
              <View
                style={[
                  styles.contentCard,
                  {
                    backgroundColor: darkMode ? Colors.cardDark : Colors.bg,
                    borderColor: Colors.line,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={styles.content}>
                  {helpSections}
                </View>
              </View>
            </LinearGradient>
            ) : (
              <View style={styles.content}>{helpSections}</View>
            )}
            </WebPageShell>
          </ScrollView>
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
    borderRadius: 23,
    overflow: 'visible',
  },
  content: {
    paddingHorizontal: Platform.OS === 'web' ? 8 : PHONE_CARD_GUTTER,
    paddingBottom: 8,
  },
  sectionCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  chromeFrame: {
    borderRadius: 24,
    padding: 1,
    marginHorizontal: PROFILE_HELP_CHROME_H_MARGIN,
    marginBottom: 16,
  },
  headerRow: {
    position: 'relative',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
    marginHorizontal: Platform.OS === 'web' ? 8 : PHONE_CARD_GUTTER,
  },
  headerCopy: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 52,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
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
  },
  statusSubtitle: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.65,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    marginRight: 12,
  },
});
