import React, { useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clerkAuthService } from '@/services/clerkAuth';
import Constants from 'expo-constants';

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
  const { darkMode } = useTheme();
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
                  Report an Issue
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
                {/* Issue Category Selection */}
                <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Issue Category <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.subtext }]}>
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
                              borderColor: isSelected ? theme.accent : theme.softBorder,
                              backgroundColor: isSelected
                                ? 'rgba(67, 206, 162, 0.18)'
                                : 'rgba(255, 255, 255, 0.03)',
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
                <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Issue Details
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.subtext }]}>
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
                          backgroundColor: theme.inputBg,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder='Brief summary of the issue'
                      placeholderTextColor='rgba(255, 255, 255, 0.6)'
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
                          backgroundColor: theme.inputBg,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder='Describe the issue in detail...'
                      placeholderTextColor='rgba(255, 255, 255, 0.6)'
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
                <View style={styles.infoCard}>
                  <MaterialIcons name='info-outline' size={20} color={theme.accent} />
                  <Text style={[styles.infoText, { color: theme.subtext }]}>
                    The more details you provide, the faster we can resolve your issue.
                    Screenshots can be helpful too!
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
    fontSize: 14,
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

