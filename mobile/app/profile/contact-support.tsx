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
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import GradientRingBackInner from '@/components/GradientRingBackInner';

export default function ContactSupportScreen() {
  const router = useRouter();
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
    card: Colors.surface2,
    text: Colors.text,
    subtext: Colors.sub,
    accent: Colors.primary,
    border: Colors.line,
    softBorder: Colors.line,
    iconBg: Colors.iconBg || 'rgba(67, 206, 162, 0.15)',
    inputBg: Colors.surface2,
  }), [Colors]);

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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.background} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            {/* Header */}
            <View style={styles.headerRow}>
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
                <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>
                  Contact Support
                </Text>
              </View>
              <View style={styles.backButtonWrapper} />
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 40, paddingHorizontal: 0 }}
              showsVerticalScrollIndicator={true}
              {...KEYBOARD_SCROLL_DEFAULTS}
            >
              <LinearGradient
                colors={["#2DFFC4", "#00A6FF"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={{ borderRadius: 24, padding: 1, marginHorizontal: 8, marginBottom: 16 }}
              >
                <View style={[styles.contentCard, { backgroundColor: theme.background[0] }]}>
                  <View style={styles.scrollContent}>
                    {/* Quick Contact Options */}
                    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        Quick Contact
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                        Reach us directly via email or phone
                      </Text>

                      <TouchableOpacity
                        style={[styles.quickContactRow, { borderBottomColor: theme.border }]}
                        onPress={handleEmailPress}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.quickContactIcon, { backgroundColor: theme.iconBg }]}>
                          <MaterialIcons name='email' size={24} color={theme.accent} />
                        </View>
                        <View style={styles.quickContactText}>
                          <Text style={[styles.quickContactLabel, { color: theme.text }]}>
                            Email Support
                          </Text>
                          <Text style={[styles.quickContactValue, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                            support@buildprofitsolutions.com
                          </Text>
                        </View>
                        <MaterialIcons name='chevron-right' size={20} color={theme.subtext} style={{ opacity: darkMode ? 0.85 : 0.7 }} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.quickContactRow}
                        onPress={handlePhonePress}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.quickContactIcon, { backgroundColor: theme.iconBg }]}>
                          <MaterialIcons name='phone' size={24} color={theme.accent} />
                        </View>
                        <View style={styles.quickContactText}>
                          <Text style={[styles.quickContactLabel, { color: theme.text }]}>
                            Phone Support
                          </Text>
                          <Text style={[styles.quickContactValue, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                            (702) 861-8618
                          </Text>
                        </View>
                        <MaterialIcons name='chevron-right' size={20} color={theme.subtext} style={{ opacity: darkMode ? 0.85 : 0.7 }} />
                      </TouchableOpacity>
                    </View>

                    {/* Contact Form */}
                    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        Send us a Message
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                        Fill out the form below and we'll get back to you soon
                      </Text>

                <View style={styles.form}>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.text }]}>
                          Name <Text style={{ color: '#ef4444' }}>*</Text>
                        </Text>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              backgroundColor: darkMode ? theme.inputBg : 'rgba(0, 0, 0, 0.08)',
                              borderColor: darkMode ? theme.border : 'rgba(0, 0, 0, 0.15)',
                              color: theme.text,
                            },
                          ]}
                          placeholder='Enter your name'
                          placeholderTextColor={theme.subtext}
                          value={formData.name}
                          onChangeText={(value) => handleInputChange('name', value)}
                          autoCapitalize='words'
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
                              backgroundColor: darkMode ? theme.inputBg : 'rgba(0, 0, 0, 0.08)',
                              borderColor: darkMode ? theme.border : 'rgba(0, 0, 0, 0.15)',
                              color: theme.text,
                            },
                          ]}
                          placeholder='Enter your email'
                          placeholderTextColor={theme.subtext}
                          value={formData.email}
                          onChangeText={(value) => handleInputChange('email', value)}
                          keyboardType='email-address'
                          autoCapitalize='none'
                          autoCorrect={false}
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
                              backgroundColor: darkMode ? theme.inputBg : 'rgba(0, 0, 0, 0.08)',
                              borderColor: darkMode ? theme.border : 'rgba(0, 0, 0, 0.15)',
                              color: theme.text,
                            },
                          ]}
                          placeholder='What is this regarding?'
                          placeholderTextColor={theme.subtext}
                          value={formData.subject}
                          onChangeText={(value) => handleInputChange('subject', value)}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.text }]}>
                          Message <Text style={{ color: '#ef4444' }}>*</Text>
                        </Text>
                        <TextInput
                          style={[
                            styles.textArea,
                            {
                              backgroundColor: darkMode ? theme.inputBg : 'rgba(0, 0, 0, 0.08)',
                              borderColor: darkMode ? theme.border : 'rgba(0, 0, 0, 0.15)',
                              color: theme.text,
                            },
                          ]}
                          placeholder='Describe your issue or question...'
                          placeholderTextColor={theme.subtext}
                          value={formData.message}
                          onChangeText={(value) => handleInputChange('message', value)}
                          multiline
                          numberOfLines={6}
                          textAlignVertical='top'
                        />
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.submitButton,
                          {
                            opacity: loading ? 0.7 : 1,
                          },
                        ]}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.8}
                      >
                        {loading ? (
                          <ActivityIndicator color='#FFFFFF' />
                        ) : (
                          <>
                            <MaterialIcons name='send' size={20} color='#FFFFFF' />
                            <Text style={styles.submitButtonText}>Send Message</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      </View>
                    </View>

                    {/* Response Time Info */}
                    <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <MaterialIcons name='info-outline' size={20} color={theme.accent} />
                      <Text style={[styles.infoText, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                        We typically respond within 24 hours during business days
                      </Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 40,
    marginBottom: 12,
    marginHorizontal: 20,
    position: 'relative',
  },
  backButtonWrapper: {
    width: 42,
    zIndex: 1,
    alignItems: 'center',
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
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  contentCard: {
    borderRadius: 23,
    overflow: 'visible',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 20,
  },
  quickContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  quickContactIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
    backgroundColor: '#43cea2',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});

