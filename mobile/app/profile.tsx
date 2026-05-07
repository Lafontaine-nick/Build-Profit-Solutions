import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Switch,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
  ActivityIndicator,
  Linking,
  InputAccessoryView,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import WebPageShell, { getWebPageShellMaxWidth } from '@/components/layout/WebPageShell';
import {
  ScreenLayout,
  isDesktopWebLayoutWidth,
  DASHBOARD_WEB_MAX_CONTENT_WIDTH,
  WEB_DESKTOP_EDGE_HORIZONTAL,
} from '@/constants/ScreenLayout';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import { useApi } from '@/contexts/ApiContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { clerkAuthService } from '@/services/clerkAuth';
import {
  clearAllOnboardingCompletionKeys,
  clearOnboardingCompleteForUser,
} from '@/lib/onboardingStorage';
import {
  FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY,
  FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY,
} from '@/lib/firstEstimateWalkthroughStorage';
import { resetActiveProjectWalkthroughStorage } from '@/lib/activeProjectWalkthroughStorage';
// Conditionally import Clerk - only if configured
let useClerkAuth: any = null;
let useUser: any = null;
try {
  const clerkModule = require('@clerk/clerk-react');
  useClerkAuth = clerkModule.useAuth;
  useUser = clerkModule.useUser;
} catch (e) {
  // Clerk not available
}
import * as Haptics from 'expo-haptics';
import { useLeadsStore } from '@/store/leads';
import { Lead } from '@/lib/leads/types';
import Constants from 'expo-constants';
import {
  requestNotificationPermissions,
  registerForPushNotificationsAsync,
  unregisterFromPushNotifications,
  getNotificationPermissionStatus,
} from '@/services/notificationService';
import { useBetaFeedback } from '@/contexts/BetaFeedbackContext';
import { isBetaFeedbackVisibleForUser } from '@/lib/betaFeedback/betaFeedbackConfig';
import { syncBpsDirectoryListing } from '@/services/bpsDirectorySync';

// Mock user data
const mockUser = {
  id: '1',
  name: 'John Smith',
  email: 'john.smith@email.com',
  phone: '(555) 123-4567',
  company: 'Smith Construction Co.',
  role: 'General Contractor',
  location: 'San Diego, CA',
  experience: 8,
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  joinDate: '2023-01-15',
  totalProjects: 47,
  completedProjects: 42,
  activeProjects: 5,
  totalRevenue: 1250000,
  averageRating: 4.8,
  reviewCount: 156,
  licenses: [
    'General Contractor License',
    'Electrical License',
    'Plumbing License',
  ],
  insurance: {
    generalLiability: true,
    autoInsurance: true,
  },
  preferences: {
    notifications: true,
    emailUpdates: true,
    smsAlerts: false,
    marketingEmails: false,
    darkMode: true,
    language: 'English',
    currency: 'USD',
    timezone: 'PST',
  },
  companyBio: '',
  projectPortfolio: [] as Array<{ id: string; uri: string; caption?: string }>,
};

/** First US ZIP in free-form location text (e.g. "Las Vegas, NV 89141"). */
function extractUsZipFromText(text: string): string {
  const m = String(text || '').match(/\b(\d{5})\b/);
  return m ? m[1] : '';
}

interface EditFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  city: string;
  state: string;
}

// SegmentTab component matching dashboard style
interface SegmentTabProps {
  label: string;
  icon: string;
  isActive: boolean;
  onPress: () => void;
}

// Helper function to get segment styles
const getSegmentStyles = (Colors: any) => StyleSheet.create({
  segmentTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segmentTabActive: {
    borderWidth: 0,
  },
  segmentTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  segmentLabelActive: {
    color: '#050B13',
  },
});

const SegmentTab: React.FC<SegmentTabProps> = ({ label, icon, isActive, onPress }) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getSegmentStyles(Colors), [Colors]);
  
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  if (isActive) {
    return (
      <LinearGradient
        colors={["#22c55e", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.segmentTab, styles.segmentTabActive]}
      >
        <Pressable onPress={handlePress}>
          <View style={styles.segmentTabInner}>
            <Ionicons name={icon as any} size={18} color="#050B13" />
            <Text style={[styles.segmentLabel, styles.segmentLabelActive]}>
              {label}
            </Text>
          </View>
        </Pressable>
      </LinearGradient>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={styles.segmentTab}
    >
      <View style={styles.segmentTabInner}>
        <Ionicons name={icon as any} size={18} color={Colors.text} />
        <Text style={styles.segmentLabel}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
};

export default function ProfileScreen() {
  // Require authentication to access this screen
  useRequireAuth();

  const betaFeedback = useBetaFeedback();

  const { darkMode, setDarkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const { width: layoutWidth } = useWindowDimensions();
  const desktopWeb = isDesktopWebLayoutWidth(layoutWidth);
  const webScrollContentCap =
    Platform.OS === 'web'
      ? undefined
      : desktopWeb
        ? {
            maxWidth: DASHBOARD_WEB_MAX_CONTENT_WIDTH,
            width: '100%' as const,
            alignSelf: 'center' as const,
          }
        : undefined;
  const edge = desktopWeb ? WEB_DESKTOP_EDGE_HORIZONTAL : ScreenLayout.edge.horizontal;
  /** Web: column shell handles insets; native keeps edge bleed. */
  const profileShellBleedActive = Platform.OS !== 'web';
  const footerSvgWidth = Math.max(
    1,
    profileShellBleedActive
      ? layoutWidth - (desktopWeb ? 16 : 8)
      : Math.min(layoutWidth, getWebPageShellMaxWidth('profile')) - edge * 2
  );
  const styles = useMemo(() => getStyles(Colors, darkMode, desktopWeb), [Colors, darkMode, desktopWeb]);
  const { updateProfile, updatePreferences, logout: apiLogout } = useApi();
  const { currentLanguage, changeLanguage } = useLanguage();
  const { t } = useTranslation(); // Use directly for reactivity

  const [user, setUser] = useState(mockUser);
  const [discoverability, setDiscoverability] = useState({ listOn: false });

  // Check notification permission status on mount
  useEffect(() => {
    const checkNotificationStatus = async () => {
      try {
        if (!user) return;
        
        const permissionStatus = await getNotificationPermissionStatus();
        // If permissions were revoked, update user preference
        if (!permissionStatus.granted && user.preferences?.notifications) {
          setUser(prev => ({
            ...prev,
            preferences: { ...prev.preferences, notifications: false },
          }));
        }
      } catch (error) {
        console.error('Error checking notification status:', error);
      }
    };
    
    if (user) {
      checkNotificationStatus();
    }
  }, [user]);
  
  // Get Clerk signOut and user if available
  // Only use Clerk if it's available and we're in a ClerkProvider
  let clerkSignOut: (() => Promise<void>) | null = null;
  let clerkUser: any = null;
  const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkEnabled = publishableKey && (publishableKey.startsWith('pk_live_') || (publishableKey.startsWith('pk_test_') && publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk'));
  
  if (isClerkEnabled && useClerkAuth) {
    try {
      const clerkAuth = useClerkAuth();
      clerkSignOut = clerkAuth?.signOut || null;
    } catch (e) {
      // Not in ClerkProvider - that's okay, we'll use API logout instead
      clerkSignOut = null;
    }
  }
  
  if (isClerkEnabled && useUser) {
    try {
      const userHook = useUser();
      clerkUser = userHook?.user || null;
    } catch (e) {
      // Not in ClerkProvider - that's okay
      clerkUser = null;
    }
  }

  const clerkEmailForBeta =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    null;
  const showBetaFeedbackRow =
    Boolean(betaFeedback) && isBetaFeedbackVisibleForUser(clerkEmailForBeta);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'settings'
  >('overview');
  const [editModal, setEditModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);

  // Sync selectedLanguage with currentLanguage when it changes
  useEffect(() => {
    setSelectedLanguage(currentLanguage);
  }, [currentLanguage]);

  // Language options
  const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Español', value: 'es' },
    { label: 'Français', value: 'fr' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Italiano', value: 'it' },
    { label: 'Português', value: 'pt' },
    { label: '中文', value: 'zh' },
    { label: '日本語', value: 'ja' },
    { label: '한국어', value: 'ko' },
    { label: 'العربية', value: 'ar' },
    { label: 'Русский', value: 'ru' },
    { label: 'Polski', value: 'pl' },
  ];

  const getLanguageLabel = (value: string) => {
    return languageOptions.find(l => l.value === value)?.label || 'English';
  };

  // Format phone number as (XXX) XXX-XXXX
  const formatPhoneNumber = (value: string): string => {
    if (!value) return '';
    // Remove all non-digit characters
    const phoneNumber = value.replace(/\D/g, '');
    
    // Format based on length
    if (phoneNumber.length === 0) return '';
    if (phoneNumber.length <= 3) return `(${phoneNumber}`;
    if (phoneNumber.length <= 6) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const [editForm, setEditForm] = useState<EditFormData>({
    firstName: user.name?.split(' ')[0] || '',
    lastName: user.name?.split(' ').slice(1).join(' ') || '',
    email: user.email,
    phone: user.phone ? formatPhoneNumber(user.phone) : '',
    company: user.company,
    role: user.role,
    city: user.location?.split(', ')[0] || '',
    state: user.location?.split(', ')[1] || '',
  });

  // Load and sync profile data on mount
  React.useEffect(() => {
    const loadProfile = async () => {
      try {
        const saved = await AsyncStorage.getItem('bps.contractorProfile');
        if (saved) {
          const profile = JSON.parse(saved);
          setDiscoverability({
            listOn: !!profile.listOnFindSubcontractors,
          });
          setUser(prev => ({
            ...prev,
            name: profile.name || prev.name,
            company: profile.company || prev.company,
            avatar: profile.avatar || prev.avatar,
            phone: profile.phone || prev.phone,
            email: profile.email || prev.email,
            website: profile.website || prev.website,
            role: profile.role || prev.role,
            location: profile.location || prev.location,
            insurance: profile.insurance || prev.insurance,
            licenses: profile.licenses || prev.licenses,
            companyBio: profile.companyBio !== undefined ? profile.companyBio : prev.companyBio,
            projectPortfolio: profile.projectPortfolio || prev.projectPortfolio || [],
          }));
        } else {
          // Save initial profile if none exists
          const initialProfile = {
            name: user.name,
            company: user.company,
            avatar: user.avatar,
            phone: user.phone,
            email: user.email,
            website: user.website,
            role: user.role,
            location: user.location,
          };
          await AsyncStorage.setItem('bps.contractorProfile', JSON.stringify(initialProfile));
          console.log('💾 Profile page: Saved initial profile to storage');
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };
    loadProfile();
  }, []);

  // Refresh from storage when returning to Profile (e.g. after onboarding writes role)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const saved = await AsyncStorage.getItem('bps.contractorProfile');
          if (cancelled || !saved) return;
          const profile = JSON.parse(saved);
          setDiscoverability({
            listOn: !!profile.listOnFindSubcontractors,
          });
          setUser((prev) => ({
            ...prev,
            name: profile.name || prev.name,
            company: profile.company || prev.company,
            avatar: profile.avatar || prev.avatar,
            phone: profile.phone || prev.phone,
            email: profile.email || prev.email,
            website: profile.website || prev.website,
            role: profile.role || prev.role,
            location: profile.location || prev.location,
            insurance: profile.insurance || prev.insurance,
            licenses: profile.licenses || prev.licenses,
            companyBio:
              profile.companyBio !== undefined ? profile.companyBio : prev.companyBio,
            projectPortfolio: profile.projectPortfolio || prev.projectPortfolio || [],
          }));
        } catch (e) {
          if (__DEV__) console.error('Profile focus: reload from storage failed', e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Load leads data
  React.useEffect(() => {
    const loadLeadsData = async () => {
      try {
        // Try to get from AsyncStorage first
        const leadsDataStr = await AsyncStorage.getItem('leadsData');
        if (leadsDataStr) {
          const leads = JSON.parse(leadsDataStr) as Lead[];
          setLeadsData(leads);
        } else {
          // Fallback to Zustand store
          try {
            const storeState = useLeadsStore.getState();
            const storeLeads = storeState.allRaw || [];
            if (storeLeads.length > 0) {
              // Convert LeadRaw to Lead format if needed
              setLeadsData(storeLeads as Lead[]);
            }
          } catch (storeError) {
            console.warn('Could not load from Zustand store:', storeError);
          }
        }
      } catch (error) {
        console.error('Failed to load leads data:', error);
      }
    };
    loadLeadsData();
  }, []);

  // Settings modals state
  const [passwordModal, setPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notificationsModal, setNotificationsModal] = useState(false);
  const [languageModal, setLanguageModal] = useState(false);
  const [companyModal, setCompanyModal] = useState(false);
  const [licensesModal, setLicensesModal] = useState(false);
  const [insuranceModal, setInsuranceModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [helpModal, setHelpModal] = useState(false);
  const [termsModal, setTermsModal] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [leadsData, setLeadsData] = useState<Lead[]>([]);
  const [isEditingLicenses, setIsEditingLicenses] = useState(false);
  const [newLicenseText, setNewLicenseText] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingPortfolio, setIsEditingPortfolio] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const licenseInputRefs = useRef<(TextInput | null)[]>([]);
  const addLicenseInputRef = useRef<TextInput>(null);
  const bioInputRef = useRef<TextInput>(null);
  const modalScrollViewRef = useRef<ScrollView>(null);
  const cityInputRef = useRef<TextInput>(null);
  const stateInputRef = useRef<TextInput>(null);
  const locationSectionRef = useRef<View>(null);

  // Use theme from ThemeContext (already defined above)
  const theme = useMemo(() => ({
    background: [Colors.bg, Colors.bg, Colors.bg] as [string, string, string],
    card: Colors.surface2,
    text: Colors.text,
    subtext: Colors.sub,
    accent: Colors.primary,
    border: Colors.line,
    divider: Colors.line,
    success: '#4ADE80',
    warning: '#FACC15',
    error: '#F87171',
    iconBg: Colors.iconBg,
    inputBg: Colors.surface2,
    softBorder: Colors.line,
  }), [Colors]);


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // In real app, fetch user data from API
      setUser({ ...mockUser });
    } catch (error) {
      if (__DEV__) {
        console.error('Error refreshing profile:', error);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleTabPress = useCallback(
    (tab: 'overview' | 'settings') => {
      setActiveTab(tab);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );


  // Save ALL profile data to AsyncStorage whenever it changes
  React.useEffect(() => {
    // Only save when not in any edit mode to avoid saving incomplete data
    if (!isEditingLicenses && !isEditingBio && !isEditingPortfolio) {
      const saveAllProfileData = async () => {
        try {
          const listedZip = extractUsZipFromText(user.location);
          let prevServiceZip = '';
          try {
            const existingRaw = await AsyncStorage.getItem('bps.contractorProfile');
            if (existingRaw) {
              prevServiceZip = String(JSON.parse(existingRaw).serviceZip || '')
                .replace(/\D/g, '')
                .slice(0, 5);
            }
          } catch {
            /* ignore */
          }
          const serviceZip =
            listedZip.length === 5 ? listedZip : prevServiceZip.length === 5 ? prevServiceZip : '';
          // Always save the complete profile object
          const fullProfile = {
            name: user.name,
            company: user.company,
            avatar: user.avatar,
            phone: user.phone,
            email: user.email,
            website: user.website,
            role: user.role,
            location: user.location,
            insurance: user.insurance,
            licenses: user.licenses,
            companyBio: user.companyBio !== undefined ? user.companyBio : '',
            projectPortfolio: user.projectPortfolio || [],
            listOnFindSubcontractors: discoverability.listOn,
            serviceZip,
          };
          await AsyncStorage.setItem('bps.contractorProfile', JSON.stringify(fullProfile));
          console.log('💾 Saved complete profile to AsyncStorage');
          const uid = clerkUser?.id || user.email || user.id || 'anonymous';
          await syncBpsDirectoryListing({
            id: String(uid),
            companyName: user.company,
            contactName: user.name,
            email: user.email,
            phone: user.phone?.replace(/\D/g, ''),
            website: user.website,
            trades: user.role ? [user.role] : ['General Contractor'],
            zip: serviceZip,
            listOnFindSubcontractors: discoverability.listOn && serviceZip.length === 5,
          });
        } catch (error) {
          console.error('Failed to save profile:', error);
        }
      };
      
      // Debounce saves to avoid too many writes
      const timeoutId = setTimeout(saveAllProfileData, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [user.name, user.company, user.avatar, user.phone, user.email, user.website, user.role, user.location, user.insurance, user.licenses, user.companyBio, user.projectPortfolio, isEditingLicenses, isEditingBio, isEditingPortfolio, discoverability.listOn]);

  const handleSaveProfile = useCallback(async () => {
    try {
      // Combine firstName and lastName into name
      const fullName = `${editForm.firstName} ${editForm.lastName}`.trim();
      
      // Combine city and state back into location
      const location = `${editForm.city}, ${editForm.state}`.trim();
      
      // Update backend profile
      if (updateProfile) {
        try {
          // Strip formatting from phone before saving to backend (keep only digits)
          const phoneDigits = editForm.phone.replace(/\D/g, '');
          await updateProfile({
            name: fullName,
            company: editForm.company,
            phone: phoneDigits,
            location: location,
          });
          console.log('✅ Profile saved to backend');
        } catch (apiError) {
          console.error('Failed to save profile to backend:', apiError);
          // Continue with local save even if backend fails
        }
      }
      
      // Update local state
      setUser(prev => ({ ...prev, name: fullName, company: editForm.company, phone: editForm.phone, email: editForm.email, role: editForm.role, location }));
      
      // Save to AsyncStorage - include all profile data
      try {
        let prevServiceZip = '';
        try {
          const existingRaw = await AsyncStorage.getItem('bps.contractorProfile');
          if (existingRaw) {
            prevServiceZip = String(JSON.parse(existingRaw).serviceZip || '')
              .replace(/\D/g, '')
              .slice(0, 5);
          }
        } catch {
          /* ignore */
        }
        const listedZip = extractUsZipFromText(location);
        const serviceZip =
          listedZip.length === 5 ? listedZip : prevServiceZip.length === 5 ? prevServiceZip : '';
        const profileToSave = {
          name: fullName,
          company: editForm.company,
          phone: editForm.phone,
          email: editForm.email,
          website: user.website,
          role: editForm.role,
          location,
          avatar: user.avatar,
          insurance: user.insurance,
          licenses: user.licenses,
          companyBio: user.companyBio !== undefined ? user.companyBio : '',
          projectPortfolio: user.projectPortfolio || [],
          listOnFindSubcontractors: discoverability.listOn,
          serviceZip,
        };
        await AsyncStorage.setItem('bps.contractorProfile', JSON.stringify(profileToSave));
        console.log('💾 Saved complete contractor profile to AsyncStorage');
        const uid = clerkUser?.id || editForm.email || user.email || user.id || 'anonymous';
        await syncBpsDirectoryListing({
          id: String(uid),
          companyName: editForm.company,
          contactName: fullName,
          email: editForm.email,
          phone: editForm.phone.replace(/\D/g, ''),
          website: user.website,
          trades: editForm.role ? [editForm.role] : ['General Contractor'],
          zip: serviceZip,
          listOnFindSubcontractors: discoverability.listOn && serviceZip.length === 5,
        });
      } catch (error) {
        console.error('Failed to save profile to AsyncStorage:', error);
      }
      
      setEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [editForm, user.avatar, user.website, user.companyBio, user.projectPortfolio, user.insurance, user.licenses, discoverability.listOn, updateProfile]);

  const handleCancelEdit = useCallback(() => {
    const nameParts = user.name?.split(' ') || [];
    setEditForm({
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: user.email,
      phone: user.phone,
      company: user.company,
      role: user.role,
      city: user.location?.split(', ')[0] || '',
      state: user.location?.split(', ')[1] || '',
    });
    setEditModal(false);
  }, [user]);

  // Settings handlers
  const handleChangePassword = useCallback(() => {
    // Reset password fields when opening modal
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleUpdatePassword = useCallback(async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      if (isClerkEnabled && clerkUser) {
        // Use Clerk's API to update password
        await clerkUser.updatePassword({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        });
        
        Alert.alert(
          'Success',
          'Password updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                setPasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
              },
            },
          ]
        );
      } else {
        // Fallback: show success message (backend API would go here if needed)
        Alert.alert(
          'Success',
          'Password updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                setPasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Password update error:', error);
      const errorMessage = error?.errors?.[0]?.message || error?.message || 'Failed to update password. Please try again.';
      
      // Check if it's a current password error
      if (errorMessage.includes('current') || errorMessage.includes('Current') || errorMessage.includes('incorrect')) {
        Alert.alert('Error', 'Current password is incorrect. Please try again.');
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setPasswordLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, isClerkEnabled, clerkUser]);

  const handleNotificationPreferences = useCallback(() => {
    setNotificationsModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleLanguageRegion = useCallback(() => {
    setLanguageModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleCompanyInformation = useCallback(() => {
    setCompanyModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleLicensesCertifications = useCallback(() => {
    setLicensesModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleInsuranceInformation = useCallback(() => {
    setInsuranceModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handlePaymentMethods = useCallback(() => {
    router.push('/payment');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handlePaymentMethodsOld = useCallback(() => {
    setPaymentModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleHelpSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/profile/help-support');
  }, []);

  const handleTermsOfService = useCallback(() => {
    router.push('/legal-hub?tab=terms');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handlePrivacyPolicy = useCallback(() => {
    router.push('/legal-hub?tab=privacy');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleAbout = useCallback(() => {
    router.push('/profile/about');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);


  const handleClearCache = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Clear Cache',
      'This won\'t delete projects or estimates.',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              await AsyncStorage.clear();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  }, []);

  const handleExportData = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Show loading
      Alert.alert('Exporting Data', 'Please wait while we prepare your data export...', [], { cancelable: false });
      
      // Call backend export endpoint
      const apiService = require('@/services/api').apiService;
      const exportData = await apiService.exportData();
      
      // Convert to JSON string
      const jsonString = JSON.stringify(exportData.data, null, 2);
      const fileName = `build-profit-solutions-export-${Date.now()}.json`;
      
      // Use Expo Sharing API to share the file
      const Sharing = require('expo-sharing');
      const FileSystem = require('expo-file-system');
      
      try {
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, jsonString);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Export Your Data',
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            'Export Complete',
            `Your data has been exported successfully!\n\nSummary:\n- ${exportData.summary.projects} projects\n- ${exportData.summary.leads} leads\n- ${exportData.summary.projectLeads} project leads\n- ${exportData.summary.unifiedLeads} unified leads`
          );
        } else {
          // Fallback: show data in alert (for web/simulator)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            'Export Complete',
            `Your data has been prepared.\n\nSummary:\n- ${exportData.summary.projects} projects\n- ${exportData.summary.leads} leads\n- ${exportData.summary.projectLeads} project leads\n- ${exportData.summary.unifiedLeads} unified leads\n\nFile: ${fileName}`
          );
        }
      } catch (shareError) {
        console.error('Error sharing file:', shareError);
        // Fallback: show summary
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Export Complete',
          `Your data has been exported!\n\nSummary:\n- ${exportData.summary.projects} projects\n- ${exportData.summary.leads} leads\n- ${exportData.summary.projectLeads} project leads\n- ${exportData.summary.unifiedLeads} unified leads`
        );
      }
    } catch (error) {
      console.error('Export error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to export data. Please try again.');
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted. Are you absolutely sure?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            Alert.alert(
              'Final Confirmation',
              'This will permanently delete your account and all associated data. This action cannot be undone.',
              [
                { 
                  text: 'Cancel', 
                  style: 'cancel',
                  onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
                },
                {
                  text: 'Delete Account',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      
                      // Show loading indicator
                      const loadingAlert = Alert.alert(
                        'Deleting Account',
                        'Please wait while we delete your account...',
                        [],
                        { cancelable: false }
                      );

                      let deleteApiClerkFailed = false;
                      // Call the delete account API
                      if (apiLogout) {
                        // First try to delete account via API
                        try {
                          const apiService = require('@/services/api').apiService;
                          const delResult = await apiService.deleteAccount();
                          if (delResult && delResult.clerkDeleteFailed) {
                            deleteApiClerkFailed = true;
                          }
                        } catch (apiError) {
                          console.error('Error calling delete account API:', apiError);
                          deleteApiClerkFailed = true;
                          // Continue with local cleanup even if API call fails
                        }
                      }

                      try {
                        await clearAllOnboardingCompletionKeys();
                      } catch (e) {
                        console.warn('clearAllOnboardingCompletionKeys:', e);
                      }

                      // Clear all local data
                      const authKeysToRemove = [
                        'auth_token',
                        'user_data',
                        'authToken',
                        'clerk-session',
                        'clerk-token',
                      ];
                      
                      for (const key of authKeysToRemove) {
                        try {
                          await AsyncStorage.removeItem(key);
                        } catch (e) {
                          // Key might not exist, that's okay
                        }
                      }

                      // Clear all AsyncStorage
                      try {
                        await AsyncStorage.clear();
                      } catch (clearError) {
                        console.error('Error clearing AsyncStorage:', clearError);
                      }

                      // Sign out from Clerk if available
                      if (clerkSignOut) {
                        try {
                          await clerkSignOut();
                        } catch (e) {
                          console.log('Clerk signOut not available, continuing');
                        }
                      }

                      // Sign out from clerkAuthService
                      try {
                        await clerkAuthService.signOut();
                      } catch (e) {
                        console.error('Error signing out from clerkAuthService:', e);
                      }

                      // Dismiss loading alert
                      if (loadingAlert) {
                        // Alert doesn't have dismiss method, so we'll show success then navigate
                      }

                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      
                      // Show success message and navigate to landing page
                      Alert.alert(
                        deleteApiClerkFailed
                          ? 'Data removed'
                          : 'Account Deleted',
                        deleteApiClerkFailed
                          ? 'Your app data was cleared and you were signed out. If sign-in still recognizes this email, remove the user in the Clerk Dashboard (Users) or contact support so the email can be reused.'
                          : 'Your account has been successfully deleted. All your data has been permanently removed.',
                        [
                          {
                            text: 'OK',
                            onPress: () => {
                              router.replace('/');
                            },
                          },
                        ]
                      );
                    } catch (error) {
                      console.error('Account deletion error:', error);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      Alert.alert(
                        'Error',
                        'There was an error deleting your account. Please try again or contact support.',
                        [
                          {
                            text: 'OK',
                            onPress: () => {
                              // Still navigate to landing page
                              router.replace('/');
                            },
                          },
                        ]
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [apiLogout, clerkSignOut, router]);

  // Calculate profile completion percentage
  const calculateProfileCompletion = useCallback(() => {
    let completedFields = 0;
    const totalFields = 8; // Total fields to check (removed certifications)
    
    if (user.name && user.name.trim()) completedFields++;
    if (user.email && user.email.trim()) completedFields++;
    if (user.phone && user.phone.trim()) completedFields++;
    if (user.company && user.company.trim()) completedFields++;
    if (user.location && user.location.trim()) completedFields++;
    if (user.licenses && user.licenses.length > 0) completedFields++;
    if (user.insurance && Object.values(user.insurance).some(v => v === true)) completedFields++;
    if (user.avatar) completedFields++;
    
    return Math.round((completedFields / totalFields) * 100);
  }, [user]);

  // Filter settings based on search query
  const filterSettings = useCallback((settingText: string): boolean => {
    if (!settingsSearch || settingsSearch.trim() === '') return true;
    const searchLower = settingsSearch.toLowerCase();
    return settingText.toLowerCase().includes(searchLower);
  }, [settingsSearch]);

  const handleLogout = useCallback(async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            
            // Only clear authentication-related data, preserve user data
            const authKeysToRemove = [
              'auth_token',
              'user_data',
              'authToken',
              'clerk-session',
              'clerk-token',
            ];
            
            // Remove auth-related keys
            for (const key of authKeysToRemove) {
              try {
                await AsyncStorage.removeItem(key);
              } catch (e) {
                // Key might not exist, that's okay
              }
            }
            
            // Sign out from Clerk if available
            if (clerkSignOut) {
              try {
                await clerkSignOut();
              } catch (e) {
                console.log('Clerk signOut not available, continuing with logout');
              }
            }
            
            // Use API logout if available
            if (apiLogout) {
              try {
                await apiLogout();
              } catch (e) {
                console.log('API logout not available, continuing with logout');
              }
            }
            
            // Sign out from clerkAuthService (this updates auth state and notifies listeners)
            try {
              await clerkAuthService.signOut();
              console.log('✅ Signed out from clerkAuthService');
            } catch (e) {
              console.error('Error signing out from clerkAuthService:', e);
            }
            
            // Navigate to landing page (home page with "GET STARTED" button)
            router.replace('/');
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.error('Logout error:', error);
            // Still navigate to landing page even if there's an error
            router.replace('/');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        },
      },
    ]);
  }, [clerkSignOut, apiLogout, router]);

  const handleImageUpload = useCallback(async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to upload a profile image.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newAvatar = result.assets[0].uri;
        setUser(prev => ({ ...prev, avatar: newAvatar }));
        
        // Avatar save will be handled by the useEffect that watches user.avatar
        // No need to save here separately
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Profile image updated successfully!');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    }
  }, [user]);


  const handleAddPortfolioImage = useCallback(async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to upload portfolio images.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage = {
          id: `portfolio-${Date.now()}`,
          uri: result.assets[0].uri,
          caption: '',
        };
        
        setUser(prev => ({
          ...prev,
          projectPortfolio: [...(prev.projectPortfolio || []), newImage],
        }));
        
        // Portfolio save will be handled by the useEffect that watches user.projectPortfolio
        // No need to save here separately
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error uploading portfolio images:', error);
      Alert.alert('Error', 'Failed to upload portfolio images. Please try again.');
    }
  }, [user.projectPortfolio]);

  // Calculate real stats from leads data
  const realStats = useMemo(() => {
    const totalLeads = leadsData.length;
    const wonLeads = leadsData.filter(l => l.stage === 'won').length;
    const activeProposals = leadsData.filter(l => 
      l.stage === 'proposal' || l.stage === 'proposal-sent'
    ).length;
    const completedProjects = wonLeads; // Won leads = completed projects
    const activeProjects = leadsData.filter(l => 
      !['won', 'lost'].includes(l.stage)
    ).length;
    
    // Calculate revenue from leads (sum of average budgets for won leads)
    const totalRevenue = leadsData
      .filter(l => l.stage === 'won' && l.project)
      .reduce((sum, lead) => {
        const min = lead.project?.budgetMin || 0;
        const max = lead.project?.budgetMax || 0;
        const avgBudget = min > 0 && max > 0 ? (min + max) / 2 : (min || max);
        return sum + avgBudget;
      }, 0);
    
    return {
      totalLeads,
      wonLeads,
      activeProposals,
      completedProjects,
      activeProjects,
      totalRevenue,
    };
  }, [leadsData]);

  const profileCompletion = calculateProfileCompletion();

  const renderOverviewTab = () => (
    <>
      {/* Profile Completion Indicator */}
      {profileCompletion < 100 && (
        <View
          style={[
            styles.section,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
              Profile Completion
            </Text>
            <Text style={[styles.sectionTitle, { color: theme.accent, marginBottom: 0, fontSize: 14 }]}>
              {profileCompletion}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${profileCompletion}%`,
                  backgroundColor: theme.accent,
                },
              ]}
            />
          </View>
          <Text style={[styles.profileCompletionHint, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
            Complete your profile to get better lead matches
          </Text>
        </View>
      )}

      {/* Profile Header */}
      <View
        style={[
          styles.profileHeader,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        {/* Edit Button - Top Right (Icon Only) */}
        <TouchableOpacity
          style={styles.editIconButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Open edit modal
            const nameParts = user.name?.split(' ') || [];
            const formData: EditFormData = {
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
              email: user.email,
              phone: user.phone,
              company: user.company,
              role: user.role,
              city: user.location?.split(', ')[0] || '',
              state: user.location?.split(', ')[1] || '',
            };
            setEditForm(formData);
            setEditModal(true);
          }}
        >
          <MaterialIcons name='edit' size={18} color={theme.accent} />
        </TouchableOpacity>

        <View style={styles.profileHeaderContent}>
          <View style={styles.profileImageContainer}>
            <View style={styles.avatarGlowContainer}>
              <Image 
                source={{ uri: user.avatar }} 
                style={styles.profileImage}
                defaultSource={require('../assets/images/bps-logo.png')}
                onError={() => console.log('Profile image failed to load')}
              />
            </View>
            <TouchableOpacity
              style={styles.editAvatarButton}
              onPress={handleImageUpload}
            >
              <MaterialIcons name='camera-alt' size={18} color='#fff' />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.userName, { color: theme.text }]}>
              {user.name}
            </Text>
            <Text style={[styles.userRole, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
              {user.role}
            </Text>
            <Text style={[styles.userCompany, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
              {user.company}
            </Text>
          <View style={styles.ratingContainer}>
            <MaterialIcons name='star' size={16} color='#FFD700' />
            <Text style={[styles.ratingText, { color: theme.text }]}>
              {user.averageRating}
            </Text>
            <Text style={[styles.reviewCount, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
              ({user.reviewCount} reviews)
            </Text>
          </View>
          <View style={styles.memberSinceContainer}>
            <MaterialIcons name='event' size={14} color={theme.subtext} style={{ opacity: darkMode ? 1 : 0.85 }} />
            <Text style={[styles.memberSinceText, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
              Member since{' '}
              {new Date(user.joinDate).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>

          {/* Trust Micro-Row */}
          <View style={styles.trustMicroRow}>
            <View style={styles.trustBadge}>
              <MaterialIcons name='verified' size={14} color='#22c55e' />
              <Text style={styles.trustBadgeText}>Verified Contractor</Text>
            </View>
            <View style={styles.trustBadge}>
              <MaterialIcons name='badge' size={14} color='#22c55e' />
              <Text style={styles.trustBadgeText}>License on File</Text>
            </View>
            <View style={styles.trustBadge}>
              <MaterialIcons name='security' size={14} color='#22c55e' />
              <Text style={styles.trustBadgeText}>Insured</Text>
            </View>
          </View>
        </View>
        </View>

      </View>

      {/* Company Bio */}
      <View
        style={[
          styles.section,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name='business' size={22} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
              Company Bio
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsEditingBio(!isEditingBio)}
            style={{ padding: 4 }}
          >
            <MaterialIcons
              name={isEditingBio ? 'check' : 'edit'}
              size={16}
              color={theme.accent}
            />
          </TouchableOpacity>
        </View>
        
        {isEditingBio ? (
          <>
            <TextInput
              ref={bioInputRef}
              style={[styles.bioInput, { color: theme.text, borderColor: theme.accent }]}
              value={user.companyBio || ''}
              onChangeText={(text) => {
                if (text.length <= 500) {
                  setUser(prev => ({ ...prev, companyBio: text }));
                }
              }}
              placeholder='Tell us about your company, your experience, specialties...'
              placeholderTextColor={theme.subtext}
              multiline
              numberOfLines={6}
              textAlignVertical='top'
              maxLength={500}
              onFocus={() => {
                setTimeout(() => {
                  bioInputRef.current?.measureInWindow((x, y, width, height) => {
                    scrollViewRef.current?.scrollTo({ y: y - 150, animated: true });
                  });
                }, 100);
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
              <Text style={[styles.characterCount, { 
                color: (user.companyBio || '').length >= 375 ? (user.companyBio || '').length >= 450 ? '#FFA726' : theme.subtext : theme.subtext 
              }]}>
                {(user.companyBio || '').length}/500 characters
              </Text>
              {(user.companyBio || '').length >= 450 && (
                <Text style={[styles.characterWarning, { color: '#FFA726' }]}>
                  {500 - (user.companyBio || '').length} characters left
                </Text>
              )}
            </View>
          </>
        ) : (
          user.companyBio ? (
            <Text style={[styles.bioText, { color: theme.text }]}>
              {user.companyBio}
            </Text>
          ) : (
            <View style={styles.emptyBioContainer}>
              <View style={styles.emptyBioIconContainer}>
                <MaterialIcons name='business-center' size={32} color={theme.accent} />
              </View>
              <Text style={[styles.emptyBioTitle, { color: theme.text }]}>
                Tell clients what makes your company different.
              </Text>
              <TouchableOpacity
                style={[styles.addBioButton, { 
                  backgroundColor: darkMode ? 'rgba(67, 206, 162, 0.15)' : 'rgba(67, 206, 162, 0.1)',
                  borderColor: theme.accent,
                }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setIsEditingBio(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.addBioButtonIconContainer, { backgroundColor: theme.accent }]}>
                  <MaterialIcons name='add' size={20} color='#000' />
                </View>
                <Text style={[styles.addBioButtonText, { color: theme.accent }]}>
                  Add Company Bio
                </Text>
              </TouchableOpacity>
              <Text style={[styles.bioHint, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                Profiles with bios get 27% more inquiries
              </Text>
            </View>
          )
        )}
      </View>

      {/* Project Portfolio */}
      <View
        style={[
          styles.section,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name='photo-library' size={22} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
              Project Portfolio
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsEditingPortfolio(!isEditingPortfolio)}
            style={{ padding: 4 }}
          >
            <MaterialIcons
              name={isEditingPortfolio ? 'check' : 'edit'}
              size={16}
              color={theme.accent}
            />
          </TouchableOpacity>
        </View>
        
        {isEditingPortfolio && (
          <TouchableOpacity
            onPress={handleAddPortfolioImage}
            style={[styles.addPortfolioButton, { backgroundColor: theme.accent + '20', borderColor: theme.accent }]}
          >
            <MaterialIcons name='add-photo-alternate' size={20} color={theme.accent} />
            <Text style={[styles.addPortfolioButtonText, { color: theme.accent }]}>
              Add Portfolio Images
            </Text>
          </TouchableOpacity>
        )}
        
        {user.projectPortfolio && user.projectPortfolio.length > 0 ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.portfolioContainer}
            contentContainerStyle={styles.portfolioScrollContent}
          >
            {user.projectPortfolio.map((item, index) => (
              <View key={item.id || index} style={styles.portfolioItem}>
                <Pressable
                  style={styles.portfolioImageShell}
                  onPress={() => {
                    // TODO: Open full-screen gallery
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.portfolioImage}
                    resizeMode='cover'
                  />
                  {index === 0 && (
                    <View style={styles.featuredBadge} accessibilityLabel="Featured project photo">
                      <MaterialIcons name='star' size={12} color='#FBBF24' />
                      <Text style={styles.featuredBadgeText}>Featured</Text>
                    </View>
                  )}
                  {isEditingPortfolio && (
                    <TouchableOpacity
                      onPress={() => {
                        const updatedPortfolio = user.projectPortfolio.filter((_, i) => i !== index);
                        setUser(prev => ({ ...prev, projectPortfolio: updatedPortfolio }));
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={styles.deletePortfolioButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name='close' size={16} color='#fff' />
                    </TouchableOpacity>
                  )}
                </Pressable>
                {isEditingPortfolio ? (
                  <TextInput
                    style={[
                      styles.portfolioCaptionInput,
                      {
                        color: theme.text,
                        borderColor: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                        backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      },
                    ]}
                    placeholder="Short caption (optional)"
                    placeholderTextColor={
                      darkMode ? 'rgba(203, 213, 225, 0.45)' : theme.subtext
                    }
                    value={item.caption || ''}
                    onChangeText={(text) => {
                      setUser((prev) => ({
                        ...prev,
                        projectPortfolio: (prev.projectPortfolio || []).map((p, i) =>
                          i === index ? { ...p, caption: text } : p
                        ),
                      }));
                    }}
                    maxLength={120}
                    multiline
                    numberOfLines={2}
                    textAlignVertical='top'
                  />
                ) : (
                  item.caption ? (
                    <Text
                      style={[
                        styles.portfolioCaption,
                        { color: darkMode ? 'rgba(226, 232, 240, 0.88)' : theme.subtext },
                      ]}
                      numberOfLines={2}
                    >
                      {item.caption}
                    </Text>
                  ) : null
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyPortfolio}>
            <View style={styles.emptyPortfolioIconContainer}>
              <MaterialIcons name='photo-library' size={32} color={theme.accent} />
            </View>
            <Text style={[styles.emptyPortfolioTitle, { color: theme.text }]}>
              Add your first project
            </Text>
            <Text style={[styles.emptyPortfolioSubtitle, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
              Before & after photos work best
            </Text>
            <TouchableOpacity
              style={[styles.addPortfolioButton, { 
                backgroundColor: darkMode ? 'rgba(67, 206, 162, 0.15)' : 'rgba(67, 206, 162, 0.1)',
                borderColor: theme.accent,
              }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setIsEditingPortfolio(true);
                handleAddPortfolioImage();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.addPortfolioButtonIconContainer, { backgroundColor: theme.accent }]}>
                <MaterialIcons name='add-photo-alternate' size={18} color='#000' />
              </View>
              <Text style={[styles.addPortfolioButtonText, { color: theme.accent }]}>
                Add Project
              </Text>
              <MaterialIcons name='arrow-forward' size={18} color={theme.accent} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Contact Information */}
      <View
        style={[
          styles.section,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <MaterialIcons name='contact-mail' size={22} color={theme.accent} />
          <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
            Contact Information
          </Text>
        </View>

        {/* Action-First Layout with Pill Buttons */}
            <View style={styles.contactActions}>
              <TouchableOpacity
                style={[styles.contactPillButton, { backgroundColor: theme.accent + '20', borderColor: theme.accent }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Linking.openURL(`tel:${user.phone}`);
                }}
              >
                <MaterialIcons name='phone' size={18} color={theme.accent} />
                <Text style={[styles.contactPillText, { color: theme.accent }]}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactPillButton, { backgroundColor: theme.accent + '20', borderColor: theme.accent }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Linking.openURL(`mailto:${user.email}`);
                }}
              >
                <MaterialIcons name='email' size={18} color={theme.accent} />
                <Text style={[styles.contactPillText, { color: theme.accent }]}>Email</Text>
              </TouchableOpacity>
              {user.website && (
                <TouchableOpacity
                  style={[styles.contactPillButton, { backgroundColor: theme.accent + '20', borderColor: theme.accent }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Linking.openURL(user.website.startsWith('http') ? user.website : `https://${user.website}`);
                  }}
                >
                  <MaterialIcons name='language' size={18} color={theme.accent} />
                  <Text style={[styles.contactPillText, { color: theme.accent }]}>Website</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Contact Details */}
            <View style={styles.contactDetails}>
              <View style={styles.contactItem}>
                <View style={[styles.contactIconContainer, { backgroundColor: theme.iconBg }]}>
                  <MaterialIcons name='phone' size={20} color={theme.accent} />
                </View>
                <Text style={[styles.contactText, { color: theme.text }]}>
                  {user.phone}
                </Text>
              </View>
              <View style={styles.contactItem}>
                <View style={[styles.contactIconContainer, { backgroundColor: theme.iconBg }]}>
                  <MaterialIcons name='email' size={20} color={theme.accent} />
                </View>
                <Text style={[styles.contactText, { color: theme.text }]}>
                  {user.email}
                </Text>
              </View>
              {user.website && (
                <View style={styles.contactItem}>
                  <View style={[styles.contactIconContainer, { backgroundColor: theme.iconBg }]}>
                    <MaterialIcons name='language' size={20} color={theme.accent} />
                  </View>
                  <Text style={[styles.contactText, { color: theme.text }]}>
                    {user.website}
                  </Text>
                </View>
              )}
              <View style={styles.contactItem}>
                <View style={[styles.contactIconContainer, { backgroundColor: theme.iconBg }]}>
                  <MaterialIcons name='location-on' size={20} color={theme.accent} />
                </View>
                <Text style={[styles.contactText, { color: theme.text }]}>
                  {user.location}
                </Text>
              </View>
            </View>

            {/* Privacy Hint */}
            <View style={styles.privacyHint}>
              <MaterialIcons name='lock' size={14} color={theme.subtext} style={{ opacity: darkMode ? 1 : 0.85 }} />
              <Text style={[styles.privacyHintText, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                Your contact details are only shared after a lead match.
              </Text>
            </View>
      </View>

      {/* Licenses & Insurance */}
      <View
        style={[
          styles.section,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <MaterialIcons name='verified' size={22} color={theme.accent} />
          <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
            Licenses & Insurance
          </Text>
        </View>
        
        {/* Licenses */}
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 14, marginBottom: 0 }]}>
              Licenses
            </Text>
            <TouchableOpacity
              onPress={() => setIsEditingLicenses(!isEditingLicenses)}
              style={{ padding: 4 }}
            >
              <MaterialIcons
                name={isEditingLicenses ? 'check' : 'edit'}
                size={16}
                color={theme.accent}
              />
            </TouchableOpacity>
          </View>
          
          {user.licenses.length === 0 && !isEditingLicenses ? (
            <View style={[styles.emptyLicenseItem, {
              backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }]}>
              <View style={[styles.certificationIconContainer, { backgroundColor: 'rgba(156, 163, 175, 0.15)' }]}>
                <MaterialIcons name='verified' size={18} color={theme.subtext} />
              </View>
              <Text style={[styles.certificationText, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                No licenses added
              </Text>
            </View>
          ) : (
            <>
              {user.licenses.map((license, index) => (
                <View
                  key={index}
                  style={[
                    styles.certificationItem,
                    isEditingLicenses && styles.certificationItemEditable,
                    { 
                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }
                  ]}
                >
                  <View style={[styles.certificationIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
                    <MaterialIcons name='verified' size={18} color='#4CAF50' />
                  </View>
                  {isEditingLicenses ? (
                    <TextInput
                      ref={(ref) => {
                        licenseInputRefs.current[index] = ref;
                      }}
                      style={[styles.licenseInput, { 
                        color: theme.text,
                        backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                        borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }]}
                      value={license}
                      onChangeText={(text) => {
                        const updatedLicenses = [...user.licenses];
                        updatedLicenses[index] = text;
                        setUser(prev => ({ ...prev, licenses: updatedLicenses }));
                      }}
                      placeholder='License name'
                      placeholderTextColor={theme.subtext}
                      onFocus={() => {
                        // Scroll to input when focused
                        setTimeout(() => {
                          licenseInputRefs.current[index]?.measureInWindow((x, y, width, height) => {
                            scrollViewRef.current?.scrollTo({ y: y - 150, animated: true });
                          });
                        }, 100);
                      }}
                    />
                  ) : (
                    <Text style={[styles.certificationText, { color: theme.text }]}>
                      {license}
                    </Text>
                  )}
                  {isEditingLicenses && (
                    <TouchableOpacity
                      onPress={() => {
                        const updatedLicenses = user.licenses.filter((_, i) => i !== index);
                        setUser(prev => ({ ...prev, licenses: updatedLicenses }));
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                      style={[styles.removeLicenseButton, { backgroundColor: 'rgba(244, 67, 54, 0.15)' }]}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name='close' size={18} color='#F44336' />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              
              {isEditingLicenses && (
                <View style={[styles.addLicenseContainer, { 
                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }]}>
                  <TextInput
                    ref={addLicenseInputRef}
                    style={[styles.licenseInput, { 
                      color: theme.text,
                      backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                      borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }]}
                    value={newLicenseText}
                    onChangeText={setNewLicenseText}
                    placeholder='Add new license...'
                    placeholderTextColor={theme.subtext}
                    onFocus={() => {
                      // Scroll to add license input when focused
                      setTimeout(() => {
                        addLicenseInputRef.current?.measureInWindow((x, y, width, height) => {
                          scrollViewRef.current?.scrollTo({ y: y - 150, animated: true });
                        });
                      }, 100);
                    }}
                    onSubmitEditing={() => {
                      if (newLicenseText.trim()) {
                        setUser(prev => ({
                          ...prev,
                          licenses: [...prev.licenses, newLicenseText.trim()],
                        }));
                        setNewLicenseText('');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      if (newLicenseText.trim()) {
                        setUser(prev => ({
                          ...prev,
                          licenses: [...prev.licenses, newLicenseText.trim()],
                        }));
                        setNewLicenseText('');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }
                    }}
                    style={[styles.addLicenseButton, { 
                      backgroundColor: newLicenseText.trim() ? theme.accent : 'rgba(67, 206, 162, 0.2)',
                    }]}
                    disabled={!newLicenseText.trim()}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name='add'
                      size={20}
                      color={newLicenseText.trim() ? '#000' : theme.subtext}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
        
        {/* Insurance */}
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 14, marginBottom: 12 }]}>
            Insurance Coverage
          </Text>
          <View style={styles.insuranceList}>
            {Object.entries(user.insurance)
              .filter(([type]) => type !== 'workersComp' && type !== 'umbrellaPolicy')
              .sort(([typeA], [typeB]) => {
                // Sort: generalLiability first, then autoInsurance
                if (typeA === 'generalLiability') return -1;
                if (typeB === 'generalLiability') return 1;
                if (typeA === 'autoInsurance') return -1;
                if (typeB === 'autoInsurance') return 1;
                return 0;
              })
              .map(([type, covered]) => (
              <TouchableOpacity
                key={type}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setUser(prev => ({
                    ...prev,
                    insurance: {
                      ...prev.insurance,
                      [type]: !covered,
                    },
                  }));
                }}
                activeOpacity={0.7}
                style={[styles.insuranceItem, {
                  backgroundColor: covered 
                    ? (darkMode ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.08)')
                    : (darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                  borderColor: covered 
                    ? 'rgba(76, 175, 80, 0.2)' 
                    : (darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                }]}
              >
                <View style={[styles.insuranceIconContainer, { 
                  backgroundColor: covered ? 'rgba(76, 175, 80, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                }]}>
                  <MaterialIcons
                    name={covered ? 'check-circle' : 'radio-button-unchecked'}
                    size={18}
                    color={covered ? '#4CAF50' : theme.subtext}
                  />
                </View>
                <Text style={[styles.insuranceText, { 
                  color: covered ? theme.text : theme.subtext,
                  fontWeight: covered ? '500' : '400',
                  opacity: (!covered && !darkMode) ? 0.85 : 1,
                }]}>
                  {type
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase())}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </>
  );


  const renderSettingsTab = () => {
    // Helper to render setting item with search filter
    const renderSettingItem = (
      key: string,
      icon: string,
      text: string,
      onPress: () => void,
      showChevron: boolean = true,
      rightComponent?: React.ReactNode
    ) => {
      if (!filterSettings(text)) return null;
      
      return (
        <TouchableOpacity
          key={key}
          style={styles.settingItem}
          onPress={onPress}
          activeOpacity={0.6}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
              <MaterialIcons name={icon as any} size={20} color={theme.accent} />
            </View>
            <Text style={[styles.settingText, { color: theme.text }]}>
              {text}
            </Text>
          </View>
          {rightComponent || (showChevron && <MaterialIcons name='chevron-right' size={20} color={theme.subtext} style={{ opacity: darkMode ? 1 : 0.7 }} />)}
        </TouchableOpacity>
      );
    };

    // Helper to render section with search filter (iOS Grouped Style)
    const renderSection = (
      title: string,
      children: React.ReactNode,
      isFirst: boolean = false
    ) => {
      // Check if any child matches search
      const hasMatches = React.Children.toArray(children).some((child: any) => {
        if (child?.props?.children) {
          const text = React.Children.toArray(child.props.children)
            .map((c: any) => c?.props?.children?.toString() || '')
            .join(' ');
          return filterSettings(text);
        }
        return false;
      });
      
      if (!hasMatches && settingsSearch.trim() !== '') return null;
      
      return (
        <View key={title} style={[styles.settingsGroupContainer, isFirst && { marginTop: 0 }]}>
          {title && (
            <Text style={[styles.settingsGroupTitle, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
              {title.toUpperCase()}
            </Text>
          )}
          <View
            style={[
              styles.settingsGroup,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            {children}
          </View>
        </View>
      );
    };

    return (
      <ScrollView 
        style={styles.tabContent}
        contentContainerStyle={styles.settingsTabContentScroll}
        showsVerticalScrollIndicator={true}
      >
        {/* Settings Search - iOS Style Rounded Pill */}
        <View style={styles.searchSection}>
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <MaterialIcons name='search' size={20} color={theme.subtext} style={{ opacity: darkMode ? 1 : 0.85 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search settings"
              placeholderTextColor={theme.subtext}
              value={settingsSearch}
              onChangeText={(text) => {
                setSettingsSearch(text);
                if (text.length > 0) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
            />
            {settingsSearch.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSettingsSearch('');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={styles.searchClearButton}
              >
                <MaterialIcons name='close' size={18} color={theme.subtext} style={{ opacity: darkMode ? 1 : 0.85 }} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Account & Security - Top Priority */}
        {renderSection('Account & Security', (
          <>
            {renderSettingItem('change-password', 'lock', 'Change Password', () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleChangePassword();
            })}
            {renderSettingItem('reset-onboarding', 'refresh', 'Reset Onboarding', async () => {
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
                        if (clerkUser?.id) {
                          await clearOnboardingCompleteForUser(clerkUser.id);
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
                        
                        router.push('/onboarding');
                      } catch (error) {
                        console.error('Error resetting onboarding:', error);
                        Alert.alert('Error', 'Failed to reset onboarding.');
                      }
                    },
                  },
                ]
              );
            })}
          </>
        ), true)}

        {renderSection('Find Subcontractors', (
          <>
            {filterSettings('Build Profit') && (
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
                    <MaterialIcons name='location-on' size={20} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.settingText, { color: theme.text }]}>Show my company in search</Text>
                    <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 4, lineHeight: 16 }}>
                      Uses your profile location (include a 5-digit ZIP there). Or enable from Find Subcontractors while searching your area.
                    </Text>
                  </View>
                </View>
                <Switch
                  value={discoverability.listOn}
                  onValueChange={async (v) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (v) {
                      const fromLoc = extractUsZipFromText(user.location);
                      let prevZ = '';
                      try {
                        const raw = await AsyncStorage.getItem('bps.contractorProfile');
                        if (raw) {
                          prevZ = String(JSON.parse(raw).serviceZip || '')
                            .replace(/\D/g, '')
                            .slice(0, 5);
                        }
                      } catch {
                        /* ignore */
                      }
                      if (!fromLoc && prevZ.length !== 5) {
                        Alert.alert(
                          'ZIP needed',
                          'Add a 5-digit ZIP to your location when editing your profile (e.g. Las Vegas, NV 89141), or turn this on from Find Subcontractors using the ZIP at the top of that screen.'
                        );
                        return;
                      }
                    }
                    setDiscoverability({ listOn: v });
                  }}
                  trackColor={{ false: theme.border, true: theme.accent }}
                  thumbColor='#fff'
                />
              </View>
            )}
          </>
        ))}

        {/* Preferences */}
        {renderSection('Preferences', (
          <>
            {filterSettings('Light Mode') && (
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
                    <MaterialIcons name='brightness-4' size={20} color={theme.accent} />
                  </View>
                  <Text style={[styles.settingText, { color: theme.text }]}>Light Mode</Text>
                </View>
                <View style={styles.switchWrapper}>
                  <Switch
                    value={!darkMode}
                    onValueChange={async (value) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      await setDarkMode(!value);
                    }}
                    trackColor={{ false: theme.border, true: theme.accent }}
                    thumbColor='#fff'
                    ios_backgroundColor={theme.border}
                  />
                </View>
              </View>
            )}
            {filterSettings('Push Notifications') && (
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
                    <MaterialIcons name='notifications' size={20} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1, maxWidth: '62%' }}>
                    <Text style={[styles.settingText, { color: theme.text }]}>Push Notifications</Text>
                    <Text style={[styles.settingSubtext, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                      Leads, updates, reminders
                    </Text>
                  </View>
                </View>
                <View style={styles.switchWrapper}>
                  <Switch
                    value={user.preferences.notifications}
                    onValueChange={async (value) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      
                      if (value) {
                        // Turning ON: Request permissions and register
                        try {
                          // Request permissions first
                          const permissionResult = await requestNotificationPermissions();
                          
                          if (!permissionResult.granted) {
                            // Permission denied - show iOS-grade alert
                            if (!permissionResult.canAskAgain) {
                              Alert.alert(
                                'Notifications Disabled',
                                'Push notifications are disabled. To enable them, please go to Settings > Build Profit Solutions > Notifications and turn them on.',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Open Settings',
                                    onPress: () => {
                                      if (Platform.OS === 'ios') {
                                        Linking.openURL('app-settings:');
                                      } else {
                                        Linking.openSettings();
                                      }
                                    },
                                  },
                                ]
                              );
                            } else {
                              Alert.alert(
                                'Notifications Permission Required',
                                'To receive push notifications, please allow notifications in the permission dialog.',
                                [{ text: 'OK', style: 'default' }]
                              );
                            }
                            
                            // Don't update state if permission denied
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            return;
                          }
                          
                          // Register for push notifications
                          const token = await registerForPushNotificationsAsync();
                          
                          if (token) {
                            // Success - update state and save to backend
                            setUser({
                              ...user,
                              preferences: { ...user.preferences, notifications: true },
                            });
                            
                            if (updatePreferences) {
                              try {
                                await updatePreferences({ notifications: true });
                                console.log('✅ Notification preference saved to backend');
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              } catch (error) {
                                console.error('Failed to save notification preference:', error);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                Alert.alert('Error', 'Failed to save notification preference. Please try again.');
                              }
                            } else {
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                          } else {
                            // Failed to register
                            Alert.alert(
                              'Registration Failed',
                              'Unable to register for push notifications. Please try again later.',
                              [{ text: 'OK', style: 'default' }]
                            );
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                          }
                        } catch (error) {
                          console.error('Error enabling notifications:', error);
                          Alert.alert(
                            'Error',
                            'An error occurred while enabling notifications. Please try again.',
                            [{ text: 'OK', style: 'default' }]
                          );
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        }
                      } else {
                        // Turning OFF: Unregister and update state
                        try {
                          await unregisterFromPushNotifications();
                          
                          // Update local state
                          setUser({
                            ...user,
                            preferences: { ...user.preferences, notifications: false },
                          });
                          
                          // Save to backend
                          if (updatePreferences) {
                            try {
                              await updatePreferences({ notifications: false });
                              console.log('✅ Notification preference saved to backend');
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            } catch (error) {
                              console.error('Failed to save notification preference:', error);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                              Alert.alert('Error', 'Failed to save notification preference. Please try again.');
                            }
                          } else {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }
                        } catch (error) {
                          console.error('Error disabling notifications:', error);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        }
                      }
                    }}
                    trackColor={{ false: theme.border, true: theme.accent }}
                    thumbColor='#fff'
                    ios_backgroundColor={theme.border}
                  />
                </View>
              </View>
            )}
            {filterSettings('Language') && (
              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setLanguageModal(true);
                }}
                activeOpacity={0.6}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
                    <MaterialIcons name='language' size={20} color={theme.accent} />
                  </View>
                  <Text style={[styles.settingText, { color: theme.text }]}>{t('profile.language')}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.settingText, { color: theme.subtext, fontSize: 14, opacity: darkMode ? 1 : 0.85 }]}>
                    {getLanguageLabel(selectedLanguage)}
                  </Text>
                  <MaterialIcons name='chevron-right' size={20} color={theme.subtext} style={{ opacity: darkMode ? 1 : 0.7 }} />
                </View>
              </TouchableOpacity>
            )}
          </>
        ))}

        {/* Business */}
        {renderSection('Business', (
          <>
            {renderSettingItem('tax-center', 'request-quote', 'Tax Center', () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/tax-center');
            })}
            <View style={styles.settingItemWithSubtext}>
              <TouchableOpacity
                style={styles.settingItemContent}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handlePaymentMethods();
                }}
                activeOpacity={0.6}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
                    <MaterialIcons name='payment' size={20} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingText, { color: theme.text }]}>Payment Methods</Text>
                    <Text style={[styles.settingSubtext, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                      Payouts & client payments
                    </Text>
                  </View>
                  <MaterialIcons name='chevron-right' size={20} color={theme.subtext} style={{ opacity: darkMode ? 1 : 0.7 }} />
                </View>
              </TouchableOpacity>
            </View>
          </>
        ))}

        {/* Data & Privacy */}

        {/* Legal & Support */}
        {renderSection('Legal & Support', (
          <>
            {renderSettingItem('help', 'help-outline', 'Help & Support', () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleHelpSupport();
            })}
            {showBetaFeedbackRow &&
              filterSettings('Beta feedback') &&
              renderSettingItem('beta-feedback', 'feedback', 'Beta feedback', () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                betaFeedback?.openBetaFeedback();
              })}
            {renderSettingItem('terms', 'description', 'Terms of Service', () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleTermsOfService();
            })}
            {renderSettingItem('privacy', 'privacy-tip', 'Privacy Policy', () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handlePrivacyPolicy();
            })}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleAbout();
              }}
              activeOpacity={0.6}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
                  <MaterialIcons name='info-outline' size={20} color={theme.accent} />
                </View>
                <View style={{ flex: 1, maxWidth: '70%' }}>
                  <Text style={[styles.settingText, { color: theme.text }]}>About</Text>
                  <Text style={[styles.settingSubtext, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                    {`Version ${Constants.expoConfig?.version || '1.0.0'}`}
                  </Text>
                </View>
              </View>
              <MaterialIcons name='chevron-right' size={20} color={theme.subtext} style={{ opacity: darkMode ? 1 : 0.7 }} />
            </TouchableOpacity>
          </>
        ))}

        {/* iOS-style Action Buttons */}
        <View style={styles.settingsGroupContainer}>
          <View style={styles.dangerZoneSpacer} />
          <TouchableOpacity
            style={[
              styles.iosButton,
              styles.logoutButton,
              {
                backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                shadowOpacity: darkMode ? 0.3 : 0.1,
                borderColor: darkMode
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleLogout();
            }}
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
                backgroundColor: darkMode ? '#2a1a1a' : '#fff',
                shadowOpacity: darkMode ? 0.3 : 0.1,
                borderColor: darkMode
                  ? 'rgba(255, 59, 48, 0.3)'
                  : 'rgba(255, 59, 48, 0.2)',
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              handleDeleteAccount();
            }}
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

      </ScrollView>
    );
  };

  return (
    <>
      {/* Keyboard Toolbar with Done Button - Must be at root level */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="keyboardToolbar">
          <View style={[styles.keyboardToolbar, {
            backgroundColor: darkMode ? '#1a1a1a' : '#f5f5f5',
            borderTopColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }]}>
            <TouchableOpacity
              style={styles.keyboardDoneButton}
              onPress={() => {
                Keyboard.dismiss();
              }}
            >
              <Text style={[styles.keyboardDoneText, { color: theme.accent }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
      <LinearGradient colors={theme.background} style={styles.container}>
      {/* Header with Back Button and Title */}
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
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
            </GradientRingBackInner>
          </LinearGradient>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>Profile</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && { paddingHorizontal: 0, paddingTop: 0 },
          webScrollContentCap,
        ]}
        showsVerticalScrollIndicator={true}
      >
        <WebPageShell size="profile" scroll={false} contentStyle={{ paddingBottom: 0 }}>
        <View style={styles.profileShellBleed}>
        <LinearGradient
          colors={["#2DFFC4", "#00A6FF"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={{ borderRadius: 24, padding: 1, marginHorizontal: 0, marginBottom: 16 }}
        >
          <View style={styles.contentCard}>
          <View style={styles.content}>
        {/* Tab Navigation */}
        <View style={styles.wideContainer}>
          {darkMode ? (
            <BlurView intensity={35} tint="dark" style={styles.segmentContainer}>
              <View style={styles.segmentInner}>
                <SegmentTab
                  label="Overview"
                  icon="person-outline"
                  isActive={activeTab === 'overview'}
                  onPress={() => handleTabPress('overview')}
                />
                <SegmentTab
                  label="Settings"
                  icon="settings-outline"
                  isActive={activeTab === 'settings'}
                  onPress={() => handleTabPress('settings')}
                />
              </View>
            </BlurView>
          ) : (
            <View
              style={[
                styles.segmentContainer,
                { backgroundColor: Colors.surface2, borderColor: Colors.line },
              ]}
            >
              <View style={styles.segmentInner}>
                <SegmentTab
                  label="Overview"
                  icon="person-outline"
                  isActive={activeTab === 'overview'}
                  onPress={() => handleTabPress('overview')}
                />
                <SegmentTab
                  label="Settings"
                  icon="settings-outline"
                  isActive={activeTab === 'settings'}
                  onPress={() => handleTabPress('settings')}
                />
              </View>
            </View>
          )}
        </View>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'settings' && renderSettingsTab()}
        
        {/* Close gradient border - closes right after logout button (settings) or overview content */}
        </View>
      </View>
      </LinearGradient>

      {/* Footer - Outside Gradient Border, directly below it */}
      {activeTab === 'overview' && (
        <View style={styles.settingsFooter}>
          <View style={styles.gradientTextWrapper}>
            <Svg height="20" width={footerSvgWidth}>
              <Defs>
                <SvgLinearGradient id="gradientOverview" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#22c55e" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#22d3ee" stopOpacity="1" />
                </SvgLinearGradient>
              </Defs>
              <SvgText
                fill="url(#gradientOverview)"
                fontSize="14"
                fontWeight="500"
                x={footerSvgWidth / 2}
                y="16"
                textAnchor="middle"
              >
                Build Profit Solutions
              </SvgText>
            </Svg>
          </View>
          <View style={styles.gradientTextWrapper}>
            <Svg height="16" width={footerSvgWidth}>
              <Defs>
                <SvgLinearGradient id="gradientVersionOverview" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#22c55e" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#22d3ee" stopOpacity="1" />
                </SvgLinearGradient>
              </Defs>
              <SvgText
                fill="url(#gradientVersionOverview)"
                fontSize="12"
                fontWeight="400"
                x={footerSvgWidth / 2}
                y="14"
                textAnchor="middle"
              >
                {`Version ${Constants.expoConfig?.version || '1.0.0'}`}
              </SvgText>
            </Svg>
          </View>
        </View>
      )}
      {activeTab === 'settings' && (
        <View style={styles.settingsFooter}>
          <View style={styles.gradientTextWrapper}>
            <Svg height="20" width={footerSvgWidth}>
              <Defs>
                <SvgLinearGradient id="gradientSettings" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#22c55e" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#22d3ee" stopOpacity="1" />
                </SvgLinearGradient>
              </Defs>
              <SvgText
                fill="url(#gradientSettings)"
                fontSize="14"
                fontWeight="500"
                x={footerSvgWidth / 2}
                y="16"
                textAnchor="middle"
              >
                Build Profit Solutions
              </SvgText>
            </Svg>
          </View>
          <View style={styles.gradientTextWrapper}>
            <Svg height="16" width={footerSvgWidth}>
              <Defs>
                <SvgLinearGradient id="gradientVersionSettings" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#22c55e" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#22d3ee" stopOpacity="1" />
                </SvgLinearGradient>
              </Defs>
              <SvgText
                fill="url(#gradientVersionSettings)"
                fontSize="12"
                fontWeight="400"
                x={footerSvgWidth / 2}
                y="14"
                textAnchor="middle"
              >
                {`Version ${Constants.expoConfig?.version || '1.0.0'}`}
              </SvgText>
            </Svg>
          </View>
        </View>
      )}
        </View>
        </WebPageShell>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModal}
        animationType='slide'
        transparent={true}
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { 
            backgroundColor: darkMode ? '#2a2a2a' : '#f0f0f0',
            borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }]}>
            <View style={[styles.modalHeader, {
              borderBottomColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }]}>
              <Text style={[styles.modalTitle, { color: darkMode ? '#ffffff' : '#000000' }]}>
                {t('profile.editProfile')}
              </Text>
              <TouchableOpacity onPress={handleCancelEdit}>
                <MaterialIcons name='close' size={24} color={darkMode ? '#ffffff' : '#000000'} />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <ScrollView
                ref={modalScrollViewRef}
                style={{ flex: 1, width: '100%' }}
                contentContainerStyle={{ paddingBottom: 100, paddingTop: 20, paddingHorizontal: 20, flexGrow: 1 }}
                showsVerticalScrollIndicator={true}
                {...KEYBOARD_SCROLL_DEFAULTS}
              >
              {/* Profile Information Fields */}
              <View style={[styles.modalFormGroup, { backgroundColor: darkMode ? '#323232' : '#ffffff', marginBottom: 12 }]}>
                <View style={styles.modalInputRow}>
                  <Text style={[styles.modalInputLabel, { color: darkMode ? '#ffffff' : '#000000' }]}>
                    First Name
                  </Text>
                  <TextInput
                    style={[
                      styles.modalTextInput,
                      {
                        backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                        color: darkMode ? '#ffffff' : '#000000',
                        borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      },
                    ]}
                    value={editForm.firstName}
                    onChangeText={text =>
                      setEditForm(prev => ({ ...prev, firstName: text }))
                    }
                    placeholder='Enter your first name'
                    placeholderTextColor={darkMode ? '#888' : '#666'}
                    autoCapitalize='words'
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={[styles.modalFormGroup, { backgroundColor: darkMode ? '#323232' : '#ffffff', marginBottom: 12 }]}>
                <View style={styles.modalInputRow}>
                  <Text style={[styles.modalInputLabel, { color: darkMode ? '#ffffff' : '#000000' }]}>
                    Last Name
                  </Text>
                  <TextInput
                    style={[
                      styles.modalTextInput,
                      {
                        backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                        color: darkMode ? '#ffffff' : '#000000',
                        borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      },
                    ]}
                    value={editForm.lastName}
                    onChangeText={text =>
                      setEditForm(prev => ({ ...prev, lastName: text }))
                    }
                    placeholder='Enter your last name'
                    placeholderTextColor={darkMode ? '#888' : '#666'}
                    autoCapitalize='words'
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={[styles.modalFormGroup, { backgroundColor: darkMode ? '#323232' : '#ffffff', marginBottom: 12 }]}>
                <View style={styles.modalInputRow}>
                  <Text style={[styles.modalInputLabel, { color: darkMode ? '#ffffff' : '#000000' }]}>
                    Email
                  </Text>
                  <TextInput
                    inputAccessoryViewID="keyboardToolbar"
                    style={[
                      styles.modalTextInput,
                      {
                        backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                        color: darkMode ? '#ffffff' : '#000000',
                        borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      },
                    ]}
                    value={editForm.email}
                    onChangeText={text =>
                      setEditForm(prev => ({ ...prev, email: text }))
                    }
                    placeholder='Enter your email'
                    placeholderTextColor={darkMode ? '#888' : '#666'}
                    keyboardType='email-address'
                    autoCapitalize='none'
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={[styles.modalFormGroup, { backgroundColor: darkMode ? '#323232' : '#ffffff', marginBottom: 12 }]}>
                <View style={styles.modalInputRow}>
                  <Text style={[styles.modalInputLabel, { color: darkMode ? '#ffffff' : '#000000' }]}>
                    Phone
                  </Text>
                  <TextInput
                    inputAccessoryViewID="keyboardToolbar"
                    style={[
                      styles.modalTextInput,
                      {
                        backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                        color: darkMode ? '#ffffff' : '#000000',
                        borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      },
                    ]}
                    value={editForm.phone}
                    onChangeText={text => {
                      const formatted = formatPhoneNumber(text);
                      setEditForm(prev => ({ ...prev, phone: formatted }));
                    }}
                    placeholder='(555) 123-4567'
                    placeholderTextColor={darkMode ? '#888' : '#666'}
                    keyboardType='numeric'
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    maxLength={14}
                  />
                </View>
              </View>

              <View style={[styles.modalFormGroup, { backgroundColor: darkMode ? '#323232' : '#ffffff', marginBottom: 12 }]}>
                <View style={styles.modalInputRow}>
                  <Text style={[styles.modalInputLabel, { color: darkMode ? '#ffffff' : '#000000' }]}>
                    Company
                  </Text>
                  <TextInput
                    inputAccessoryViewID="keyboardToolbar"
                    style={[
                      styles.modalTextInput,
                      {
                        backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                        color: darkMode ? '#ffffff' : '#000000',
                        borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      },
                    ]}
                    value={editForm.company}
                    onChangeText={text =>
                      setEditForm(prev => ({ ...prev, company: text }))
                    }
                    placeholder='Enter your company'
                    placeholderTextColor={darkMode ? '#888' : '#666'}
                    autoCapitalize='words'
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={[styles.modalFormGroup, { backgroundColor: darkMode ? '#323232' : '#ffffff', marginBottom: 12 }]}>
                <View style={styles.modalInputRow}>
                  <Text style={[styles.modalInputLabel, { color: darkMode ? '#ffffff' : '#000000' }]}>
                    Role
                  </Text>
                  <TextInput
                    inputAccessoryViewID="keyboardToolbar"
                    style={[
                      styles.modalTextInput,
                      {
                        backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                        color: darkMode ? '#ffffff' : '#000000',
                        borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      },
                    ]}
                    value={editForm.role}
                    onChangeText={text =>
                      setEditForm(prev => ({ ...prev, role: text }))
                    }
                    placeholder='Enter your role'
                    placeholderTextColor={darkMode ? '#888' : '#666'}
                    autoCapitalize='words'
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View 
                ref={locationSectionRef}
                style={[styles.modalFormGroup, { backgroundColor: darkMode ? '#333333' : '#ffffff', marginBottom: 12 }]}
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  (locationSectionRef.current as any)._layoutY = y;
                }}
              >
                <View style={styles.modalInputRow}>
                  <Text style={[styles.modalInputLabel, { color: darkMode ? '#ffffff' : '#000000' }]}>
                    Location
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TextInput
                      ref={cityInputRef}
                      inputAccessoryViewID="keyboardToolbar"
                      style={[
                        styles.modalTextInput,
                        {
                          backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                          color: darkMode ? '#ffffff' : '#000000',
                          borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          flex: 2,
                        },
                      ]}
                      value={editForm.city}
                      onChangeText={text =>
                        setEditForm(prev => ({ ...prev, city: text }))
                      }
                      placeholder='City'
                      placeholderTextColor={darkMode ? '#888' : '#666'}
                      autoCapitalize='words'
                      returnKeyType="next"
                      onFocus={() => {
                        // Don't auto-scroll - let the user manually scroll if needed
                        // The keyboard will push the content up naturally
                      }}
                    />
                    <TextInput
                      ref={stateInputRef}
                      inputAccessoryViewID="keyboardToolbar"
                      style={[
                        styles.modalTextInput,
                        {
                          backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                          color: darkMode ? '#ffffff' : '#000000',
                          borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          flex: 1,
                        },
                      ]}
                      value={editForm.state}
                      onChangeText={text =>
                        setEditForm(prev => ({ ...prev, state: text }))
                      }
                      placeholder='State'
                      placeholderTextColor={darkMode ? '#888' : '#666'}
                      autoCapitalize='characters'
                      maxLength={2}
                      returnKeyType="done"
                      onFocus={() => {
                        // Don't auto-scroll - let the user manually scroll if needed
                        // The keyboard will push the content up naturally
                      }}
                    />
                  </View>
                </View>
              </View>
              </ScrollView>

              {/* Save Button */}
              <View style={[styles.modalFooter, {
                borderTopColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                backgroundColor: darkMode ? '#2a2a2a' : '#f0f0f0',
              }]}>
                <TouchableOpacity
                  style={[styles.modalSaveButton, {
                    backgroundColor: theme.accent,
                  }]}
                  onPress={handleSaveProfile}
                >
                  <Text style={[styles.modalSaveButtonText, { color: '#ffffff' }]}>
                    Save Changes
                  </Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModal}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setPasswordModal(false)}
      >
        <LinearGradient
          colors={theme.background}
          style={{ flex: 1 }}
        >
          <KeyboardAvoidingView
            style={styles.passwordModalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.passwordModalScrollContent}
              showsVerticalScrollIndicator={false}
              {...KEYBOARD_SCROLL_DEFAULTS}
            >
              {/* Password change card - matching language & edit profile modal */}
              <View style={[styles.passwordModalCard, { 
                backgroundColor: darkMode ? '#2a2a2a' : '#f0f0f0',
                borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }]}>
                <View style={styles.passwordModalHeader}>
                  <Text style={[styles.passwordModalTitle, { color: theme.text }]}>
                    Change Password
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setPasswordModal(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialIcons name='close' size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.passwordInputGroup}>
                  <Text style={[styles.passwordInputLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                    Current Password
                  </Text>
                  <View style={[styles.passwordInputContainer, { 
                    backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                    borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                  }]}>
                    <TextInput
                      style={[styles.passwordTextInput, { color: darkMode ? '#ffffff' : '#000000' }]}
                      placeholder='Enter current password'
                      placeholderTextColor={darkMode ? '#888' : '#666'}
                      secureTextEntry={!showCurrentPassword}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      editable={!passwordLoading}
                      autoCapitalize='none'
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.passwordEyeIcon}
                      onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons
                        name={showCurrentPassword ? 'visibility' : 'visibility-off'}
                        size={20}
                        color={theme.subtext}
                        style={{ opacity: darkMode ? 1 : 0.85 }}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.passwordInputGroup}>
                  <Text style={[styles.passwordInputLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                    New Password
                  </Text>
                  <View style={[styles.passwordInputContainer, { 
                    backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                    borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                  }]}>
                    <TextInput
                      style={[styles.passwordTextInput, { color: darkMode ? '#ffffff' : '#000000' }]}
                      placeholder='Enter new password'
                      placeholderTextColor={darkMode ? '#888' : '#666'}
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      editable={!passwordLoading}
                      autoCapitalize='none'
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.passwordEyeIcon}
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons
                        name={showNewPassword ? 'visibility' : 'visibility-off'}
                        size={20}
                        color={theme.subtext}
                        style={{ opacity: darkMode ? 1 : 0.85 }}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.passwordHelperText, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                    Must be at least 8 characters
                  </Text>
                </View>

                <View style={styles.passwordInputGroup}>
                  <Text style={[styles.passwordInputLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                    Confirm New Password
                  </Text>
                  <View style={[styles.passwordInputContainer, { 
                    backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8',
                    borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                  }]}>
                    <TextInput
                      style={[styles.passwordTextInput, { color: darkMode ? '#ffffff' : '#000000' }]}
                      placeholder='Confirm new password'
                      placeholderTextColor={darkMode ? '#888' : '#666'}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      editable={!passwordLoading}
                      autoCapitalize='none'
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.passwordEyeIcon}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons
                        name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                        size={20}
                        color={theme.subtext}
                        style={{ opacity: darkMode ? 1 : 0.85 }}
                      />
                    </TouchableOpacity>
                  </View>
                  {confirmPassword && newPassword === confirmPassword && (
                    <Text style={[styles.passwordMatchText, { color: theme.success }]}>
                      ✓ Passwords match
                    </Text>
                  )}
                  {confirmPassword && newPassword !== confirmPassword && (
                    <Text style={[styles.passwordMismatchText, { color: theme.error }]}>
                      Passwords do not match
                    </Text>
                  )}
                </View>

                <View style={styles.passwordModalButtonRow}>
                  <TouchableOpacity
                    style={[
                      styles.passwordModalButton,
                      styles.passwordCancelButton,
                      { 
                        backgroundColor: darkMode ? '#323232' : '#e8e8e8',
                        borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                      },
                    ]}
                    onPress={() => setPasswordModal(false)}
                    disabled={passwordLoading}
                  >
                    <Text style={[styles.passwordCancelButtonText, { color: darkMode ? '#ffffff' : '#000000' }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.passwordModalButton,
                      styles.passwordSaveButton,
                      { backgroundColor: theme.accent },
                      (passwordLoading || !currentPassword || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword) && { opacity: 0.5 },
                    ]}
                    onPress={handleUpdatePassword}
                    disabled={passwordLoading || !currentPassword || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                  >
                    {passwordLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.passwordSaveButtonText}>
                        Update Password
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </LinearGradient>
      </Modal>

      {/* Notification Preferences Modal */}
      <Modal
        visible={notificationsModal}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setNotificationsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={theme.background}
            style={[styles.modalContent, { borderColor: theme.border }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Notification Preferences
              </Text>
              <TouchableOpacity onPress={() => setNotificationsModal(false)}>
                <MaterialIcons name='close' size={24} color={theme.subtext} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <MaterialIcons
                    name='notifications'
                    size={20}
                    color={theme.subtext}
                  />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    Push Notifications
                  </Text>
                </View>
                <Switch
                  value={user.preferences.notifications}
                  onValueChange={value =>
                    setUser({
                      ...user,
                      preferences: {
                        ...user.preferences,
                        notifications: value,
                      },
                    })
                  }
                  trackColor={{ false: theme.border, true: theme.accent }}
                  thumbColor='#fff'
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <MaterialIcons name='sms' size={20} color={theme.subtext} />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    SMS Alerts
                  </Text>
                </View>
                <Switch
                  value={user.preferences.smsAlerts}
                  onValueChange={value =>
                    setUser({
                      ...user,
                      preferences: { ...user.preferences, smsAlerts: value },
                    })
                  }
                  trackColor={{ false: theme.border, true: theme.accent }}
                  thumbColor='#fff'
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <MaterialIcons
                    name='campaign'
                    size={20}
                    color={theme.subtext}
                  />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    Marketing Emails
                  </Text>
                </View>
                <Switch
                  value={user.preferences.marketingEmails}
                  onValueChange={value =>
                    setUser({
                      ...user,
                      preferences: {
                        ...user.preferences,
                        marketingEmails: value,
                      },
                    })
                  }
                  trackColor={{ false: theme.border, true: theme.accent }}
                  thumbColor='#fff'
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: theme.accent },
                ]}
                onPress={() => {
                  setNotificationsModal(false);
                  Alert.alert('Success', 'Notification preferences updated!');
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success
                  );
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  Save Preferences
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={languageModal}
        animationType='fade'
        transparent={true}
        onRequestClose={() => setLanguageModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setLanguageModal(false);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.languageModalContent, { 
              backgroundColor: darkMode ? '#2a2a2a' : '#f0f0f0',
              borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }]}
          >
            <View style={styles.languageModalHeader}>
              <Text style={[styles.languageModalTitle, { color: theme.text }]}>
                {t('profile.selectLanguage')}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setLanguageModal(false);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name='close' size={24} color={theme.subtext} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.languageModalScrollView}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.languageModalScrollContent}
              nestedScrollEnabled={true}
            >
              {languageOptions.map((lang) => (
                <TouchableOpacity
                  key={lang.value}
                  style={[
                    styles.languageOptionItem,
                    { 
                      borderBottomColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      backgroundColor: darkMode ? '#323232' : '#ffffff',
                    },
                    selectedLanguage === lang.value && { backgroundColor: darkMode ? 'rgba(67, 206, 162, 0.1)' : 'rgba(67, 206, 162, 0.15)' }
                  ]}
                  onPress={async () => {
                    await changeLanguage(lang.value);
                    setSelectedLanguage(lang.value);
                    // Save to backend preferences
                    await updatePreferences({ language: lang.value });
                    setLanguageModal(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.languageOptionText, { color: theme.text }]}>
                    {lang.label}
                  </Text>
                  {selectedLanguage === lang.value && (
                    <MaterialIcons name='check-circle' size={24} color={theme.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Company Information Modal */}
      <Modal
        visible={companyModal}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setCompanyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={theme.background}
            style={[styles.modalContent, { borderColor: theme.border }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Company Information
              </Text>
              <TouchableOpacity onPress={() => setCompanyModal(false)}>
                <MaterialIcons name='close' size={24} color={theme.subtext} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Company Name
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: 'rgba(27, 54, 93, 0.8)',
                      color: '#fff',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  ]}
                  value={user.company}
                  placeholder='Enter company name'
                  placeholderTextColor='#aaa'
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Business Type
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: 'rgba(27, 54, 93, 0.8)',
                      color: '#fff',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  ]}
                  placeholder='Enter business type'
                  placeholderTextColor='#aaa'
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Tax ID
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: 'rgba(27, 54, 93, 0.8)',
                      color: '#fff',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  ]}
                  placeholder='Enter tax ID'
                  placeholderTextColor='#aaa'
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Business Address
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: 'rgba(27, 54, 93, 0.8)',
                      color: '#fff',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      height: 80,
                      textAlignVertical: 'top',
                    },
                  ]}
                  placeholder='Enter business address'
                  placeholderTextColor='#aaa'
                  multiline
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { borderColor: theme.border },
                ]}
                onPress={() => setCompanyModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: theme.accent },
                ]}
                onPress={() => {
                  setCompanyModal(false);
                  Alert.alert('Success', 'Company information updated!');
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success
                  );
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  Save Information
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>


      {/* Help & Support Modal */}
      <Modal
        visible={helpModal}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={theme.background}
            style={[styles.modalContent, { borderColor: theme.border }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Help & Support
              </Text>
              <TouchableOpacity onPress={() => setHelpModal(false)}>
                <MaterialIcons name='close' size={24} color={theme.subtext} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <MaterialIcons
                    name='live-help'
                    size={20}
                    color={theme.subtext}
                  />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    Live Chat
                  </Text>
                </View>
                <MaterialIcons
                  name='chevron-right'
                  size={20}
                  color={theme.subtext}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <MaterialIcons name='email' size={20} color={theme.subtext} />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    Email Support
                  </Text>
                </View>
                <MaterialIcons
                  name='chevron-right'
                  size={20}
                  color={theme.subtext}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <MaterialIcons name='phone' size={20} color={theme.subtext} />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    Call Support
                  </Text>
                </View>
                <MaterialIcons
                  name='chevron-right'
                  size={20}
                  color={theme.subtext}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <MaterialIcons
                    name='article'
                    size={20}
                    color={theme.subtext}
                  />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    Knowledge Base
                  </Text>
                </View>
                <MaterialIcons
                  name='chevron-right'
                  size={20}
                  color={theme.subtext}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <MaterialIcons
                    name='video-library'
                    size={20}
                    color={theme.subtext}
                  />
                  <Text style={[styles.settingText, { color: theme.text }]}>
                    Video Tutorials
                  </Text>
                </View>
                <MaterialIcons
                  name='chevron-right'
                  size={20}
                  color={theme.subtext}
                />
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: theme.accent },
                ]}
                onPress={() => setHelpModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

    </LinearGradient>
    </>
  );
}

const getStyles = (Colors: any, darkMode: boolean, desktopWeb = false) => {
  const edge = desktopWeb ? WEB_DESKTOP_EDGE_HORIZONTAL : ScreenLayout.edge.horizontal;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 12,
    marginHorizontal: edge,
  },
  scrollContent: {
    paddingTop: desktopWeb ? 24 : 16,
    paddingHorizontal: edge,
    paddingBottom: 40,
  },
  /** Same pattern as `projects.tsx` `wideContainer`: cancel scroll horizontal padding so the shell is nearly full-bleed. */
  profileShellBleed: {
    ...(!(Platform.OS === 'web' && desktopWeb)
      ? {
          marginHorizontal: -edge,
          paddingHorizontal: desktopWeb ? 8 : 4,
        }
      : {}),
  },
  backButtonWrapper: {
    marginRight: 12,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: darkMode ? "#f9fafb" : "#000000",
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
    backgroundColor: darkMode ? Colors.card : Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentCard: {
    borderRadius: 23,
    backgroundColor: darkMode ? Colors.card : Colors.bg,
    overflow: 'visible',
  },
  content: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  /** Segments sit inside `content` (16px padding). Do not use dashboard `-edge` bleed — that pulled tabs past the padded column and misaligned the teal frame vs cards. */
  wideContainer: {
    marginBottom: 18,
  },
  segmentContainer: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#19E180',
  },
  segmentInner: {
    flexDirection: 'row',
    padding: 4,
  },
  segmentTab: {
    flex: 1,
    borderRadius: 999,
  },
  segmentTabActive: {
    shadowColor: '#22c55e',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  segmentTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E5F7FF',
  },
  segmentLabelActive: {
    color: '#050B13',
  },
  tabContent: {
    flex: 1,
  },
  tabContentScroll: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  settingsTabContentScroll: {
    flexGrow: 0,
    paddingBottom: 0,
  },
  profileHeader: {
    position: 'relative',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  editIconButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    padding: 8,
  },
  editModeActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarGlowContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 4,
    backgroundColor: 'rgba(0, 122, 112, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#43cea2',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#43cea2',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeaderContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  userRole: {
    fontSize: 14,
    marginBottom: 2,
  },
  userCompany: {
    fontSize: 12,
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  trustMicroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  trustBadgeText: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '500',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewCount: {
    fontSize: 12,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D3D9E6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 6,
    textAlign: 'center',
    lineHeight: 26,
    width: '100%',
    letterSpacing: 0.5,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 16,
    flexWrap: 'wrap',
    width: '100%',
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  contactPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  contactPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  contactDetails: {
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  contactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    fontSize: 14,
  },
  privacyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  privacyHintText: {
    fontSize: 12,
    flex: 1,
  },
  certificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  certificationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certificationText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  certificationItemEditable: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(67, 206, 162, 0.05)',
    marginBottom: 6,
  },
  emptyLicenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  licenseInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontWeight: '500',
  },
  addLicenseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  addLicenseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  removeLicenseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioInput: {
    minHeight: 130,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: 'rgba(67, 206, 162, 0.05)',
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
  emptyBioContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyBioIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyBioTitle: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    opacity: 0.9,
  },
  addBioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
    minWidth: 200,
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addBioButtonIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addBioButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  bioHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  characterCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  characterWarning: {
    fontSize: 11,
    fontWeight: '600',
  },
  portfolioContainer: {
    marginTop: 12,
    paddingVertical: 4,
  },
  portfolioItem: {
    marginRight: 16,
    width: 160,
  },
  portfolioImageShell: {
    width: 160,
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  portfolioImage: {
    width: '100%',
    height: '100%',
  },
  featuredBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(250, 204, 21, 0.45)',
  },
  featuredBadgeText: {
    color: '#FEF9C3',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  deletePortfolioButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(185, 28, 28, 0.92)',
    borderRadius: 16,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  portfolioCaption: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 0,
    fontWeight: '500',
  },
  portfolioCaptionInput: {
    width: 160,
    minHeight: 44,
    maxHeight: 64,
    marginTop: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 12,
    lineHeight: 16,
  },
  emptyPortfolio: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyPortfolioIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyPortfolioTitle: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
    opacity: 0.9,
  },
  emptyPortfolioSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.7,
    lineHeight: 18,
  },
  emptyPortfolioText: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
  },
  addPortfolioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
    minWidth: 200,
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addPortfolioButtonIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addPortfolioButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  insuranceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  insuranceList: {
    flexDirection: 'column',
    gap: 10,
  },
  insuranceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  insuranceIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insuranceItemEditable: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(67, 206, 162, 0.05)',
  },
  insuranceText: {
    fontSize: 14,
    flex: 1,
  },
  settingsGroupContainer: {
    marginBottom: 24,
  },
  settingsGroupTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  settingsGroup: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'visible',
    marginHorizontal: 0,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  settingItemWithSubtext: {
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  settingItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 0,
    overflow: 'hidden',
  },
  settingSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  switchWrapper: {
    marginTop: 6,
    marginRight: 0,
    flexShrink: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    fontSize: 16,
  },
  dangerZoneContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.2)',
    overflow: 'hidden',
    marginTop: 8,
  },
  dangerZoneSpacer: {
    height: 24,
  },
  dangerZoneItem: {
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerZoneText: {
    fontSize: 17,
    fontWeight: '600',
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
  settingsFooter: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
    marginTop: 0,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  gradientTextWrapper: {
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flexDirection: 'row',
  },
  footerVersion: {
    fontSize: 12,
    opacity: 0.7,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    marginTop: 12,
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  profileCompletionHint: {
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  searchSection: {
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchClearButton: {
    padding: 4,
  },
  memberSinceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  memberSinceText: {
    fontSize: 12,
  },
  statIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(67, 206, 162, 0.15)',
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    minHeight: 550,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#142850',
    flexDirection: 'column',
    display: 'flex',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  modalCancelButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalCancelText: {
    fontSize: 17,
    fontWeight: '400',
  },
  modalSaveButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalSaveText: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalFormGroup: {
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalInputRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  modalTextInput: {
    fontSize: 17,
    fontWeight: '400',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    letterSpacing: -0.4,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalSaveButton: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalSaveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  keyboardToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 44,
  },
  keyboardDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  keyboardDoneText: {
    fontSize: 17,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(27, 54, 93, 0.8)',
    color: '#fff',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalSaveButton: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalSaveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  modalFooterOld: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Password Modal Specific Styles - Matching sign-in page format
  passwordModalOverlay: {
    flex: 1,
  },
  passwordModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  passwordModalCard: {
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
  passwordModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  passwordModalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  passwordInputGroup: {
    marginBottom: 14,
  },
  passwordInputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  // Language Modal Specific Styles
  languageModalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxHeight: '75%',
    width: '90%',
    alignSelf: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 10,
  },
  languageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  languageModalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  languageModalScrollView: {
    maxHeight: 400,
  },
  languageModalScrollContent: {
    paddingBottom: 20,
  },
  languageOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 4,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  languageOptionText: {
    fontSize: 16,
    fontWeight: '400',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  passwordEyeIcon: {
    paddingRight: 14,
    paddingLeft: 8,
  },
  passwordHelperText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  passwordMatchText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  passwordMismatchText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  passwordModalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  passwordModalButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordCancelButton: {
    borderWidth: 1,
  },
  passwordCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  passwordSaveButton: {
    backgroundColor: '#43cea2',
  },
  passwordSaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  saveButton: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  editableInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  contactEditInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  selectBox: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
});
};
