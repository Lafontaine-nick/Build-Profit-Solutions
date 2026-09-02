import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { TAX_CENTER_WEB_MAX_CONTENT_WIDTH } from '@/constants/ScreenLayout';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import { FORM_KEYBOARD_SCROLL_PROPS } from '@/constants/keyboardScrollProps';
import { nativeNumericKeyboardProps, resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import TaxGradientFrame from '@/src/components/tax/TaxGradientFrame';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useVendorDirectory } from '@/contexts/VendorDirectoryContext';
import { TAX_CATEGORIES, type TaxCategory } from '@/src/lib/taxCenter';
import { formatUsPhoneDashes } from '@/src/lib/phoneFormat';
import { IRS_FORM_W9_PDF_URL } from '@/constants/irsForms';
import { isReviewableVendorType, type VendorType, type W9Status } from '@/src/lib/vendorTypes';
import { isClerkEnabled } from '@/lib/isClerkEnabled';
import { getDocumentContactEmailAsync } from '@/lib/documentContactEmail';

let useUserHook: (() => { user?: { primaryEmailAddress?: { emailAddress?: string }; emailAddresses?: { emailAddress?: string }[] } | null }) | null =
  null;
try {
  useUserHook = require('@clerk/clerk-react').useUser;
} catch {
  useUserHook = null;
}

const VENDOR_TYPES: VendorType[] = ['subcontractor', 'supplier', 'consultant', 'other'];
const W9_STATUSES: W9Status[] = ['not_applicable', 'missing', 'requested', 'uploaded', 'verified'];

const W9_PILL_LABEL: Record<W9Status, string> = {
  not_applicable: 'N/A',
  missing: 'missing',
  requested: 'requested',
  uploaded: 'uploaded',
  verified: 'verified',
};

export default function TaxVendorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isNew = id === 'new';
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const { vendors, hydrated, addVendor, updateVendor, removeVendor } = useVendorDirectory();

  let clerkUser: { primaryEmailAddress?: { emailAddress?: string }; emailAddresses?: { emailAddress?: string }[] } | null = null;
  if (isClerkEnabled() && useUserHook) {
    try {
      const userHook = useUserHook();
      clerkUser = userHook?.user ?? null;
    } catch {
      clerkUser = null;
    }
  }

  const existing = useMemo(() => vendors.find((v) => v.id === id), [vendors, id]);

  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [vendorType, setVendorType] = useState<VendorType>('supplier');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [vendorState, setVendorState] = useState('');
  const [notes, setNotes] = useState('');
  const [defaultCategory, setDefaultCategory] = useState<TaxCategory | ''>('');
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState('');
  const [w9Status, setW9Status] = useState<W9Status>('not_applicable');
  const [flag1099Review, setFlag1099Review] = useState(false);
  const [contactExpanded, setContactExpanded] = useState(false);

  useEffect(() => {
    if (existing && !isNew) {
      setBusinessName(existing.businessName);
      setLegalName(existing.legalName || '');
      setVendorType(existing.vendorType);
      setEmail(existing.email || '');
      setPhone(formatUsPhoneDashes(existing.phone || ''));
      setAddress(existing.address || '');
      setCity(existing.city || '');
      setVendorState(existing.state || '');
      setNotes(existing.notes || '');
      setDefaultCategory((existing.defaultCategory as TaxCategory) || '');
      setDefaultPaymentMethod(existing.defaultPaymentMethod || '');
      setW9Status(existing.w9Status);
      setFlag1099Review(existing.requires1099Review === true);
      const hasContact =
        !!(
          existing.legalName ||
          existing.email ||
          existing.phone ||
          existing.address ||
          existing.city ||
          existing.state
        );
      if (existing.vendorType === 'supplier' && !existing.requires1099Review && hasContact) {
        setContactExpanded(true);
      }
    }
  }, [existing, isNew]);

  const simpleSupplierProfile = vendorType === 'supplier' && !flag1099Review;
  const fullBookkeepingProfile = isReviewableVendorType(vendorType) || (vendorType === 'supplier' && flag1099Review);

  const primaryButtonLabel = useMemo(() => {
    if (!isNew) return 'Save Changes';
    switch (vendorType) {
      case 'supplier':
        return 'Create Supplier';
      case 'subcontractor':
        return 'Create Subcontractor';
      case 'consultant':
        return 'Create Consultant';
      case 'other':
      default:
        return 'Create Vendor';
    }
  }, [isNew, vendorType]);

  const screenTitle = useMemo(() => {
    if (!isNew) return 'Vendor profile';
    switch (vendorType) {
      case 'supplier':
        return 'Add Supplier';
      case 'subcontractor':
        return 'Add Subcontractor';
      case 'consultant':
        return 'Add Consultant';
      case 'other':
      default:
        return 'Add Vendor';
    }
  }, [isNew, vendorType]);

  const onPhoneChange = (text: string) => {
    setPhone(formatUsPhoneDashes(text));
  };

  const applyFlagChange = (v: boolean) => {
    setFlag1099Review(v);
    if (vendorType === 'supplier') {
      if (!v) setW9Status('not_applicable');
      else setW9Status((s) => (s === 'not_applicable' ? 'missing' : s));
    }
    void Haptics.selectionAsync();
  };

  if (!isNew && hydrated && !existing) {
    return (
      <View style={[styles.screenRoot, { justifyContent: 'center', padding: 24 }]}>
        <StatusBar barStyle="light-content" />
        <Text style={{ color: '#fff', fontSize: 16, marginBottom: 16 }}>Vendor not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.saveBtn}>
          <Text style={styles.saveText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const save = () => {
    const bn = businessName.trim();
    if (!bn) {
      Alert.alert('Vendor', 'Enter a business name.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isNew) {
      addVendor({
        businessName: bn,
        legalName: legalName.trim() || undefined,
        vendorType,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: vendorState.trim() || undefined,
        notes: notes.trim() || undefined,
        w9Status,
        w9FileUri: undefined,
        defaultCategory: defaultCategory || undefined,
        defaultPaymentMethod: defaultPaymentMethod.trim() || undefined,
        requires1099Review: flag1099Review,
      });
      router.replace('/tax-vendors');
      return;
    }
    updateVendor(id, {
      businessName: bn,
      legalName: legalName.trim() || undefined,
      vendorType,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: vendorState.trim() || undefined,
      notes: notes.trim() || undefined,
      w9Status,
      defaultCategory: defaultCategory || undefined,
      defaultPaymentMethod: defaultPaymentMethod.trim() || undefined,
      requires1099Review: flag1099Review,
    });
    Alert.alert('Saved', 'Vendor profile updated.');
  };

  const w9RequestEligibleForStatusBump =
    (isReviewableVendorType(vendorType) || (vendorType === 'supplier' && flag1099Review)) &&
    (w9Status === 'missing' || w9Status === 'not_applicable');

  const persistW9RequestedIfEligible = () => {
    if (!w9RequestEligibleForStatusBump) return;
    if (!isNew) {
      updateVendor(id, { w9Status: 'requested' });
    }
    setW9Status('requested');
  };

  const requestW9 = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const senderEmail = await getDocumentContactEmailAsync(clerkUser);
    const displayName = businessName.trim() || 'Vendor';
    const fromLine =
      senderEmail != null && senderEmail.length > 0
        ? `\n\n—\nFrom (your contractor profile): ${senderEmail}`
        : '';
    const plain =
      `Hi ${displayName}, can you please send your completed Form W-9 for our records? We use this for bookkeeping and year-end reporting. ` +
      `Build Profit Solutions does not determine tax filing requirements or verify tax forms. ` +
      `Please contact your tax professional if you have questions about how to complete the form.\n\n` +
      `Official Form W-9 (IRS PDF): ${IRS_FORM_W9_PDF_URL}\n\n` +
      `Thank you.` +
      fromLine;
    const subject = encodeURIComponent(`Form W-9 request — ${displayName}`);
    const body = encodeURIComponent(plain);
    if (email.trim()) {
      const url = `mailto:${email.trim()}?subject=${subject}&body=${body}`;
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        await Linking.openURL(url);
        persistW9RequestedIfEligible();
        return;
      }
    }
    await Share.share({ message: plain, title: `Form W-9 request — ${displayName}` });
    persistW9RequestedIfEligible();
  };

  const openIrsW9Form = async () => {
    Haptics.selectionAsync();
    try {
      const ok = await Linking.canOpenURL(IRS_FORM_W9_PDF_URL);
      if (ok) {
        await Linking.openURL(IRS_FORM_W9_PDF_URL);
      } else {
        Alert.alert('Form W-9', 'Unable to open the IRS form. Try again or visit irs.gov and search for Form W-9.');
      }
    } catch {
      Alert.alert('Form W-9', 'Unable to open the IRS form.');
    }
  };

  const uploadW9 = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('W-9', 'Photo library access is needed to attach a W-9 image or scan.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const uri = res.assets[0].uri;
      if (!isNew) {
        updateVendor(id, { w9FileUri: uri, w9Status: 'uploaded' });
        setW9Status('uploaded');
        Alert.alert('W-9', 'Image attached for your records. Verify with your CPA or tax professional.');
      } else {
        setW9Status('uploaded');
        Alert.alert('W-9', 'Save the vendor first, then upload again to attach the image to this profile.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('W-9', 'Could not open photo library.');
    }
  };

  const markReceived = () => {
    if (isNew) {
      setW9Status('verified');
      return;
    }
    updateVendor(id, { w9Status: 'verified' });
    setW9Status('verified');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'W-9 verified',
      'Verified means you or your CPA reviewed the W-9 information. Build Profit Solutions does not verify tax forms.'
    );
  };

  const setVendorTypeAndDefaults = (t: VendorType) => {
    setVendorType(t);
    setW9Status((prev) => {
      if (t === 'supplier' && !flag1099Review) return 'not_applicable';
      if (t === 'supplier' && flag1099Review) return prev === 'not_applicable' ? 'missing' : prev;
      if (prev === 'not_applicable') return 'missing';
      return prev;
    });
  };

  const confirmDelete = () => {
    if (isNew) {
      router.back();
      return;
    }
    Alert.alert('Delete vendor', 'Remove this vendor from your directory?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeVendor(id);
          router.back();
        },
      },
    ]);
  };

  const renderCategoryPills = () => (
    <>
      <Text style={styles.label}>Default accounting category (optional)</Text>
      <Text style={styles.fieldHint}>Maps this vendor to a BPS expense bucket for exports.</Text>
      <View style={styles.pills}>
        <Pressable
          onPress={() => setDefaultCategory('')}
          style={[styles.pill, defaultCategory === '' && styles.pillOn]}
        >
          <Text style={[styles.pillText, defaultCategory === '' && styles.pillTextOn]}>None</Text>
        </Pressable>
        {TAX_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setDefaultCategory(c)}
            style={[styles.pill, defaultCategory === c && styles.pillOn]}
          >
            <Text style={[styles.pillText, defaultCategory === c && styles.pillTextOn]} numberOfLines={2}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  const renderPotential1099Section = () => (
    <>
      <Text style={styles.section}>Potential 1099 review</Text>
      <Text style={styles.overrideHint}>
        Use this only when your CPA or bookkeeper wants this vendor reviewed for year-end reporting. Informational
        only. Not tax advice.
      </Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Flag for Potential 1099 Review</Text>
        <Switch
          value={flag1099Review}
          onValueChange={applyFlagChange}
          trackColor={{ false: '#334155', true: 'rgba(45,255,196,0.45)' }}
          thumbColor={flag1099Review ? '#2DFFC4' : '#94a3b8'}
        />
      </View>
    </>
  );

  const renderW9Section = () => (
    <>
      <Text style={styles.section}>W-9 status</Text>
      <Text style={styles.w9Disclaimer}>
        W-9 tracking is mainly for subcontractors, consultants, and vendors your CPA wants reviewed. BPS does not
        verify tax forms or determine filing requirements.
      </Text>
      <Text style={styles.w9AttachHint}>
        You can attach a photo or scan from your library when needed (works in Expo Go and dev clients).
      </Text>
      <View style={styles.pills}>
        {W9_STATUSES.map((s) => (
          <Pressable key={s} onPress={() => setW9Status(s)} style={[styles.pill, w9Status === s && styles.pillOn]}>
            <Text style={[styles.pillText, w9Status === s && styles.pillTextOn]}>{W9_PILL_LABEL[s]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.w9VerifiedNote}>
        Verified means you or your CPA reviewed the W-9 information. Build Profit Solutions does not verify tax forms.
      </Text>
      <View style={styles.actions}>
        <ActionButton icon="email" label="Request W-9" onPress={requestW9} />
        <ActionButton icon="photo-library" label="Upload W-9 (photo)" onPress={uploadW9} />
        <ActionButton icon="check-circle" label="Mark as received (verified)" onPress={markReceived} />
      </View>
      <Pressable
        onPress={openIrsW9Form}
        style={styles.w9IrsLink}
        hitSlop={10}
      >
        <MaterialIcons name="open-in-new" size={18} color="#5eead4" />
        <Text style={styles.w9IrsLinkText}>Open IRS W-9 Form (PDF)</Text>
      </Pressable>
      <Text style={styles.w9RequestHelper}>
        The vendor or subcontractor completes the W-9 and sends it back to you. BPS only tracks the request and
        attachment status.
      </Text>
    </>
  );

  const addressFields = (
    <>
      <Field label="Address" value={address} onChangeText={setAddress} multiline multilineMinHeight={48} />
      <View style={styles.cityStateRow}>
        <View style={[styles.cityStateCol, styles.cityStateColGap]}>
          <Field label="City (optional)" value={city} onChangeText={setCity} placeholder="City" />
        </View>
        <View style={styles.cityStateCol}>
          <Field
            label="State (optional)"
            value={vendorState}
            onChangeText={setVendorState}
            placeholder="State"
            autoCapitalize="words"
          />
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.screenRoot}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <View
          style={[
            styles.pageShell,
            Platform.OS === 'web' && styles.pageShellWeb,
            Platform.OS === 'web' && {
              paddingTop: Math.max(insets.top, 12) + 14,
            },
          ]}
        >
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
                  style={[styles.backButtonInner, { backgroundColor: darkMode ? Colors.card : Colors.bg }]}
                >
                  <MaterialIcons name="arrow-back" size={24} color={darkMode ? '#FFFFFF' : '#000000'} />
                </GradientRingBackInner>
              </LinearGradient>
            </View>
            <View style={styles.headerTitleCluster}>
              <Text style={styles.kicker}>Vendor directory</Text>
              <Text style={styles.screenTitle}>{screenTitle}</Text>
              {isNew ? (
                <Text style={styles.titleHelper}>
                  Add a supplier, subcontractor, consultant, or other vendor you pay for project work.
                </Text>
              ) : null}
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scroll}
            {...FORM_KEYBOARD_SCROLL_PROPS}
          >
            <TaxGradientFrame style={styles.formGradientRing} innerStyle={styles.formFrameInner}>
          <Field label="Business name" value={businessName} onChangeText={setBusinessName} />

          {fullBookkeepingProfile && !simpleSupplierProfile ? (
            <Field label="Legal name (optional)" value={legalName} onChangeText={setLegalName} />
          ) : null}

          <Text style={styles.label}>Vendor type</Text>
          <Text style={styles.vendorTypeNote}>
            Choose the type that best describes this company or person. This affects W-9 tracking, Potential 1099 Review
            flags, and export grouping.
          </Text>
          <View style={styles.pills}>
            {VENDOR_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setVendorTypeAndDefaults(t)}
                style={[styles.pill, vendorType === t && styles.pillOn]}
              >
                <Text style={[styles.pillText, vendorType === t && styles.pillTextOn]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {simpleSupplierProfile ? (
            <Text style={styles.supplierBlurb}>
              Suppliers are usually tracked for expense categorization and reporting. W-9 tracking is typically used for
              subcontractors, consultants, or vendors your CPA wants reviewed.
            </Text>
          ) : null}

          {renderCategoryPills()}

          <Field
            label="Payment method (optional)"
            value={defaultPaymentMethod}
            onChangeText={setDefaultPaymentMethod}
            placeholder="e.g. Check, debit card, ACH"
          />

          {simpleSupplierProfile ? (
            <>
              <Text style={styles.inlineFlagHint}>Optional — only if your CPA asked you to review this supplier.</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Flag for Potential 1099 Review</Text>
                <Switch value={flag1099Review} onValueChange={applyFlagChange} trackColor={{ false: '#334155', true: 'rgba(45,255,196,0.45)' }} thumbColor={flag1099Review ? '#2DFFC4' : '#94a3b8'} />
              </View>
              <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
              <Pressable
                style={styles.expandContactBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setContactExpanded((e) => !e);
                }}
              >
                <MaterialIcons
                  name={contactExpanded ? 'expand-less' : 'expand-more'}
                  size={22}
                  color="#2DFFC4"
                />
                <Text style={styles.expandContactText}>Add contact details</Text>
              </Pressable>
              {contactExpanded ? (
                <>
                  <Field label="Legal name (optional)" value={legalName} onChangeText={setLegalName} />
                  <Field
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Field label="Phone" value={phone} onChangeText={onPhoneChange} keyboardType="phone-pad" />
                  {addressFields}
                </>
              ) : null}
            </>
          ) : (
            <>
              {renderPotential1099Section()}
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field label="Phone" value={phone} onChangeText={onPhoneChange} keyboardType="phone-pad" />
              {addressFields}
              <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
              {renderW9Section()}
            </>
          )}

          <Pressable style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveText}>{primaryButtonLabel}</Text>
          </Pressable>

          {!isNew ? (
            <Pressable style={styles.delBtn} onPress={confirmDelete}>
              <Text style={styles.delText}>Delete vendor</Text>
            </Pressable>
          ) : null}
            </TaxGradientFrame>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  multilineMinHeight,
  keyboardType,
  placeholder,
  autoCapitalize,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  /** When multiline, default 72 (notes); use lower values for compact fields like address. */
  multilineMinHeight?: number;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
}) {
  const minH = multiline ? multilineMinHeight ?? 72 : undefined;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(148,163,184,0.6)"
        style={[styles.input, multiline && { minHeight: minH, textAlignVertical: 'top' }]}
        multiline={!!multiline}
        keyboardType={keyboardType || 'default'}
        {...(autoCapitalize != null ? { autoCapitalize } : {})}
        maxLength={maxLength}
        {...((keyboardType === 'phone-pad'
          ? nativeNumericKeyboardProps
          : resolveTextInputKeyboardProps({ multiline: !!multiline, keyboardType })) as object)}
      />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <MaterialIcons name={icon} size={20} color="#2DFFC4" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: '#000000' },
  safeArea: { flex: 1, backgroundColor: '#000000' },
  pageShell: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 8,
    minHeight: 0,
  },
  pageShellWeb: {
    maxWidth: TAX_CENTER_WEB_MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 14,
    gap: 10,
  },
  backButtonWrapper: {},
  backButtonBorder: { width: 42, height: 42, borderRadius: 20, padding: 1, overflow: 'hidden' },
  backButtonInner: { width: 40, height: 40, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitleCluster: { flex: 1, minWidth: 0 },
  kicker: {
    color: '#2DFFC4',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  titleHelper: {
    color: 'rgba(203, 213, 225, 0.88)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    fontWeight: '500',
  },
  formGradientRing: {
    marginBottom: 0,
  },
  formFrameInner: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
  },
  scroll: { paddingBottom: 48 },
  label: { color: 'rgba(148, 163, 184, 0.95)', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  section: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 8, marginBottom: 6 },
  overrideHint: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    paddingVertical: 4,
  },
  switchLabel: { color: '#e2e8f0', fontSize: 14, fontWeight: '700', flex: 1 },
  vendorTypeNote: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
    marginTop: -2,
  },
  supplierBlurb: {
    color: 'rgba(203, 213, 225, 0.9)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
    paddingVertical: 4,
  },
  inlineFlagHint: {
    color: 'rgba(148, 163, 184, 0.88)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  expandContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  expandContactText: { color: '#2DFFC4', fontSize: 14, fontWeight: '800' },
  cityStateRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cityStateCol: { flex: 1, minWidth: 0 },
  cityStateColGap: { marginRight: 10 },
  fieldHint: {
    color: 'rgba(148, 163, 184, 0.88)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  w9AttachHint: {
    color: 'rgba(148, 163, 184, 0.88)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  w9Disclaimer: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  w9VerifiedNote: {
    color: 'rgba(148, 163, 184, 0.88)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
    marginTop: 4,
  },
  w9IrsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 6,
  },
  w9IrsLinkText: {
    color: '#5eead4',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(94, 234, 212, 0.5)',
  },
  w9RequestHelper: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillOn: { borderColor: '#2DFFC4', backgroundColor: 'rgba(45, 255, 196, 0.12)' },
  pillText: { color: 'rgba(203,213,225,0.9)', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  pillTextOn: { color: '#FFFFFF' },
  actions: { gap: 10, marginBottom: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  saveBtn: {
    backgroundColor: 'rgba(45, 255, 196, 0.2)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.35)',
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  delBtn: { marginTop: 20, alignItems: 'center', padding: 12 },
  delText: { color: '#FCA5A5', fontSize: 14, fontWeight: '700' },
});
