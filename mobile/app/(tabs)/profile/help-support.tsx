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
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useTabScrollBottomInset } from '@/hooks/useTabScrollBottomInset';
import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import HelpSupportSubpageWebHeader from '@/components/profile/HelpSupportSubpageWebHeader';
import WebPageShell from '@/components/layout/WebPageShell';
import {
  PROFILE_HELP_CHROME_H_MARGIN,
  useWebProfileHelpHeaderMargins,
} from '@/lib/useWebProfileHelpHeaderMargins';

interface SettingsRowProps {
  iconName?: keyof typeof MaterialIcons.glyphMap;
  icon?: string;
  label: string;
  onPress: () => void;
}

const SettingsRow = ({ iconName, icon, label, onPress }: SettingsRowProps) => {
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: Colors.line }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: Colors.iconBg || 'rgba(67, 206, 162, 0.15)' }]}>
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
    router.push('/(tabs)/leads');
  };


  const handleBillingQuestions = () => {
    // Navigate to payment/billing section
    router.push('/payment');
  };

  const handleRefundPolicy = () => {
    // Navigate to legal hub or refund policy
    router.push('/legal-hub?tab=refund');
  };

  // Use same theme system as payment page
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
            <View style={[styles.headerRow, webHelpHeaderMargins]}>
              <View style={styles.backButtonWrapper}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.backButtonBorder}
                >
                  <GradientRingBackInner
                    darkMode={darkMode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.back();
                    }}
                    style={[styles.backButton, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}
                  >
                    <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>
              <View style={styles.titleContainer}>
                <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>Help & Support</Text>
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
                  {/* Tutorials & Guides */}
                  <View style={[styles.sectionCard, { backgroundColor: Colors.surface2 }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: Colors.line }]}>
                  <MaterialIcons name='menu-book' size={22} color={Colors.primary} />
                  <Text style={[styles.sectionTitle, { color: Colors.text }]}>
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
              <View style={[styles.sectionCard, { backgroundColor: Colors.surface2 }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: Colors.line }]}>
                  <MaterialIcons name='help-outline' size={22} color={Colors.primary} />
                  <Text style={[styles.sectionTitle, { color: Colors.text }]}>
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
              <View style={[styles.sectionCard, { backgroundColor: Colors.surface2 }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: Colors.line }]}>
                  <MaterialIcons name='payment' size={22} color={Colors.primary} />
                  <Text style={[styles.sectionTitle, { color: Colors.text }]}>
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
              <View style={[styles.sectionCard, { backgroundColor: Colors.surface2 }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: Colors.line }]}>
                  <MaterialIcons name='check-circle' size={22} color={Colors.primary} />
                  <Text style={[styles.sectionTitle, { color: Colors.text }]}>
                    System Status
                  </Text>
                </View>

                <View style={styles.statusRow}>
                  <View style={styles.iconContainer}>
                    <View style={styles.statusDot} />
                  </View>
                  <View style={styles.statusTextContainer}>
                    <Text style={[styles.statusTitle, { color: darkMode ? "#FFFFFF" : "#000000" }]}>
                      All Systems Operational
                    </Text>
                    <Text style={[styles.statusSubtitle, { color: darkMode ? "#FFFFFF" : "#000000" }]}>
                      Our servers and AI services are running normally.
                    </Text>
                  </View>
                </View>
              </View>
                </View>
              </View>
            </LinearGradient>
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
    padding: 16,
  },
  sectionCard: {
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 0,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 12,
    ...(Platform.OS === 'web' ? {} : { marginHorizontal: 20 }),
    position: 'relative',
  },
  backButtonWrapper: {
    zIndex: 1,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 20,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.15,
  },
  backButtonBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 19,
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
    borderRadius: 12,
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
