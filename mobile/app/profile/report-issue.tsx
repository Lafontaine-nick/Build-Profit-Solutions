import React, { useState, useEffect, useMemo } from 'react';
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
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clerkAuthService } from '@/services/clerkAuth';
import Constants from 'expo-constants';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';

// Try to import Clerk hooks
let useUser: any = null;
try {
  const clerkModule = require('@clerk/clerk-expo');
  useUser = clerkModule.useUser;
} catch (e) {
  // Clerk not available
}

export default function ReportIssueScreen() {
  const router = useRouter();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  // Get user email from Clerk or stored profile
  useEffect(() => {
    let mounted = true;
    
    const getEmail = async () => {
      let email: string | null = null;
      
      // Try Clerk hook first
      if (useUser) {
        try {
          const { user } = useUser();
          email = user?.emailAddresses?.[0]?.emailAddress || 
                  user?.primaryEmailAddress?.emailAddress || 
                  null;
        } catch (e) {
          // Not in ClerkProvider
        }
      }
      
      // Fallback to clerkAuthService
      if (!email) {
        try {
          const authState = clerkAuthService.getAuthState();
          email = authState?.user?.email || null;
        } catch (e) {
          // Could not get email
        }
      }
      
      // Final fallback: get email from stored profile
      if (!email) {
        try {
          const profileData = await AsyncStorage.getItem('bps.contractorProfile');
          if (profileData) {
            const profile = JSON.parse(profileData);
            if (profile.email) {
              email = profile.email;
            }
          }
        } catch (e) {
          // Invalid JSON
        }
      }
      
      if (mounted) {
        setUserEmail(email);
      }
    };
    
    getEmail();
    return () => { mounted = false; };
  }, []);

  const issueCategories = [
    { id: 'bug', label: 'Bug Report', icon: 'bug-report' },
    { id: 'feature', label: 'Feature Request', icon: 'lightbulb-outline' },
    { id: 'performance', label: 'Performance Issue', icon: 'speed' },
    { id: 'ui', label: 'UI/UX Issue', icon: 'palette' },
    { id: 'other', label: 'Other', icon: 'help-outline' },
  ];

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

  const getApiBaseUrl = () => {
    const apiBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl || 
                       Constants.expoConfig?.extra?.devApiBaseUrl ||
                       process.env.EXPO_PUBLIC_API_BASE_URL;
    
    // Remove /api suffix if present, we'll add it back
    const base = apiBaseUrl?.replace(/\/api$/, '') || 'http://localhost:3001';
    return `${base}/api`;
  };

  const handleSubmit = async () => {
    // Validate form
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select an issue category');
      return;
    }
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title for your issue');
      return;
    }
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Please describe the issue');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/support-tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: selectedCategory,
          title: formData.title.trim(),
          description: formData.description.trim(),
          userEmail: userEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit report' }));
        throw new Error(errorData.error || 'Failed to submit issue report');
      }

      const result = await response.json();

      console.log('✅ Issue report submitted successfully:', result);

      Alert.alert(
        'Issue Reported!',
        'Thank you for reporting this issue. Our team will review it and get back to you soon.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Clear form and go back
              setSelectedCategory(null);
              setFormData({
                title: '',
                description: '',
              });
              router.back();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error submitting issue report:', error);
      Alert.alert(
        'Error', 
        error?.message || 'Failed to submit issue report. Please try again.'
      );
    } finally {
      setLoading(false);
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
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.backButtonBorder}
                >
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.back();
                    }}
                    style={[styles.backButton, { backgroundColor: darkMode ? "#000000" : "#FFFFFF" }]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
                  </TouchableOpacity>
                </LinearGradient>
              </View>
              <View style={styles.titleContainer}>
                <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>
                  Report an Issue
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
                    {/* Issue Category Selection */}
                    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        Issue Category <Text style={{ color: '#ef4444' }}>*</Text>
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                        Select the type of issue you're experiencing
                      </Text>

                      <View style={styles.categoryGrid}>
                        {issueCategories.map((category) => {
                          const isSelected = selectedCategory === category.id;
                          return (
                            <TouchableOpacity
                              key={category.id}
                              style={[
                                styles.categoryButton,
                                {
                                  borderColor: isSelected ? theme.accent : theme.border,
                                  backgroundColor: isSelected
                                    ? theme.iconBg
                                    : darkMode
                                    ? theme.card
                                    : 'rgba(0, 0, 0, 0.08)',
                                  borderWidth: isSelected ? 2 : 1,
                                },
                              ]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setSelectedCategory(category.id);
                              }}
                              activeOpacity={0.8}
                            >
                              <MaterialIcons
                                name={category.icon as any}
                                size={24}
                                color={isSelected ? theme.accent : theme.subtext}
                                style={{ opacity: !isSelected ? (darkMode ? 0.85 : 0.85) : 1 }}
                              />
                              <Text
                                style={[
                                  styles.categoryLabel,
                                  { color: isSelected ? theme.accent : theme.text },
                                ]}
                              >
                                {category.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Issue Report Form */}
                    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        Issue Details
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                        Provide as much detail as possible to help us resolve your issue
                      </Text>

                      <View style={styles.form}>
                        <View style={styles.inputGroup}>
                          <Text style={[styles.label, { color: theme.text }]}>
                            Title <Text style={{ color: '#ef4444' }}>*</Text>
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
                            placeholder='Brief summary of the issue'
                            placeholderTextColor={theme.subtext}
                            value={formData.title}
                            onChangeText={(value) => handleInputChange('title', value)}
                          />
                        </View>

                        <View style={styles.inputGroup}>
                          <Text style={[styles.label, { color: theme.text }]}>
                            Description <Text style={{ color: '#ef4444' }}>*</Text>
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
                            placeholder='Describe the issue in detail...'
                            placeholderTextColor={theme.subtext}
                            value={formData.description}
                            onChangeText={(value) =>
                              handleInputChange('description', value)
                            }
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
                              <MaterialIcons name='report-problem' size={20} color='#FFFFFF' />
                              <Text style={styles.submitButtonText}>Submit Report</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Help Info */}
                    <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <MaterialIcons name='info-outline' size={20} color={theme.accent} />
                      <Text style={[styles.infoText, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                        The more details you provide, the faster we can resolve your issue.
                        Screenshots can be helpful too!
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryButton: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    gap: 8,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
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
    minHeight: 100,
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

