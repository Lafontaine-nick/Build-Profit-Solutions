import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useTabScrollBottomInset } from '@/hooks/useTabScrollBottomInset';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { FORM_KEYBOARD_SCROLL_PROPS } from '@/constants/keyboardScrollProps';
import { resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import HelpSupportSubpageWebHeader from '@/components/profile/HelpSupportSubpageWebHeader';
import BackButton from '@/components/ui/BackButton';
import WebPageShell from '@/components/layout/WebPageShell';
import { PHONE_CARD_GUTTER } from '@/constants/ScreenLayout';
import {
  PROFILE_HELP_CHROME_H_MARGIN,
  useWebProfileHelpHeaderMargins,
} from '@/lib/useWebProfileHelpHeaderMargins';

export default function ContactSupportScreen() {
  const tabScrollBottomInset = useTabScrollBottomInset();
  const router = useRouter();
  const webHelpHeaderMargins = useWebProfileHelpHeaderMargins();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const theme = useMemo(() => ({
    background: [Colors.bg, Colors.bg, Colors.bg] as [string, string, string],
    card: darkMode ? '#1C1D20' : Colors.surface2,
    text: Colors.text,
    subtext: Colors.sub,
    accent: Colors.primary,
    border: Colors.line,
    softBorder: Colors.line,
    iconBg: Colors.iconBg || 'rgba(67, 206, 162, 0.15)',
    inputBg: darkMode ? '#2C2C2E' : 'rgba(0, 0, 0, 0.08)',
  }), [Colors, darkMode]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validate form
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!formData.email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (!formData.subject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }
    if (!formData.message.trim()) {
      Alert.alert('Error', 'Please enter your message');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // TODO: Implement actual API call to submit support ticket
      // For now, we'll simulate a submission
      await new Promise((resolve) => setTimeout(resolve, 1500));

      Alert.alert(
        'Message Sent!',
        'Thank you for contacting us. We\'ll get back to you as soon as possible.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Clear form and go back
              setFormData({ name: '', email: '', subject: '', message: '' });
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPress = async () => {
    const email = 'support@buildprofitsolutions.com';
    const subject = encodeURIComponent(formData.subject || 'Support Request');
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
    );
    const url = `mailto:${email}?subject=${subject}&body=${body}`;
    
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open email client');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open email client');
    }
  };

  const handlePhonePress = async () => {
    const phoneNumber = 'tel:+17028618618';
    try {
      const canOpen = await Linking.canOpenURL(phoneNumber);
      if (canOpen) {
        await Linking.openURL(phoneNumber);
      } else {
        Alert.alert('Error', 'Unable to open phone dialer');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open phone dialer');
    }
  };

  const iconWell = darkMode ? '#3A3A3C' : '#e2e8f0';
  const cardBorder = darkMode ? 'rgba(255,255,255,0.08)' : theme.border;

  const pageBody = (
    <>
      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Contact</Text>
        <TouchableOpacity
          style={[styles.quickContactRow, { borderBottomColor: darkMode ? 'rgba(255,255,255,0.1)' : theme.border }]}
          onPress={handleEmailPress}
          activeOpacity={0.7}
        >
          <View style={[styles.quickContactIcon, { backgroundColor: iconWell }]}>
            <MaterialIcons name="email" size={20} color={theme.accent} />
          </View>
          <View style={styles.quickContactText}>
            <Text style={[styles.quickContactLabel, { color: theme.text }]}>Email</Text>
            <Text style={[styles.quickContactValue, { color: theme.subtext }]}>
              support@buildprofitsolutions.com
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={theme.subtext} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickContactRowLast} onPress={handlePhonePress} activeOpacity={0.7}>
          <View style={[styles.quickContactIcon, { backgroundColor: iconWell }]}>
            <MaterialIcons name="phone" size={20} color={theme.accent} />
          </View>
          <View style={styles.quickContactText}>
            <Text style={[styles.quickContactLabel, { color: theme.text }]}>Phone</Text>
            <Text style={[styles.quickContactValue, { color: theme.subtext }]}>(702) 861-8618</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={theme.subtext} />
        </TouchableOpacity>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Send a message</Text>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Name <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0, 0, 0, 0.15)',
                  color: theme.text,
                  textAlign: 'left',
                },
              ]}
              placeholder="Enter your name"
              placeholderTextColor="#8E8E93"
              value={formData.name}
              onChangeText={(value) => handleInputChange('name', value)}
              autoCapitalize="words"
              {...resolveTextInputKeyboardProps()}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Email <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0, 0, 0, 0.15)',
                  color: theme.text,
                  textAlign: 'left',
                },
              ]}
              placeholder="Enter your email"
              placeholderTextColor="#8E8E93"
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              {...resolveTextInputKeyboardProps({ keyboardType: 'email-address' })}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Subject <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0, 0, 0, 0.15)',
                  color: theme.text,
                  textAlign: 'left',
                },
              ]}
              placeholder="What is this regarding?"
              placeholderTextColor="#8E8E93"
              value={formData.subject}
              onChangeText={(value) => handleInputChange('subject', value)}
              {...resolveTextInputKeyboardProps()}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Message <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <View>
              {!formData.message ? (
                <Text style={styles.messagePlaceholder} pointerEvents="none">
                  Describe your issue or question...
                </Text>
              ) : null}
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0, 0, 0, 0.15)',
                    color: theme.text,
                    textAlign: 'left',
                  },
                ]}
                placeholder=""
                value={formData.message}
                onChangeText={(value) => handleInputChange('message', value)}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                {...resolveTextInputKeyboardProps({ multiline: true })}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.accent, opacity: loading ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#04120C" />
            ) : (
              <Text style={styles.submitButtonText}>Send Message</Text>
            )}
          </TouchableOpacity>
          <Text style={[styles.infoText, { color: theme.subtext }]}>
            We typically reply within one business day.
          </Text>
        </View>
      </View>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.background} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            {Platform.OS === 'web' ? (
              <HelpSupportSubpageWebHeader
                title='Contact Support'
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
                    Contact Support
                  </Text>
                  <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
                    Email, phone, or a message
                  </Text>
                </View>
              </View>
            )}

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingTop: Platform.OS === 'web' ? 0 : 16,
              paddingBottom: tabScrollBottomInset,
                paddingHorizontal: 0,
              }}
              showsVerticalScrollIndicator={true}
              {...FORM_KEYBOARD_SCROLL_PROPS}
            >
              <WebPageShell size="profile" scroll={false} contentStyle={{ paddingBottom: 0 }}>
              {Platform.OS === 'web' ? (
              <LinearGradient
                colors={["#2DFFC4", "#00A6FF"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.chromeFrame}
              >
                <View style={[styles.contentCard, { backgroundColor: darkMode ? Colors.cardDark : Colors.bg }]}>
                  <View style={styles.scrollContent}>
                    {pageBody}
                  </View>
                </View>
              </LinearGradient>
              ) : (
                <View style={styles.scrollContent}>{pageBody}</View>
              )}

              </WebPageShell>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
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
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  chromeFrame: {
    borderRadius: 24,
    padding: 1,
    marginHorizontal: PROFILE_HELP_CHROME_H_MARGIN,
    marginBottom: 16,
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
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  contentCard: {
    borderRadius: 23,
    overflow: 'visible',
  },
  scrollContent: {
    paddingHorizontal: Platform.OS === 'web' ? 8 : PHONE_CARD_GUTTER,
    paddingBottom: 8,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 20,
  },
  quickContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  quickContactRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
  },
  quickContactIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickContactText: {
    flex: 1,
  },
  quickContactLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  quickContactValue: {
    fontSize: 13,
  },
  form: {
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 14,
    paddingBottom: 12,
    fontSize: 16,
  },
  messagePlaceholder: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 18,
    zIndex: 1,
    color: '#8E8E93',
    fontSize: 16,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#04120C',
    fontSize: 16,
    fontWeight: '700',
  },
  infoText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});

