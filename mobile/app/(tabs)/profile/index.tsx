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
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { FORM_KEYBOARD_SCROLL_PROPS } from '@/constants/keyboardScrollProps';
import { nativeNumericKeyboardProps, resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import WebPageShell, {
  getWebPageShellMaxWidth,
  WEB_PAGE_SHELL_HORIZONTAL_PADDING,
} from '@/components/layout/WebPageShell';
import {
  ScreenLayout,
  isDesktopWebLayoutWidth,
  DASHBOARD_WEB_MAX_CONTENT_WIDTH,
  WEB_DESKTOP_EDGE_HORIZONTAL,
} from '@/constants/ScreenLayout';
import { useTabScrollBottomInset } from '@/hooks/useTabScrollBottomInset';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import { useApi } from '@/contexts/ApiContext';
import { useProjectList } from '@/contexts/ProjectListContext';
import { resetBusinessEntitlementCache } from '@/utils/businessEntitlementCache';
import { clearWorkspaceAccessSnapshot } from '@/utils/workspaceAccessCache';
import { invalidateWorkspaceTimelineProgressCache } from '@/utils/workspaceTimelineProgress';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRestrictedWorkspaceFinancials } from '@/hooks/useRestrictedWorkspaceFinancials';
import { clerkAuthService } from '@/services/clerkAuth';
import { syncClerkTokenToAsyncStorage } from '@/utils/authTokenHelper';
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
import { isBetaFeedbackVisibleForUser } from '@/lib/betaFeedback/betaFeedbackConfig';
import { syncBpsDirectoryListing } from '@/services/bpsDirectorySync';
import {
  DEFAULT_PROFILE_AVATAR_SOURCE,
  getProfileAvatarImageSource,
  profileHasCustomAvatar,
  sanitizeStoredProfileAvatar,
  scrubContractorProfileAvatarFields,
} from '@/lib/profileAvatar';
import { evaluateContractorProfileCompletion } from '@/lib/profileCompletion';
import { clearProfileCompletionReminderDismissed } from '@/lib/profileCompletionReminderStorage';
import ContractorPricingMemorySettings from '@/components/estimate/ContractorPricingMemorySettings';

/**
 * In-memory defaults only — never persisted as-is. Avoids debounced autosave racing
 * `loadProfile` and overwriting `bps.contractorProfile` with demo data.
 */
const DEFAULT_CONTRACTOR_USER = {
  id: 'local',
  name: '',
  email: '',
  phone: '',
  company: '',
  website: '',
  role: 'General Contractor',
  location: '',
  experience: 0,
  avatar: '',
  joinDate: new Date().toISOString().split('T')[0],
  totalProjects: 0,
  completedProjects: 0,
  activeProjects: 0,
  totalRevenue: 0,
  averageRating: 0,
  reviewCount: 0,
  licenses: [] as string[],
  insurance: {
    generalLiability: false,
    autoInsurance: false,
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

/** Gallery/camera URIs on native often live in temp/cache; copy into app documents so AsyncStorage paths stay valid. */
async function persistPickedImageToDocuments(uri: string, filePrefix: string): Promise<string> {
  if (Platform.OS === 'web' || !uri) return uri;
  try {
    const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
    const base = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!base) return uri;
    const dest = `${base}${filePrefix}-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (e) {
    console.warn(`persistPickedImageToDocuments(${filePrefix}): copy failed`, e);
    return uri;
  }
}

/** First US ZIP in free-form location text (e.g. "Las Vegas, NV 89141"). */
function extractUsZipFromText(text: string): string {
  const m = String(text || '').match(/\b(\d{5})\b/);
  return m ? m[1] : '';
}

/**
 * Expo web image picker returns `blob:` / `file:` URIs. Estimate contract PDFs merge stored
 * profile and inline images for Puppeteer — those schemes cannot be loaded server-side.
 * Persist a `data:` URL so exports use the same photo as Profile, not an OAuth fallback.
 */
async function logoUriPersistableForWebPdf(uri: string | undefined | null): Promise<string | undefined> {
  if (Platform.OS !== 'web') return uri ?? undefined;
  const v = String(uri ?? '').trim();
  if (!v) return undefined;
  if (v.startsWith('data:')) return v;
  if (!v.startsWith('blob:') && !v.startsWith('file:')) return v;
  try {
    const response = await fetch(v);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    const dataUrl = await new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
    return dataUrl ?? undefined;
  } catch (e) {
    console.warn('Web profile logo → data URL for PDF storage failed:', e);
    return undefined;
  }
}

/**
 * Persist avatar to `bps.contractorProfile` immediately after the user picks a photo.
 * Otherwise `useFocusEffect` / pull-to-refresh can re-read storage before the debounced
 * autosave (500ms) and merge `profile.avatar || prev.avatar`, which prefers stale disk and
 * makes the picture flip between the new image and the old / default logo.
 */
async function flushAvatarToStoredContractorProfile(avatarUri: string): Promise<void> {
  try {
    let stored = sanitizeStoredProfileAvatar(avatarUri);
    if (!stored) return;
    if (Platform.OS === 'web' && stored) {
      const converted = await logoUriPersistableForWebPdf(stored);
      if (converted) stored = converted;
    }
    const raw = await AsyncStorage.getItem('bps.contractorProfile');
    if (!raw) return;
    const profile = JSON.parse(raw);
    const next = {
      ...profile,
      avatar: stored,
      ...(Platform.OS === 'web' && String(stored || '').trim()
        ? { logoUrl: String(stored).trim() }
        : {}),
    };
    await AsyncStorage.setItem('bps.contractorProfile', JSON.stringify(next));
  } catch (e) {
    console.warn('flushAvatarToStoredContractorProfile failed', e);
  }
}

/** Re-hydrate from disk without clobbering a newer in-memory avatar (see flush above). */
function mergeAvatarOnProfileFocus(prevAvatar: string | undefined, diskAvatar: unknown): string {
  const disk = sanitizeStoredProfileAvatar(
    typeof diskAvatar === 'string' ? diskAvatar : ''
  );
  const prev = sanitizeStoredProfileAvatar(prevAvatar);
  if (prev && prev !== disk) return prev;
  return disk || prev || '';
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
const getSegmentStyles = (Colors: any, darkMode: boolean) => StyleSheet.create({
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
    backgroundColor: darkMode ? 'rgba(67, 206, 162, 0.14)' : 'rgba(67, 206, 162, 0.12)',
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(67, 206, 162, 0.35)' : 'rgba(67, 206, 162, 0.4)',
  },
  segmentTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.sub,
  },
  segmentLabelActive: {
    color: Colors.primary,
  },
});

const SegmentTab: React.FC<SegmentTabProps> = ({ label, icon, isActive, onPress }) => {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getSegmentStyles(Colors, darkMode), [Colors, darkMode]);
  
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const iconColor = isActive ? Colors.primary : Colors.sub;
  const labelStyle = isActive
    ? [styles.segmentLabel, styles.segmentLabelActive]
    : styles.segmentLabel;

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.segmentTab, isActive && styles.segmentTabActive]}
    >
      <View style={styles.segmentTabInner}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
        <Text style={labelStyle}>{label}</Text>
      </View>
    </Pressable>
  );
};

function buildEditFormFromUser(user: {
  name?: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  location?: string;
}): EditFormData {
  const nameParts = user.name?.split(' ') || [];
  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    email: user.email,
    phone: user.phone || '',
    company: user.company || '',
    role: user.role || '',
    city: user.location?.split(', ')[0] || '',
    state: user.location?.split(', ')[1] || '',
  };
}

export default function ProfileScreen() {
  // Require authentication to access this screen
  useRequireAuth();
  const { canViewTaxCenter } = useRestrictedWorkspaceFinancials();

  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const { width: layoutWidth } = useWindowDimensions();
  const tabScrollBottomInset = useTabScrollBottomInset();
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
  /** Web: match Profile header (back + title) to WebPageShell column + inner padding so the arrow lines up with the green frame. */
  const webProfileHeaderMargins = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    const maxW = getWebPageShellMaxWidth('profile');
    const gutter = (layoutWidth - Math.min(layoutWidth, maxW)) / 2;
    const inset = gutter + WEB_PAGE_SHELL_HORIZONTAL_PADDING;
    return { marginLeft: inset, marginRight: inset };
  }, [layoutWidth]);
  /** Web: column shell handles insets; native keeps edge bleed. */
  const profileShellBleedActive = Platform.OS !== 'web';
  const styles = useMemo(() => getStyles(Colors, darkMode, desktopWeb), [Colors, darkMode, desktopWeb]);
  const { updateProfile, updatePreferences, logout: apiLogout } = useApi();
  const { clearProjectsLocal } = useProjectList();
  const { t } = useTranslation(); // Use directly for reactivity

  const [user, setUser] = useState(DEFAULT_CONTRACTOR_USER);
  /** False until first `loadProfile` finishes — blocks autosave from clobbering storage with defaults. */
  const profileReadyRef = useRef(false);

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
  let clerkGetToken: (() => Promise<string | null>) | null = null;
  let clerkUser: any = null;
  const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkEnabled = publishableKey && (publishableKey.startsWith('pk_live_') || (publishableKey.startsWith('pk_test_') && publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk'));
  
  if (isClerkEnabled && useClerkAuth) {
    try {
      const clerkAuth = useClerkAuth();
      clerkSignOut = clerkAuth?.signOut || null;
      clerkGetToken = clerkAuth?.getToken || null;
    } catch (e) {
      // Not in ClerkProvider - that's okay, we'll use API logout instead
      clerkSignOut = null;
      clerkGetToken = null;
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
    isBetaFeedbackVisibleForUser(clerkEmailForBeta);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'settings'
  >('overview');
  const [editModal, setEditModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
      profileReadyRef.current = false;
      try {
        const saved = await AsyncStorage.getItem('bps.contractorProfile');
        if (saved) {
          const parsed = JSON.parse(saved);
          const profile = scrubContractorProfileAvatarFields(parsed);
          if (
            parsed.avatar !== profile.avatar ||
            parsed.logoUrl !== profile.logoUrl
          ) {
            await AsyncStorage.setItem(
              'bps.contractorProfile',
              JSON.stringify(profile)
            );
          }
          setUser(prev => ({
            ...prev,
            name: profile.name || prev.name,
            company: profile.company || prev.company,
            avatar: mergeAvatarOnProfileFocus(prev.avatar, profile.avatar),
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
        }
        // If nothing saved, do not write in-memory defaults to storage (avoids autosave race + demo overwrite).
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        profileReadyRef.current = true;
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
          const parsed = JSON.parse(saved);
          const profile = scrubContractorProfileAvatarFields(parsed);
          if (
            !cancelled &&
            (parsed.avatar !== profile.avatar || parsed.logoUrl !== profile.logoUrl)
          ) {
            await AsyncStorage.setItem(
              'bps.contractorProfile',
              JSON.stringify(profile)
            );
          }
          setUser((prev) => ({
            ...prev,
            name: profile.name || prev.name,
            company: profile.company || prev.company,
            avatar: mergeAvatarOnProfileFocus(prev.avatar, profile.avatar),
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
  const [passwordModalFocusedField, setPasswordModalFocusedField] = useState<string | null>(null);
  const currentPasswordRef = useRef<TextInput>(null);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const [notificationsModal, setNotificationsModal] = useState(false);
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
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [editModalFocusedField, setEditModalFocusedField] = useState<string | null>(null);
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
    card: darkMode ? '#1C1D20' : Colors.surface2,
    cardInset: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.92)',
    fieldMuted: darkMode ? 'rgba(255, 255, 255, 0.55)' : 'rgba(15, 23, 42, 0.55)',
    fieldPlaceholder: darkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(15, 23, 42, 0.35)',
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
  }), [Colors, darkMode]);

  const editFieldInputStyle = useCallback(
    (field: string, value: string, extra?: object) => [
      styles.editModalFieldInput,
      extra,
      {
        color:
          editModalFocusedField === field || String(value || '').trim()
            ? theme.text
            : theme.fieldMuted,
      },
    ],
    [editModalFocusedField, theme.text, theme.fieldMuted]
  );

  const editFieldFocusHandlers = useCallback(
    (field: string) => ({
      onFocus: () => setEditModalFocusedField(field),
      onBlur: () => setEditModalFocusedField((current) => (current === field ? null : current)),
    }),
    []
  );

  const passwordFieldFocusHandlers = useCallback(
    (field: string) => ({
      onFocus: () => setPasswordModalFocusedField(field),
      onBlur: () =>
        setPasswordModalFocusedField((current) => (current === field ? null : current)),
    }),
    []
  );

  const passwordFieldInputStyle = useCallback(
    (field: string, value: string) => [
      styles.editModalFieldInput,
      styles.passwordFieldInput,
      {
        color:
          passwordModalFocusedField === field || String(value || '').trim()
            ? theme.text
            : theme.fieldMuted,
      },
    ],
    [passwordModalFocusedField, theme.text, theme.fieldMuted]
  );

  const trimmedCurrentPassword = currentPassword.trim();
  const trimmedNewPassword = newPassword.trim();
  const trimmedConfirmPassword = confirmPassword.trim();
  const passwordsMatch =
    trimmedConfirmPassword.length > 0 && trimmedNewPassword === trimmedConfirmPassword;
  const passwordMeetsLength = trimmedNewPassword.length >= 8;
  const passwordIsDifferent =
    trimmedNewPassword.length > 0 && trimmedNewPassword !== trimmedCurrentPassword;
  const passwordFormValid =
    trimmedCurrentPassword.length > 0 &&
    passwordMeetsLength &&
    passwordsMatch &&
    passwordIsDifferent;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const saved = await AsyncStorage.getItem('bps.contractorProfile');
      if (saved) {
        const parsed = JSON.parse(saved);
        const profile = scrubContractorProfileAvatarFields(parsed);
        if (
          parsed.avatar !== profile.avatar ||
          parsed.logoUrl !== profile.logoUrl
        ) {
          await AsyncStorage.setItem(
            'bps.contractorProfile',
            JSON.stringify(profile)
          );
        }
        setUser((prev) => ({
          ...prev,
          name: profile.name || prev.name,
          company: profile.company || prev.company,
          avatar: mergeAvatarOnProfileFocus(prev.avatar, profile.avatar),
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
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error refreshing profile from storage:', error);
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
          if (!profileReadyRef.current) return;
          const listedZip = extractUsZipFromText(user.location);
          let prevServiceZip = '';
          let listOnFindSubcontractors = false;
          try {
            const existingRaw = await AsyncStorage.getItem('bps.contractorProfile');
            if (existingRaw) {
              const existing = JSON.parse(existingRaw);
              prevServiceZip = String(existing.serviceZip || '')
                .replace(/\D/g, '')
                .slice(0, 5);
              listOnFindSubcontractors = !!existing.listOnFindSubcontractors;
            }
          } catch {
            /* ignore */
          }
          const serviceZip =
            listedZip.length === 5 ? listedZip : prevServiceZip.length === 5 ? prevServiceZip : '';
          const rawAvatar = sanitizeStoredProfileAvatar(user.avatar);
          let avatarForStorage = rawAvatar;
          if (Platform.OS === 'web' && rawAvatar) {
            const converted = await logoUriPersistableForWebPdf(rawAvatar);
            if (converted) avatarForStorage = sanitizeStoredProfileAvatar(converted);
          }
          // Always save the complete profile object
          const fullProfile = {
            name: user.name,
            company: user.company,
            avatar: avatarForStorage,
            phone: user.phone,
            email: user.email,
            website: user.website,
            role: user.role,
            location: user.location,
            insurance: user.insurance,
            licenses: user.licenses,
            companyBio: user.companyBio !== undefined ? user.companyBio : '',
            projectPortfolio: user.projectPortfolio || [],
            listOnFindSubcontractors,
            serviceZip,
            ...(Platform.OS === 'web' && String(avatarForStorage || '').trim()
              ? { logoUrl: String(avatarForStorage).trim() }
              : {}),
          };
          await AsyncStorage.setItem('bps.contractorProfile', JSON.stringify(fullProfile));
          if (evaluateContractorProfileCompletion(fullProfile).isComplete) {
            const reminderUserId =
              clerkUser?.id ||
              String(fullProfile.email || user.email || '')
                .trim()
                .toLowerCase() ||
              'local';
            await clearProfileCompletionReminderDismissed(reminderUserId);
          }
          console.log('💾 Saved complete profile to AsyncStorage');
          const uid = String(clerkUser?.id || '').trim();
          if (uid.startsWith('user_')) {
            await syncBpsDirectoryListing({
              id: uid,
              companyName: user.company,
              contactName: user.name,
              email: user.email,
              phone: user.phone?.replace(/\D/g, ''),
              website: user.website,
              trades: user.role ? [user.role] : ['General Contractor'],
              zip: serviceZip,
              listOnFindSubcontractors: listOnFindSubcontractors && serviceZip.length === 5,
            });
          }
        } catch (error) {
          console.error('Failed to save profile:', error);
        }
      };
      
      // Debounce saves to avoid too many writes
      const timeoutId = setTimeout(saveAllProfileData, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [user.name, user.company, user.avatar, user.phone, user.email, user.website, user.role, user.location, user.insurance, user.licenses, user.companyBio, user.projectPortfolio, isEditingLicenses, isEditingBio, isEditingPortfolio]);

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
        let listOnFindSubcontractors = false;
        try {
          const existingRaw = await AsyncStorage.getItem('bps.contractorProfile');
          if (existingRaw) {
            const existing = JSON.parse(existingRaw);
            prevServiceZip = String(existing.serviceZip || '')
              .replace(/\D/g, '')
              .slice(0, 5);
            listOnFindSubcontractors = !!existing.listOnFindSubcontractors;
          }
        } catch {
          /* ignore */
        }
        const listedZip = extractUsZipFromText(location);
        const serviceZip =
          listedZip.length === 5 ? listedZip : prevServiceZip.length === 5 ? prevServiceZip : '';
        const rawAvatar = sanitizeStoredProfileAvatar(user.avatar);
        let avatarForStorage = rawAvatar;
        if (Platform.OS === 'web' && rawAvatar) {
          const converted = await logoUriPersistableForWebPdf(rawAvatar);
          if (converted) avatarForStorage = sanitizeStoredProfileAvatar(converted);
        }
        const profileToSave = {
          name: fullName,
          company: editForm.company,
          phone: editForm.phone,
          email: editForm.email,
          website: user.website,
          role: editForm.role,
          location,
          avatar: avatarForStorage,
          insurance: user.insurance,
          licenses: user.licenses,
          companyBio: user.companyBio !== undefined ? user.companyBio : '',
          projectPortfolio: user.projectPortfolio || [],
          listOnFindSubcontractors,
          serviceZip,
          ...(Platform.OS === 'web' && String(avatarForStorage || '').trim()
            ? { logoUrl: String(avatarForStorage).trim() }
            : {}),
        };
        await AsyncStorage.setItem('bps.contractorProfile', JSON.stringify(profileToSave));
        if (evaluateContractorProfileCompletion(profileToSave).isComplete) {
          const reminderUserId =
            clerkUser?.id ||
            String(profileToSave.email || user.email || '')
              .trim()
              .toLowerCase() ||
            'local';
          await clearProfileCompletionReminderDismissed(reminderUserId);
        }
        console.log('💾 Saved complete contractor profile to AsyncStorage');
        const uid = String(clerkUser?.id || '').trim();
        if (uid.startsWith('user_')) {
          await syncBpsDirectoryListing({
            id: uid,
            companyName: editForm.company,
            contactName: fullName,
            email: editForm.email,
            phone: editForm.phone.replace(/\D/g, ''),
            website: user.website,
            trades: editForm.role ? [editForm.role] : ['General Contractor'],
            zip: serviceZip,
            listOnFindSubcontractors: listOnFindSubcontractors && serviceZip.length === 5,
          });
        }
      } catch (error) {
        console.error('Failed to save profile to AsyncStorage:', error);
      }
      
      setEditModalFocusedField(null);
      setEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [editForm, user.avatar, user.website, user.companyBio, user.projectPortfolio, user.insurance, user.licenses, updateProfile]);

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
    setEditModalFocusedField(null);
    setEditModal(false);
  }, [user]);

  const openEditProfileModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditForm(buildEditFormFromUser(user));
    setEditModalFocusedField(null);
    setEditModal(true);
  }, [user]);

  // Settings handlers
  const closePasswordModal = useCallback(() => {
    setPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordModalFocusedField(null);
  }, []);

  const handleChangePassword = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordModalFocusedField(null);
    setPasswordModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleUpdatePassword = useCallback(async () => {
    if (!trimmedCurrentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }

    if (!trimmedNewPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (!passwordMeetsLength) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (!passwordIsDifferent) {
      Alert.alert('Error', 'New password must be different from your current password');
      return;
    }

    if (!passwordsMatch) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!isClerkEnabled || !clerkUser) {
      Alert.alert(
        'Unable to update password',
        'Password changes are only available for email sign-in accounts. Contact support if you need help.'
      );
      return;
    }

    setPasswordLoading(true);
    try {
      await clerkUser.updatePassword({
        currentPassword: trimmedCurrentPassword,
        newPassword: trimmedNewPassword,
      });

      Alert.alert('Success', 'Password updated successfully!', [
        {
          text: 'OK',
          onPress: () => {
            closePasswordModal();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]);
    } catch (error: any) {
      console.error('Password update error:', error);
      const errorMessage =
        error?.errors?.[0]?.message ||
        error?.message ||
        'Failed to update password. Please try again.';

      if (
        errorMessage.includes('current') ||
        errorMessage.includes('Current') ||
        errorMessage.includes('incorrect')
      ) {
        Alert.alert('Error', 'Current password is incorrect. Please try again.');
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setPasswordLoading(false);
    }
  }, [
    trimmedCurrentPassword,
    trimmedNewPassword,
    passwordMeetsLength,
    passwordIsDifferent,
    passwordsMatch,
    isClerkEnabled,
    clerkUser,
    closePasswordModal,
  ]);

  const handleNotificationPreferences = useCallback(() => {
    setNotificationsModal(true);
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

  const performDeleteAccount = useCallback(async (): Promise<{
    deleteApiFailed: boolean;
    deleteApiClerkFailed: boolean;
    error?: unknown;
  }> => {
    let deleteApiFailed = false;
    let deleteApiClerkFailed = false;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      if (apiLogout) {
        try {
          if (clerkGetToken) {
            const clerkToken = await clerkGetToken();
            if (clerkToken) {
              await syncClerkTokenToAsyncStorage(clerkToken);
            }
          }
          const apiService = require('@/services/api').apiService;
          const delResult = await apiService.deleteAccount();
          if (delResult && delResult.clerkDeleteFailed) {
            deleteApiClerkFailed = true;
          }
        } catch (apiError) {
          console.error('Error calling delete account API:', apiError);
          deleteApiFailed = true;
        }
      }

      // Delete Clerk login so the email can be reused (does not require backend CLERK_SECRET_KEY).
      if (isClerkEnabled && clerkUser && typeof clerkUser.delete === 'function') {
        try {
          await clerkUser.delete();
        } catch (clerkDeleteError) {
          console.error('Clerk user.delete failed:', clerkDeleteError);
          deleteApiClerkFailed = true;
        }
      }

      try {
        await clearAllOnboardingCompletionKeys();
      } catch (e) {
        console.warn('clearAllOnboardingCompletionKeys:', e);
      }

      try {
        await clearProjectsLocal();
      } catch (e) {
        console.warn('clearProjectsLocal:', e);
      }

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

      try {
        await AsyncStorage.clear();
      } catch (clearError) {
        console.error('Error clearing AsyncStorage:', clearError);
      }

      if (clerkSignOut) {
        try {
          await clerkSignOut();
        } catch (e) {
          console.log('Clerk signOut not available, continuing');
        }
      }

      try {
        await clerkAuthService.signOut();
      } catch (e) {
        console.error('Error signing out from clerkAuthService:', e);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { deleteApiFailed, deleteApiClerkFailed };
    } catch (error) {
      console.error('Account deletion error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return { deleteApiFailed: true, deleteApiClerkFailed: false, error };
    }
  }, [apiLogout, clerkGetToken, clerkSignOut, clearProjectsLocal, isClerkEnabled, clerkUser]);

  const finishDeleteAccountFlow = useCallback(
    (deleteApiFailed: boolean, deleteApiClerkFailed: boolean, hadError: boolean) => {
      if (hadError) {
        const errorTitle = 'Error';
        const errorMessage =
          'There was an error deleting your account. Please try again or contact support.';

        if (
          Platform.OS === 'web' &&
          typeof window !== 'undefined' &&
          typeof window.alert === 'function'
        ) {
          window.alert(`${errorTitle}\n\n${errorMessage}`);
          router.replace('/');
          return;
        }

        Alert.alert(errorTitle, errorMessage, [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/');
            },
          },
        ]);
        return;
      }

      const title =
        deleteApiFailed || deleteApiClerkFailed ? 'Data removed' : 'Account Deleted';
      const message = deleteApiFailed
        ? 'Your local app data was cleared and you were signed out, but the server delete did not finish. If you sign back into the same account, server projects may return. Please try Delete Account again when online or contact support.'
        : deleteApiClerkFailed
          ? 'Your app data was cleared and you were signed out, but your sign-in account may still exist. Try Delete Account again, remove the user in the Clerk Dashboard (Users), or contact support to reuse this email.'
          : 'Your account has been successfully deleted. All your data has been permanently removed.';

      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        typeof window.alert === 'function'
      ) {
        window.alert(`${title}\n\n${message}`);
        router.replace('/');
        return;
      }

      Alert.alert(title, message, [
        {
          text: 'OK',
          onPress: () => {
            router.replace('/');
          },
        },
      ]);
    },
    [router]
  );

  const runDeleteAccount = useCallback(async () => {
    const result = await performDeleteAccount();
    finishDeleteAccountFlow(
      result.deleteApiFailed,
      result.deleteApiClerkFailed,
      Boolean(result.error)
    );
  }, [performDeleteAccount, finishDeleteAccountFlow]);

  const handleDeleteAccount = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function'
    ) {
      const firstOk = window.confirm(
        'Delete Account\n\nThis action cannot be undone. All your data will be permanently deleted. Are you absolutely sure?'
      );
      if (!firstOk) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      const finalOk = window.confirm(
        'Final Confirmation\n\nThis will permanently delete your account and all associated data. This action cannot be undone.\n\nDelete your account?'
      );
      if (!finalOk) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      void runDeleteAccount();
      return;
    }

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
                  onPress: () => {
                    void runDeleteAccount();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [runDeleteAccount]);

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
    if (profileHasCustomAvatar(user.avatar)) completedFields++;
    
    return Math.round((completedFields / totalFields) * 100);
  }, [user]);

  // Filter settings based on search query (search UI removed — always show all)
  const filterSettings = useCallback((_settingText: string): boolean => {
    return true;
  }, []);

  const performLogout = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        await clearProjectsLocal();
      } catch (e) {
        console.warn('clearProjectsLocal on logout:', e);
      }

      resetBusinessEntitlementCache();
      await clearWorkspaceAccessSnapshot().catch(() => null);
      invalidateWorkspaceTimelineProgressCache();

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

      if (clerkSignOut) {
        try {
          await clerkSignOut();
        } catch (e) {
          console.log('Clerk signOut not available, continuing with logout');
        }
      }

      if (apiLogout) {
        try {
          await apiLogout();
        } catch (e) {
          console.log('API logout not available, continuing with logout');
        }
      }

      try {
        await clerkAuthService.signOut();
        console.log('✅ Signed out from clerkAuthService');
      } catch (e) {
        console.error('Error signing out from clerkAuthService:', e);
      }

      router.replace('/');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Logout error:', error);
      router.replace('/');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [clerkSignOut, apiLogout, router, clearProjectsLocal]);

  const handleLogout = useCallback(() => {
    const title = 'Logout';
    const message = 'Are you sure you want to logout?';

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function'
    ) {
      const ok = window.confirm(`${title}\n\n${message}`);
      if (!ok) return;
      void performLogout();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  }, [performLogout]);

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
        const picked = result.assets[0].uri;
        const newAvatar = await persistPickedImageToDocuments(picked, 'bps-profile-avatar');
        let avatarForState = newAvatar;
        if (Platform.OS === 'web' && newAvatar) {
          const converted = await logoUriPersistableForWebPdf(newAvatar);
          if (converted) avatarForState = converted;
        }
        await flushAvatarToStoredContractorProfile(avatarForState);
        setUser((prev) => ({ ...prev, avatar: avatarForState }));

        // Full profile still debounced-saved by useEffect; avatar is already on disk to avoid focus races.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Profile image updated successfully!');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    }
  }, []);


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
        const picked = result.assets[0].uri;
        const persistedUri = await persistPickedImageToDocuments(picked, 'bps-portfolio');
        const newImage = {
          id: `portfolio-${Date.now()}`,
          uri: persistedUri,
          caption: '',
        };

        setUser((prev) => ({
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
  }, []);

  const getProfileCompletionNextStep = useCallback((): { label: string; onPress: () => void } => {
    if (!user.company?.trim()) {
      return { label: 'Add your company name', onPress: openEditProfileModal };
    }
    if (!profileHasCustomAvatar(user.avatar)) {
      return { label: 'Upload your company logo', onPress: openEditProfileModal };
    }
    if (!user.phone?.trim()) {
      return { label: 'Add your phone number', onPress: openEditProfileModal };
    }
    if (!user.location?.trim()) {
      return { label: 'Add your service area', onPress: openEditProfileModal };
    }
    if (!user.companyBio?.trim()) {
      return { label: 'Add your company bio', onPress: () => setIsEditingBio(true) };
    }
    if (!user.projectPortfolio?.length) {
      return {
        label: 'Add your first portfolio photo',
        onPress: () => {
          setIsEditingPortfolio(true);
          handleAddPortfolioImage();
        },
      };
    }
    if (!user.licenses?.length) {
      return { label: 'Add your contractor license', onPress: () => setIsEditingLicenses(true) };
    }
    if (!user.insurance || !Object.values(user.insurance).some((v) => v === true)) {
      return {
        label: 'Add insurance coverage',
        onPress: () => scrollViewRef.current?.scrollToEnd({ animated: true }),
      };
    }
    if (!user.name?.trim()) {
      return { label: 'Add your contact name', onPress: openEditProfileModal };
    }
    return { label: 'Review your profile', onPress: () => setPreviewModalVisible(true) };
  }, [user, openEditProfileModal, handleAddPortfolioImage]);

  const commitNewLicense = useCallback(() => {
    const trimmed = newLicenseText.trim();
    if (!trimmed) return;
    setUser((prev) => ({
      ...prev,
      licenses: [...prev.licenses, trimmed],
    }));
    setNewLicenseText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [newLicenseText]);

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
  const completionNextStep = getProfileCompletionNextStep();
  const displayCompany = user.company?.trim() || 'Your Company';
  const displayRole = user.role || 'General Contractor';
  const displayLocation = user.location?.trim();
  const hasLicenseOnFile = Boolean(user.licenses?.length);
  const hasInsurance = Boolean(user.insurance && Object.values(user.insurance).some((v) => v === true));
  const hasVerifiedIdentity = Boolean(user.email?.trim());
  const trustBadges = [
    hasVerifiedIdentity ? { icon: 'verified' as const, label: 'Identity verified' } : null,
    hasLicenseOnFile ? { icon: 'badge' as const, label: 'License on file' } : null,
    hasInsurance ? { icon: 'security' as const, label: 'Insured' } : null,
  ].filter(Boolean);

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
              Complete your profile
            </Text>
            <Text style={[styles.sectionTitle, { color: theme.accent, marginBottom: 0, fontSize: 14 }]}>
              {profileCompletion}% complete
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
          <Text style={[styles.profileCompletionHint, { color: theme.subtext, opacity: darkMode ? 1 : 0.85, marginTop: 8 }]}>
            Next: {completionNextStep.label}
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              completionNextStep.onPress();
            }}
            activeOpacity={0.7}
            style={styles.profileCompletionCta}
          >
            <Text style={[styles.profileCompletionCtaText, { color: theme.accent }]}>
              Continue profile
            </Text>
            <MaterialIcons name='arrow-forward' size={16} color={theme.accent} />
          </TouchableOpacity>
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
          onPress={openEditProfileModal}
        >
          <MaterialIcons name='edit' size={18} color={theme.accent} />
        </TouchableOpacity>

        <View style={styles.profileHeaderContent}>
          <View style={styles.profileImageContainer}>
            <View style={styles.avatarGlowContainer}>
              <Image
                source={getProfileAvatarImageSource(user.avatar)}
                style={[
                  styles.profileImage,
                  !profileHasCustomAvatar(user.avatar) && styles.profileImageDefaultLogo,
                ]}
                defaultSource={DEFAULT_PROFILE_AVATAR_SOURCE}
                resizeMode="contain"
                onError={() => console.log('Profile image failed to load')}
              />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.userName, { color: theme.text }]}>
              {displayCompany}
            </Text>
            <Text style={[styles.userRole, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
              {displayRole}
            </Text>
            {displayLocation ? (
              <Text style={[styles.userCompany, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                {displayLocation}
              </Text>
            ) : null}
          <View style={styles.ratingContainer}>
            <MaterialIcons name='star' size={16} color='#FFD700' />
            {user.reviewCount > 0 ? (
              <>
                <Text style={[styles.ratingText, { color: theme.text }]}>
                  {user.averageRating}
                </Text>
                <Text style={[styles.reviewCount, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                  ({user.reviewCount} reviews)
                </Text>
              </>
            ) : (
              <Text style={[styles.reviewCount, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                New · No reviews yet
              </Text>
            )}
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

          {trustBadges.length > 0 && (
            <View style={styles.trustMicroRow}>
              {trustBadges.map((badge) => (
                <View key={badge.label} style={styles.trustBadge}>
                  <MaterialIcons name={badge.icon} size={14} color='#22c55e' />
                  <Text style={styles.trustBadgeText}>{badge.label}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPreviewModalVisible(true);
            }}
            activeOpacity={0.7}
            style={styles.previewProfileLink}
          >
            <Text style={[styles.previewProfileLinkText, { color: theme.accent }]}>
              Preview customer view
            </Text>
            <MaterialIcons name='arrow-forward' size={14} color={theme.accent} />
          </TouchableOpacity>
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
              style={[
                styles.bioInput,
                {
                  color: theme.text,
                  backgroundColor: darkMode ? '#2a2a2a' : '#f0f0f0',
                  borderColor: darkMode ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.14)',
                },
              ]}
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
              {...resolveTextInputKeyboardProps({ multiline: true })}
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
              <Text style={[styles.emptyBioTitle, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                Tell homeowners what you specialize in and why they should hire you.
              </Text>
              <TouchableOpacity
                style={[styles.addBioButtonCompact, {
                  backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setIsEditingBio(true);
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name='add' size={18} color={theme.accent} />
                <Text style={[styles.addBioButtonTextCompact, { color: theme.text }]}>
                  Add company bio
                </Text>
              </TouchableOpacity>
              <Text style={[styles.bioHint, { color: theme.subtext, opacity: darkMode ? 0.7 : 0.65 }]}>
                Complete profiles tend to receive more inquiries.
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
        
        {isEditingPortfolio && user.projectPortfolio && user.projectPortfolio.length > 0 && (
          <TouchableOpacity
            onPress={handleAddPortfolioImage}
            style={[styles.addPortfolioButtonCompact, {
              backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderColor: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              marginBottom: 12,
            }]}
          >
            <MaterialIcons name='add-photo-alternate' size={18} color={theme.accent} />
            <Text style={[styles.addPortfolioButtonTextCompact, { color: theme.text }]}>
              Add portfolio photo
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
            <Text style={[styles.emptyPortfolioTitle, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
              Show customers examples of your work.
            </Text>
            <Text style={[styles.emptyPortfolioSubtitle, { color: theme.subtext, opacity: darkMode ? 0.7 : 0.65 }]}>
              Before-and-after photos work especially well.
            </Text>
            <TouchableOpacity
              style={[styles.addPortfolioButtonCompact, {
                backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setIsEditingPortfolio(true);
                handleAddPortfolioImage();
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name='add-photo-alternate' size={18} color={theme.accent} />
              <Text style={[styles.addPortfolioButtonTextCompact, { color: theme.text }]}>
                Add first project
              </Text>
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

        <View style={styles.contactDetails}>
          {user.phone?.trim() ? (
            <View style={styles.contactLabeledRow}>
              <Text style={[styles.contactLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>Phone</Text>
              <Text style={[styles.contactValue, { color: theme.text }]}>{formatPhoneNumber(user.phone)}</Text>
            </View>
          ) : null}
          {user.email?.trim() ? (
            <View style={styles.contactLabeledRow}>
              <Text style={[styles.contactLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>Email</Text>
              <Text style={[styles.contactValue, { color: theme.text }]}>{user.email}</Text>
            </View>
          ) : null}
          {user.website?.trim() ? (
            <TouchableOpacity
              style={styles.contactLabeledRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL(user.website.startsWith('http') ? user.website : `https://${user.website}`);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.contactLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>Website</Text>
              <Text style={[styles.contactValue, { color: theme.text }]}>{user.website}</Text>
            </TouchableOpacity>
          ) : null}
          {displayLocation ? (
            <View style={styles.contactLabeledRow}>
              <Text style={[styles.contactLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>Service Area</Text>
              <Text style={[styles.contactValue, { color: theme.text }]}>{displayLocation}</Text>
            </View>
          ) : null}
        </View>

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
                No license added
              </Text>
              <TouchableOpacity
                onPress={() => setIsEditingLicenses(true)}
                style={{ marginLeft: 'auto' }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>+ Add license</Text>
              </TouchableOpacity>
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
                <View style={[styles.addLicenseCard, {
                  backgroundColor: theme.cardInset,
                  borderColor: theme.border,
                }]}>
                  <Text style={[styles.addLicenseLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                    Add license
                  </Text>
                  <Text style={[styles.addLicenseHint, { color: theme.subtext, opacity: darkMode ? 0.7 : 0.65 }]}>
                    e.g. Utah General Contractor #123456
                  </Text>
                  <TextInput
                    ref={addLicenseInputRef}
                    style={[styles.addLicenseInput, {
                      color: theme.text,
                      backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      borderColor: theme.border,
                    }]}
                    value={newLicenseText}
                    onChangeText={setNewLicenseText}
                    placeholder='License type and number'
                    placeholderTextColor={theme.subtext}
                    onFocus={() => {
                      setTimeout(() => {
                        addLicenseInputRef.current?.measureInWindow((x, y, width, height) => {
                          scrollViewRef.current?.scrollTo({ y: y - 150, animated: true });
                        });
                      }, 100);
                    }}
                    onSubmitEditing={commitNewLicense}
                    {...resolveTextInputKeyboardProps()}
                  />
                  <TouchableOpacity
                    onPress={commitNewLicense}
                    disabled={!newLicenseText.trim()}
                    style={[styles.addLicenseSubmit, {
                      backgroundColor: newLicenseText.trim()
                        ? theme.accent
                        : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      borderColor: theme.border,
                    }]}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name='add'
                      size={18}
                      color={newLicenseText.trim() ? '#050B13' : theme.subtext}
                    />
                    <Text style={[styles.addLicenseSubmitText, {
                      color: newLicenseText.trim() ? '#050B13' : theme.subtext,
                    }]}>
                      Add license
                    </Text>
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
      rightComponent?: React.ReactNode,
      subtext?: string
    ) => {
      const matchesSearch =
        filterSettings(text) || (subtext ? filterSettings(subtext) : false);
      if (!matchesSearch) return null;

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
            {subtext ? (
              <View
                style={[
                  { flex: 1, minWidth: 0 },
                  Platform.OS !== 'web' ? { maxWidth: '70%' } : null,
                ]}
              >
                <Text style={[styles.settingText, { color: theme.text }]}>{text}</Text>
                <Text
                  style={[styles.settingSubtext, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}
                >
                  {subtext}
                </Text>
              </View>
            ) : (
              <Text style={[styles.settingText, { color: theme.text }]}>{text}</Text>
            )}
          </View>
          {rightComponent ||
            (showChevron &&
              (Platform.OS === 'web' ? (
                <MaterialIcons name='chevron-right' size={20} color={theme.subtext} style={{ opacity: darkMode ? 1 : 0.7 }} />
              ) : (
                <View style={styles.settingTrailSlot}>
                  <MaterialIcons name='chevron-right' size={20} color={theme.subtext} style={{ opacity: darkMode ? 1 : 0.7 }} />
                </View>
              )))}
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
      
      if (!hasMatches) return null;
      
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
      <View style={styles.settingsTabWrap}>
        {/* Account & Security - Top Priority */}
        {renderSection('Account & Security', (
          <>
            {renderSettingItem('change-password', 'lock', 'Change Password', () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleChangePassword();
            })}
          </>
        ), true)}

        {/* Preferences */}
        {renderSection('Preferences', (
          <>
            {filterSettings('Push Notifications') && (
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
                    <MaterialIcons name='notifications' size={20} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, maxWidth: Platform.OS !== 'web' ? '62%' : undefined }}>
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
          </>
        ))}

        {/* Business */}
        {renderSection('Business', (
          <>
            {canViewTaxCenter &&
              renderSettingItem('tax-center', 'request-quote', 'Tax Center', () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/tax-center');
            })}
            {renderSettingItem(
              'payment-methods',
              'payment',
              'Payment Methods',
              () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handlePaymentMethods();
              },
              true,
              undefined,
              'Payouts & client payments'
            )}
          </>
        ))}

        {/* Estimating — pricing library learn + Step 2 saved-rate suggestions */}
        <View style={styles.settingsGroupContainer}>
            <Text
              style={[
                styles.settingsGroupTitle,
                { color: theme.subtext, opacity: darkMode ? 1 : 0.85 },
              ]}
            >
              ESTIMATING & PRICING
            </Text>
            <View
              style={[
                styles.settingsGroup,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <ContractorPricingMemorySettings compact />
              </View>
            </View>
          </View>

        {/* App & Data */}
        {renderSection('App & Data', (
          <>
            {renderSettingItem(
              'restart-setup',
              'refresh',
              'Restart setup guide',
              () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert(
                  'Restart setup guide?',
                  'This will show the onboarding flow again and clear current estimate data on this device. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Restart',
                      onPress: async () => {
                        try {
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
                          await AsyncStorage.removeItem('bps.currentBid.v2');
                          await AsyncStorage.removeItem('bps.currentBid');
                          await AsyncStorage.removeItem('bps.currentBid.v1');
                          await AsyncStorage.removeItem('bps.firstEstimateCreated');
                          await AsyncStorage.removeItem('bps.firstEstimateSubmitted');
                          await AsyncStorage.removeItem(FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY);
                          await AsyncStorage.removeItem(FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY);
                          await resetActiveProjectWalkthroughStorage();
                          router.push('/onboarding');
                        } catch (error) {
                          console.error('Error restarting setup guide:', error);
                          Alert.alert('Error', 'Failed to restart setup guide.');
                        }
                      },
                    },
                  ]
                );
              },
              true,
              undefined,
              'Replay onboarding and estimate walkthrough'
            )}
          </>
        ))}

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
                router.push('/profile/beta-feedback');
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

      </View>
    );
  };

  return (
    <>
      <View style={[styles.container, { backgroundColor: Colors.bg }]}>
      {/* Header with Back Button and Title */}
      <View style={[styles.headerRow, webProfileHeaderMargins]}>
        <View style={styles.backButtonWrapper}>
          <View style={styles.backButtonBorder}>
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
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>Profile</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabScrollBottomInset + 32 },
          Platform.OS === 'web' && { paddingHorizontal: 0, paddingTop: 0 },
          webScrollContentCap,
        ]}
        showsVerticalScrollIndicator={true}
      >
        <WebPageShell size="profile" scroll={false} contentStyle={{ paddingBottom: 0 }}>
        <View style={styles.profileShellBleed}>
        <View style={styles.contentCard}>
          <View style={styles.content}>
        {/* Tab Navigation */}
        <View style={styles.wideContainer}>
          <View
            style={[
              styles.segmentContainer,
              { backgroundColor: theme.card, borderColor: theme.border },
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
        </View>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'settings' && renderSettingsTab()}
        
        {/* Close the profile content card after the active tab content. */}
        </View>
      </View>

      {/* Footer - Outside Gradient Border, directly below it */}
      {activeTab === 'overview' && (
        <View style={styles.settingsFooter}>
          <Text style={[styles.footerBrandText, { color: theme.subtext, opacity: darkMode ? 0.7 : 0.65 }]}>
            © 2026 Build Profit Solutions
          </Text>
        </View>
      )}
      {activeTab === 'settings' && (
        <View style={styles.settingsFooter}>
          <Text style={[styles.footerBrandText, { color: theme.subtext, opacity: darkMode ? 0.7 : 0.65 }]}>
            © 2026 Build Profit Solutions
          </Text>
        </View>
      )}
        </View>
        </WebPageShell>
      </ScrollView>

      {/* Preview Public Profile Modal */}
      <Modal
        visible={previewModalVisible}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {
            backgroundColor: darkMode ? '#1a1a1a' : '#f5f5f5',
            borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            maxHeight: '85%',
          }]}>
            <View style={[styles.modalHeader, {
              borderBottomColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }]}>
              <Text style={[styles.modalTitle, { color: darkMode ? '#ffffff' : '#000000' }]}>
                Customer View
              </Text>
              <TouchableOpacity onPress={() => setPreviewModalVisible(false)}>
                <MaterialIcons name='close' size={24} color={darkMode ? '#ffffff' : '#000000'} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.previewModalHint, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                This is what homeowners see when you are matched with a lead.
              </Text>
              <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <Image
                    source={getProfileAvatarImageSource(user.avatar)}
                    style={[styles.previewAvatar, !profileHasCustomAvatar(user.avatar) && styles.profileImageDefaultLogo]}
                    defaultSource={DEFAULT_PROFILE_AVATAR_SOURCE}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewCompanyName, { color: theme.text }]}>{displayCompany}</Text>
                    <Text style={[styles.previewRole, { color: theme.subtext }]}>{displayRole}</Text>
                    {displayLocation ? (
                      <Text style={[styles.previewLocation, { color: theme.subtext }]}>{displayLocation}</Text>
                    ) : null}
                  </View>
                </View>
                {trustBadges.length > 0 && (
                  <View style={[styles.trustMicroRow, { marginTop: 0, marginBottom: 12 }]}>
                    {trustBadges.map((badge) => (
                      <View key={badge.label} style={styles.trustBadge}>
                        <MaterialIcons name={badge.icon} size={14} color='#22c55e' />
                        <Text style={styles.trustBadgeText}>{badge.label}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {user.companyBio?.trim() ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.previewSectionLabel, { color: theme.subtext }]}>About</Text>
                    <Text style={[styles.previewBodyText, { color: theme.text }]}>{user.companyBio}</Text>
                  </View>
                ) : null}
                {user.projectPortfolio && user.projectPortfolio.length > 0 ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.previewSectionLabel, { color: theme.subtext }]}>Recent Work</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      {user.projectPortfolio.slice(0, 4).map((item, index) => (
                        <Image
                          key={item.id || index}
                          source={{ uri: item.uri }}
                          style={styles.previewPortfolioThumb}
                          resizeMode='cover'
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                {hasLicenseOnFile ? (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.previewSectionLabel, { color: theme.subtext }]}>License</Text>
                    {user.licenses.map((license, i) => (
                      <Text key={i} style={[styles.previewBodyText, { color: theme.text }]}>{license}</Text>
                    ))}
                  </View>
                ) : null}
                {hasInsurance ? (
                  <View>
                    <Text style={[styles.previewSectionLabel, { color: theme.subtext }]}>Insurance</Text>
                    {Object.entries(user.insurance)
                      .filter(([, covered]) => covered)
                      .map(([type]) => (
                        <Text key={type} style={[styles.previewBodyText, { color: theme.text }]}>
                          {type.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                        </Text>
                      ))}
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModal}
        animationType='slide'
        transparent={true}
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.modalContentWebEditProfile, {
            backgroundColor: theme.card,
            borderColor: theme.border,
          }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {t('profile.editProfile')}
              </Text>
              <TouchableOpacity onPress={handleCancelEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name='close' size={22} color={theme.subtext} />
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
                contentContainerStyle={styles.editModalScrollContent}
                showsVerticalScrollIndicator={true}
                {...FORM_KEYBOARD_SCROLL_PROPS}
              >
                <TouchableOpacity
                  style={styles.editModalLogoSection}
                  onPress={handleImageUpload}
                  activeOpacity={0.8}
                >
                  <View style={styles.editModalLogoWrap}>
                    <Image
                      source={getProfileAvatarImageSource(user.avatar)}
                      style={[
                        styles.editModalLogoImage,
                        !profileHasCustomAvatar(user.avatar) && styles.profileImageDefaultLogo,
                      ]}
                      defaultSource={DEFAULT_PROFILE_AVATAR_SOURCE}
                      resizeMode="contain"
                    />
                    <View style={styles.editModalLogoBadge}>
                      <MaterialIcons name='photo-camera' size={14} color='#fff' />
                    </View>
                  </View>
                  <Text style={[styles.editModalLogoTitle, { color: theme.text }]}>
                    {displayCompany}
                  </Text>
                  <Text style={[styles.editModalLogoHint, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                    Tap to change company logo
                  </Text>
                </TouchableOpacity>

                <View style={[styles.editModalGroupedCard, { backgroundColor: theme.cardInset, borderColor: theme.border }]}>
                  <View style={styles.editModalFieldRow}>
                    <Text style={[styles.editModalFieldLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>First name</Text>
                    <TextInput
                      style={editFieldInputStyle('firstName', editForm.firstName)}
                      value={editForm.firstName}
                      onChangeText={(text) => setEditForm((prev) => ({ ...prev, firstName: text }))}
                      placeholder='Your first name'
                      placeholderTextColor={theme.fieldPlaceholder}
                      autoCapitalize='words'
                      {...editFieldFocusHandlers('firstName')}
                      {...resolveTextInputKeyboardProps()}
                    />
                  </View>
                  <View style={[styles.editModalDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.editModalFieldRow}>
                    <Text style={[styles.editModalFieldLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>Last name</Text>
                    <TextInput
                      style={editFieldInputStyle('lastName', editForm.lastName)}
                      value={editForm.lastName}
                      onChangeText={(text) => setEditForm((prev) => ({ ...prev, lastName: text }))}
                      placeholder='Your last name'
                      placeholderTextColor={theme.fieldPlaceholder}
                      autoCapitalize='words'
                      {...editFieldFocusHandlers('lastName')}
                      {...resolveTextInputKeyboardProps()}
                    />
                  </View>
                  <View style={[styles.editModalDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.editModalFieldRow}>
                    <Text style={[styles.editModalFieldLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>Email</Text>
                    <TextInput
                      style={editFieldInputStyle('email', editForm.email)}
                      value={editForm.email}
                      onChangeText={(text) => setEditForm((prev) => ({ ...prev, email: text }))}
                      placeholder='you@company.com'
                      placeholderTextColor={theme.fieldPlaceholder}
                      keyboardType='email-address'
                      autoCapitalize='none'
                      autoCorrect={false}
                      {...editFieldFocusHandlers('email')}
                      {...resolveTextInputKeyboardProps({ keyboardType: 'email-address' })}
                    />
                  </View>
                  <View style={[styles.editModalDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.editModalFieldRow}>
                    <Text style={[styles.editModalFieldLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>Phone</Text>
                    <TextInput
                      style={editFieldInputStyle('phone', editForm.phone)}
                      value={editForm.phone}
                      onChangeText={(text) => {
                        const formatted = formatPhoneNumber(text);
                        setEditForm((prev) => ({ ...prev, phone: formatted }));
                      }}
                      placeholder='(555) 123-4567'
                      placeholderTextColor={theme.fieldPlaceholder}
                      keyboardType='numeric'
                      onSubmitEditing={() => Keyboard.dismiss()}
                      maxLength={14}
                      {...editFieldFocusHandlers('phone')}
                      {...nativeNumericKeyboardProps}
                    />
                  </View>
                </View>

                <View style={[styles.editModalGroupedCard, { backgroundColor: theme.cardInset, borderColor: theme.border, marginTop: 12 }]}>
                  <View style={styles.editModalFieldRow}>
                    <Text style={[styles.editModalFieldLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>Company</Text>
                    <TextInput
                      style={editFieldInputStyle('company', editForm.company)}
                      value={editForm.company}
                      onChangeText={(text) => setEditForm((prev) => ({ ...prev, company: text }))}
                      placeholder='Your company name'
                      placeholderTextColor={theme.fieldPlaceholder}
                      autoCapitalize='words'
                      {...editFieldFocusHandlers('company')}
                      {...resolveTextInputKeyboardProps()}
                    />
                  </View>
                  <View style={[styles.editModalDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.editModalFieldRow}>
                    <Text style={[styles.editModalFieldLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>Trade / role</Text>
                    <TextInput
                      style={editFieldInputStyle('role', editForm.role)}
                      value={editForm.role}
                      onChangeText={(text) => setEditForm((prev) => ({ ...prev, role: text }))}
                      placeholder='General Contractor'
                      placeholderTextColor={theme.fieldPlaceholder}
                      autoCapitalize='words'
                      {...editFieldFocusHandlers('role')}
                      {...resolveTextInputKeyboardProps()}
                    />
                  </View>
                  <View style={[styles.editModalDivider, { backgroundColor: theme.border }]} />
                  <View
                    ref={locationSectionRef}
                    style={styles.editModalFieldRow}
                    onLayout={(event) => {
                      const { y } = event.nativeEvent.layout;
                      (locationSectionRef.current as any)._layoutY = y;
                    }}
                  >
                    <Text style={[styles.editModalFieldLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>Service area</Text>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                      <View style={{ flex: 2 }}>
                        <Text style={[styles.editModalSubLabel, { color: theme.subtext, opacity: darkMode ? 0.7 : 0.65 }]}>City</Text>
                        <TextInput
                          ref={cityInputRef}
                          style={editFieldInputStyle('city', editForm.city)}
                          value={editForm.city}
                          onChangeText={(text) => setEditForm((prev) => ({ ...prev, city: text }))}
                          placeholder='City'
                          placeholderTextColor={theme.fieldPlaceholder}
                          autoCapitalize='words'
                          {...editFieldFocusHandlers('city')}
                          {...resolveTextInputKeyboardProps()}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.editModalSubLabel, { color: theme.subtext, opacity: darkMode ? 0.7 : 0.65 }]}>State</Text>
                        <TextInput
                          ref={stateInputRef}
                          style={editFieldInputStyle('state', editForm.state)}
                          value={editForm.state}
                          onChangeText={(text) =>
                            setEditForm((prev) => ({ ...prev, state: text.toUpperCase() }))
                          }
                          placeholder='ST'
                          placeholderTextColor={theme.fieldPlaceholder}
                          autoCapitalize='characters'
                          maxLength={2}
                          {...editFieldFocusHandlers('state')}
                          {...resolveTextInputKeyboardProps()}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View style={[styles.editModalFooter, { borderTopColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.editModalSaveButton, { backgroundColor: theme.accent }]}
                  onPress={handleSaveProfile}
                  activeOpacity={0.85}
                >
                  <Text style={styles.editModalSaveButtonText}>Save changes</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModal}
        animationType='fade'
        transparent={true}
        onRequestClose={closePasswordModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.passwordModalKeyboardWrap}
          >
            <TouchableOpacity
              style={styles.passwordModalDismissArea}
              activeOpacity={1}
              onPress={closePasswordModal}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={[
                  styles.modalContent,
                  styles.modalContentPassword,
                  Platform.OS === 'web' ? styles.modalContentWebEditProfile : null,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={[styles.modalHeader, styles.passwordModalHeader, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>
                  <TouchableOpacity
                    onPress={closePasswordModal}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name='close' size={22} color={theme.subtext} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  contentContainerStyle={styles.passwordModalScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps='handled'
                  {...FORM_KEYBOARD_SCROLL_PROPS}
                >
                  <Text style={[styles.passwordModalHint, { color: theme.subtext, opacity: darkMode ? 0.9 : 0.85 }]}>
                    Enter your current password, then choose a new one.
                  </Text>

                  <View style={[styles.editModalGroupedCard, { backgroundColor: theme.cardInset, borderColor: theme.border }]}>
                    <View style={styles.passwordModalFieldRow}>
                      <Text style={[styles.editModalFieldLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                        Current password
                      </Text>
                      <View style={styles.passwordFieldRow}>
                        <TextInput
                          ref={currentPasswordRef}
                          style={passwordFieldInputStyle('current', currentPassword)}
                          placeholder='Enter current password'
                          placeholderTextColor={theme.fieldPlaceholder}
                          secureTextEntry={!showCurrentPassword}
                          value={currentPassword}
                          onChangeText={setCurrentPassword}
                          editable={!passwordLoading}
                          autoCapitalize='none'
                          autoCorrect={false}
                          textContentType='password'
                          onSubmitEditing={() => newPasswordRef.current?.focus()}
                          {...passwordFieldFocusHandlers('current')}
                          {...resolveTextInputKeyboardProps({ secureTextEntry: true })}
                        />
                        <TouchableOpacity
                          style={styles.passwordEyeButton}
                          onPress={() => setShowCurrentPassword((prev) => !prev)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <MaterialIcons
                            name={showCurrentPassword ? 'visibility' : 'visibility-off'}
                            size={20}
                            color={theme.subtext}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={[styles.editModalDivider, { backgroundColor: theme.border }]} />

                    <View style={styles.passwordModalFieldRow}>
                      <Text style={[styles.editModalFieldLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                        New password
                      </Text>
                      <View style={styles.passwordFieldRow}>
                        <TextInput
                          ref={newPasswordRef}
                          style={passwordFieldInputStyle('new', newPassword)}
                          placeholder='Enter new password'
                          placeholderTextColor={theme.fieldPlaceholder}
                          secureTextEntry={!showNewPassword}
                          value={newPassword}
                          onChangeText={setNewPassword}
                          editable={!passwordLoading}
                          autoCapitalize='none'
                          autoCorrect={false}
                          textContentType='newPassword'
                          onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                          {...passwordFieldFocusHandlers('new')}
                          {...resolveTextInputKeyboardProps({ secureTextEntry: true })}
                        />
                        <TouchableOpacity
                          style={styles.passwordEyeButton}
                          onPress={() => setShowNewPassword((prev) => !prev)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <MaterialIcons
                            name={showNewPassword ? 'visibility' : 'visibility-off'}
                            size={20}
                            color={theme.subtext}
                          />
                        </TouchableOpacity>
                      </View>
                      <Text
                        style={[
                          styles.passwordValidationHint,
                          {
                            color: passwordMeetsLength
                              ? theme.success
                              : theme.subtext,
                            opacity: passwordMeetsLength ? 1 : darkMode ? 0.75 : 0.85,
                          },
                        ]}
                      >
                        {passwordMeetsLength ? '✓ At least 8 characters' : 'Must be at least 8 characters'}
                      </Text>
                      {trimmedNewPassword.length > 0 && !passwordIsDifferent && (
                        <Text style={[styles.passwordValidationHint, { color: theme.error }]}>
                          Must be different from current password
                        </Text>
                      )}
                    </View>

                    <View style={[styles.editModalDivider, { backgroundColor: theme.border }]} />

                    <View style={styles.passwordModalFieldRow}>
                      <Text style={[styles.editModalFieldLabel, { color: theme.subtext, opacity: darkMode ? 1 : 0.85 }]}>
                        Confirm new password
                      </Text>
                      <View style={styles.passwordFieldRow}>
                        <TextInput
                          ref={confirmPasswordRef}
                          style={passwordFieldInputStyle('confirm', confirmPassword)}
                          placeholder='Confirm new password'
                          placeholderTextColor={theme.fieldPlaceholder}
                          secureTextEntry={!showConfirmPassword}
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          editable={!passwordLoading}
                          autoCapitalize='none'
                          autoCorrect={false}
                          textContentType='newPassword'
                          onSubmitEditing={() => {
                            if (passwordFormValid && !passwordLoading) {
                              void handleUpdatePassword();
                            }
                          }}
                          {...passwordFieldFocusHandlers('confirm')}
                          {...resolveTextInputKeyboardProps({ secureTextEntry: true })}
                        />
                        <TouchableOpacity
                          style={styles.passwordEyeButton}
                          onPress={() => setShowConfirmPassword((prev) => !prev)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <MaterialIcons
                            name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                            size={20}
                            color={theme.subtext}
                          />
                        </TouchableOpacity>
                      </View>
                      {trimmedConfirmPassword.length > 0 && (
                        <Text
                          style={[
                            styles.passwordValidationHint,
                            { color: passwordsMatch ? theme.success : theme.error },
                          ]}
                        >
                          {passwordsMatch ? '✓ Passwords match' : 'Passwords do not match'}
                        </Text>
                      )}
                    </View>
                  </View>
                </ScrollView>

                <View style={[styles.passwordModalFooter, { borderTopColor: theme.border }]}>
                  <TouchableOpacity
                    style={[
                      styles.editModalSaveButton,
                      { backgroundColor: theme.accent },
                      (!passwordFormValid || passwordLoading) && { opacity: 0.45 },
                    ]}
                    onPress={handleUpdatePassword}
                    disabled={!passwordFormValid || passwordLoading}
                    activeOpacity={0.85}
                  >
                    {passwordLoading ? (
                      <ActivityIndicator color={Colors.onPrimary} />
                    ) : (
                      <Text style={[styles.editModalSaveButtonText, { color: Colors.onPrimary }]}>
                        Update Password
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.passwordModalCancelLink}
                    onPress={closePasswordModal}
                    disabled={passwordLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.passwordModalCancelLinkText, { color: theme.subtext }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Notification Preferences Modal */}
      <Modal
        visible={notificationsModal}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setNotificationsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderColor: theme.border }]}>
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
          </View>
        </View>
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

    </View>
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
    marginTop: 52,
    marginBottom: 8,
    backgroundColor: Colors.bg,
    zIndex: 2,
    elevation: 2,
    // Web: horizontal inset comes from `webProfileHeaderMargins` (aligned with WebPageShell).
    ...(Platform.OS === 'web' ? {} : { marginHorizontal: edge }),
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
    fontSize: 28,
    fontWeight: "700",
    color: darkMode ? "#f9fafb" : "#000000",
    letterSpacing: -0.3,
  },
  backButtonBorder: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface2,
    overflow: "hidden",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: Colors.surface2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    overflow: 'visible',
  },
  content: {
    paddingHorizontal: 0,
    paddingVertical: 16,
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
  },
  segmentInner: {
    flexDirection: 'row',
    padding: 4,
  },
  segmentTab: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: Colors.card,
  },
  segmentTabActive: {
    backgroundColor: Colors.primary,
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
  settingsTabWrap: {
    width: '100%',
    alignSelf: 'stretch',
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
    /** User-uploaded photos: light backing if the image has transparency. */
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  profileImageDefaultLogo: {
    backgroundColor: '#000000',
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
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
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
    shadowColor: '#000000',
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
  contactDetails: {
    marginBottom: 4,
  },
  contactLabeledRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
  },
  contactLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '500',
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
  addLicenseCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  addLicenseLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  addLicenseHint: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
  },
  addLicenseInput: {
    fontSize: 15,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    fontWeight: '500',
  },
  addLicenseSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  addLicenseSubmitText: {
    fontSize: 14,
    fontWeight: '600',
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
    ...(Platform.OS === 'web'
      ? { outlineStyle: 'none' as const, outlineWidth: 0 }
      : {}),
  },
  bioText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
  emptyBioContainer: {
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  emptyBioIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyBioTitle: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 12,
  },
  addBioButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  addBioButtonTextCompact: {
    fontSize: 14,
    fontWeight: '600',
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
    marginTop: 2,
    opacity: 0.7,
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
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 0,
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
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 4,
  },
  emptyPortfolioSubtitle: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  addPortfolioButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    alignSelf: 'stretch',
  },
  addPortfolioButtonTextCompact: {
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: 16,
    width: '100%',
    alignSelf: 'stretch',
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
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
    alignSelf: 'stretch',
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
  settingSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  switchWrapper: {
    marginTop: 6,
    marginRight: 0,
    flexShrink: 0,
  },
  /** Native: keeps chevrons from drifting past padded edge when the label column uses flex. */
  settingTrailSlot: {
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 12,
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
    fontSize: 13,
    marginTop: 10,
    fontWeight: '500',
  },
  profileCompletionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  profileCompletionCtaText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewProfileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  previewProfileLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewModalHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  previewCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  previewAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#43cea2',
    backgroundColor: '#000',
  },
  previewCompanyName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  previewRole: {
    fontSize: 14,
    marginBottom: 2,
  },
  previewLocation: {
    fontSize: 13,
  },
  previewSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  previewBodyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  previewPortfolioThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginRight: 8,
  },
  footerBrandText: {
    fontSize: 12,
    textAlign: 'center',
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
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#142850',
    flexDirection: 'column',
    display: 'flex',
  },
  /** Web: Edit Profile form — cap width on large viewports (base modal is 90%). */
  modalContentWebEditProfile: Platform.OS === 'web'
    ? {
        maxWidth: 460,
        alignSelf: 'center',
      }
    : {},
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
  editModalScrollContent: {
    paddingBottom: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  editModalLogoSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 4,
  },
  editModalLogoWrap: {
    position: 'relative',
    marginBottom: 10,
  },
  editModalLogoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#43cea2',
    backgroundColor: '#000',
  },
  editModalLogoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#43cea2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1C1D20',
  },
  editModalLogoTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  editModalLogoHint: {
    fontSize: 13,
  },
  editModalGroupedCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  editModalFieldRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  editModalFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  editModalFieldInput: {
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 2,
    ...(Platform.OS === 'web'
      ? { outlineStyle: 'none' as const, outlineWidth: 0 }
      : {}),
  },
  editModalSubLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  editModalDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 14,
  },
  editModalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  editModalSaveButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#050B13',
    letterSpacing: -0.2,
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
  // Change Password modal
  modalContentPassword: {
    minHeight: 0,
    width: '94%',
    maxHeight: '90%',
    ...(Platform.OS === 'web'
      ? {
          maxWidth: 500,
          width: '100%' as const,
        }
      : {}),
  },
  passwordModalKeyboardWrap: {
    flex: 1,
    width: '100%',
  },
  passwordModalDismissArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 28,
  },
  passwordModalScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  passwordModalHint: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  passwordModalHeader: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  passwordModalFieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  passwordFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  passwordFieldInput: {
    flex: 1,
    paddingRight: 10,
    paddingVertical: 4,
  },
  passwordEyeButton: {
    paddingLeft: 6,
    paddingVertical: 4,
  },
  passwordValidationHint: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
  passwordModalFooter: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  passwordModalCancelLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  passwordModalCancelLinkText: {
    fontSize: 15,
    fontWeight: '500',
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
