import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';
import { clerkAuthService } from '@/services/clerkAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FORM_KEYBOARD_SCROLL_PROPS } from '@/constants/keyboardScrollProps';
import { nativeNumericKeyboardProps, resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import { sanitizeStoredProfileAvatar } from '@/lib/profileAvatar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Try to import Clerk hooks
let clerkUserFactory: any = null;
try {
  const clerkModule = require('@clerk/clerk-react');
  clerkUserFactory = clerkModule.useUser;
} catch (e) {
  // Clerk not available
}

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const clerkUserState = clerkUserFactory ? clerkUserFactory() : null;
  const clerkUser = clerkUserState?.user ?? null;
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    phone: '',
    location: '',
  });
  type ContractorProfile = {
    name: string;
    company: string;
    phone: string;
    location: string;
    email: string;
    avatar: string;
    insurance: { generalLiability: boolean; autoInsurance: boolean };
    licenses: string[];
    companyBio: string;
    projectPortfolio: any[];
  };

  // Load existing profile data on mount
  useEffect(() => {
    const loadExistingProfile = async () => {
      try {
        setLoadingProfile(true);
        
        // Load from Clerk user
        let firstName = '';
        let lastName = '';
        if (clerkUser) {
          firstName = clerkUser.firstName || '';
          lastName = clerkUser.lastName || '';
        }

        // Load from contractor profile in AsyncStorage
        const contractorProfileData = await AsyncStorage.getItem('bps.contractorProfile');
        let company = '';
        let phone = '';
        let location = '';
        let existingName = '';

        if (contractorProfileData) {
          const profile = JSON.parse(contractorProfileData);
          existingName = profile.name || '';
          company = profile.company || '';
          phone = profile.phone || '';
          location = profile.location || '';
          
          // If we have a full name but no firstName/lastName, try to split it
          if (existingName && !firstName && !lastName) {
            const nameParts = existingName.trim().split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
          }
        }

        // Pre-fill form with existing data
        setFormData({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          company: company.trim(),
          phone: phone.trim(),
          location: location.trim(),
        });
      } catch (error) {
        console.error('Error loading existing profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadExistingProfile();
  }, [clerkUser]);

  const gradientColors = ['#021633', '#0DAF92'] as const;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim()) {
      Alert.alert('Required Field', 'Please enter your first name.');
      return false;
    }
    if (!formData.lastName.trim()) {
      Alert.alert('Required Field', 'Please enter your last name.');
      return false;
    }
    if (!formData.company.trim()) {
      Alert.alert('Required Field', 'Please enter your company name.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Update profile via Clerk auth service
      const updates: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      };

      // Update Clerk profile (firstName/lastName)
      const result = await clerkAuthService.updateProfile({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      });

      // Save full contractor profile to AsyncStorage
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
      const contractorProfile: ContractorProfile = {
        name: fullName,
        company: formData.company.trim(),
        phone: formData.phone.trim() || '',
        location: formData.location.trim() || '',
        email: clerkUser?.emailAddresses?.[0]?.emailAddress || clerkUser?.primaryEmailAddress?.emailAddress || '',
        avatar: '',
        insurance: { generalLiability: false, autoInsurance: false },
        licenses: [],
        companyBio: '',
        projectPortfolio: [],
      };

      // Load existing profile to preserve other fields (same account only — never reuse another user's photo)
      const clerkEmail = (
        clerkUser?.primaryEmailAddress?.emailAddress ||
        clerkUser?.emailAddresses?.[0]?.emailAddress ||
        ''
      )
        .trim()
        .toLowerCase();
      try {
        const existingProfileData = await AsyncStorage.getItem('bps.contractorProfile');
        if (existingProfileData) {
          const existingProfile = JSON.parse(existingProfileData);
          const existingEmail = String(existingProfile.email || '')
            .trim()
            .toLowerCase();
          const sameAccount =
            Boolean(clerkEmail) &&
            Boolean(existingEmail) &&
            existingEmail === clerkEmail;
          contractorProfile.avatar = sameAccount
            ? sanitizeStoredProfileAvatar(existingProfile.avatar)
            : '';
          contractorProfile.insurance = existingProfile.insurance || { generalLiability: false, autoInsurance: false };
          contractorProfile.licenses = existingProfile.licenses || [];
          contractorProfile.companyBio = existingProfile.companyBio || '';
          contractorProfile.projectPortfolio = existingProfile.projectPortfolio || [];
        } else {
          // Initialize with defaults
          contractorProfile.avatar = '';
          contractorProfile.insurance = { generalLiability: false, autoInsurance: false };
          contractorProfile.licenses = [];
          contractorProfile.companyBio = '';
          contractorProfile.projectPortfolio = [];
        }
      } catch (e) {
        console.error('Error loading existing profile:', e);
        // Use defaults
        contractorProfile.avatar = '';
        contractorProfile.insurance = { generalLiability: false, autoInsurance: false };
        contractorProfile.licenses = [];
        contractorProfile.companyBio = '';
        contractorProfile.projectPortfolio = [];
      }

      // Save contractor profile
      await AsyncStorage.setItem('bps.contractorProfile', JSON.stringify(contractorProfile));
      console.log('💾 Saved contractor profile to AsyncStorage');

      // Success - profile saved to both Clerk and AsyncStorage
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success message
      Alert.alert(
        'Profile Setup Complete!',
        'Your profile has been saved successfully. Welcome to Build Profit Solutions!',
        [
          {
            text: 'Continue',
            onPress: () => {
              // Force app to reload so AuthGate re-checks and navigates appropriately
              // The AuthGate will see the updated profile and allow access to main app
              router.replace('/');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Profile setup error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to save profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.keyboardView}>
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                { flexGrow: 1, paddingBottom: 24 + insets.bottom },
              ]}
              showsVerticalScrollIndicator={false}
              {...FORM_KEYBOARD_SCROLL_PROPS}
            >
              {/* Header */}
              <View style={styles.headerContainer}>
                <View style={styles.headerIconCircle}>
                  <MaterialIcons name='person-add' size={28} color='#FFFFFF' />
                </View>
                <Text style={styles.headerTitle}>Complete Your Profile</Text>
                <Text style={styles.headerSubtitle}>
                  Tell us about yourself to get started
                </Text>
              </View>

              {/* Loading State */}
              {loadingProfile ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size='large' color='#066B54' />
                  <Text style={styles.loadingText}>Loading your profile...</Text>
                </View>
              ) : (
              /* Form Card */
              <View style={styles.formCard}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    First Name <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons
                      name='person'
                      size={20}
                      color='#6B7380'
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder='Enter your first name'
                      placeholderTextColor='#A0A9B6'
                      value={formData.firstName}
                      onChangeText={value => handleInputChange('firstName', value)}
                      autoCapitalize='words'
                      autoCorrect={false}
                      {...resolveTextInputKeyboardProps()}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Last Name <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons
                      name='person-outline'
                      size={20}
                      color='#6B7380'
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder='Enter your last name'
                      placeholderTextColor='#A0A9B6'
                      value={formData.lastName}
                      onChangeText={value => handleInputChange('lastName', value)}
                      autoCapitalize='words'
                      autoCorrect={false}
                      {...resolveTextInputKeyboardProps()}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Company Name <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons
                      name='business'
                      size={20}
                      color='#6B7380'
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder='Enter your company name'
                      placeholderTextColor='#A0A9B6'
                      value={formData.company}
                      onChangeText={value => handleInputChange('company', value)}
                      autoCapitalize='words'
                      autoCorrect={false}
                      {...resolveTextInputKeyboardProps()}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons
                      name='phone'
                      size={20}
                      color='#6B7380'
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder='Enter your phone number (optional)'
                      placeholderTextColor='#A0A9B6'
                      value={formData.phone}
                      onChangeText={value => handleInputChange('phone', value)}
                      keyboardType='phone-pad'
                      autoCorrect={false}
                      {...nativeNumericKeyboardProps}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Location</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons
                      name='location-on'
                      size={20}
                      color='#6B7380'
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder='City, State (optional)'
                      placeholderTextColor='#A0A9B6'
                      value={formData.location}
                      onChangeText={value => handleInputChange('location', value)}
                      autoCapitalize='words'
                      autoCorrect={false}
                      {...resolveTextInputKeyboardProps()}
                    />
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size='small' color='#FFFFFF' />
                  ) : (
                    <>
                      <Text style={styles.submitButtonText}>Complete Setup</Text>
                      <MaterialIcons name='arrow-forward' size={20} color='#FFFFFF' />
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.helperText}>
                  * Required fields. You can update this information later in your profile settings.
                </Text>
              </View>
              )}
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  headerIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#03233C',
    marginBottom: 8,
  },
  required: {
    color: '#E91E63',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#06253E',
    paddingVertical: 0,
  },
  submitButton: {
    backgroundColor: '#066B54',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
    shadowColor: '#066B54',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7380',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  loadingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7380',
  },
});
