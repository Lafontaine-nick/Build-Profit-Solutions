import React, { useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';

export default function ContactSupportScreen() {
  const router = useRouter();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const theme = {
    background: ['#0b1c38', '#1B365D', '#43cea2'] as [string, string, string],
    text: '#FFFFFF',
    subtext: '#CFE6FF',
    accent: '#43cea2',
    border: 'rgba(67, 206, 162, 0.25)',
    softBorder: 'rgba(255, 255, 255, 0.12)',
    iconBg: 'rgba(67, 206, 162, 0.15)',
    inputBg: 'rgba(255, 255, 255, 0.06)',
  };

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
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.back();
                }}
                style={[
                  styles.backButtonCircle,
                  {
                    backgroundColor: 'rgba(67, 206, 162, 0.2)',
                    borderColor: 'rgba(67, 206, 162, 0.3)',
                  },
                ]}
              >
                <MaterialIcons name='arrow-back' size={24} color='#FFFFFF' />
              </TouchableOpacity>
              <View style={styles.titleContainer}>
                <Text style={[styles.title, { color: '#FFFFFF' }]}>
                  Contact Support
                </Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.contentCard}>
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps='handled'
              >
                {/* Quick Contact Options */}
                <View style={styles.sectionCard}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Quick Contact
                </Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.subtext }]}>
                  Reach us directly via email or phone
                </Text>

                  <TouchableOpacity
                    style={styles.quickContactRow}
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
                      <Text style={[styles.quickContactValue, { color: theme.subtext }]}>
                        support@buildprofitsolutions.com
                      </Text>
                    </View>
                    <MaterialIcons name='chevron-right' size={20} color={theme.subtext} />
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
                      <Text style={[styles.quickContactValue, { color: theme.subtext }]}>
                        (702) 861-8618
                      </Text>
                    </View>
                    <MaterialIcons name='chevron-right' size={20} color={theme.subtext} />
                  </TouchableOpacity>
                </View>

                {/* Contact Form */}
                <View style={styles.sectionCard}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Send us a Message
                </Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.subtext }]}>
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
                          backgroundColor: theme.inputBg,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder='Enter your name'
                      placeholderTextColor='rgba(255, 255, 255, 0.6)'
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
                          backgroundColor: theme.inputBg,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder='Enter your email'
                      placeholderTextColor='rgba(255, 255, 255, 0.6)'
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
                          backgroundColor: theme.inputBg,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder='What is this regarding?'
                      placeholderTextColor='rgba(255, 255, 255, 0.6)'
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
                          backgroundColor: theme.inputBg,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder='Describe your issue or question...'
                      placeholderTextColor='rgba(255, 255, 255, 0.6)'
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
                <View style={styles.infoCard}>
                  <MaterialIcons name='info-outline' size={20} color={theme.accent} />
                  <Text style={[styles.infoText, { color: theme.subtext }]}>
                    We typically respond within 24 hours during business days
                  </Text>
                </View>
              </ScrollView>
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    position: 'relative',
  },
  backButtonCircle: {
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  quickContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
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
    fontSize: 14,
  },
  form: {
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

