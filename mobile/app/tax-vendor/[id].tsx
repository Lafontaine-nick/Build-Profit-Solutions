import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useVendorDirectory } from '@/contexts/VendorDirectoryContext';
import type { VendorType, W9Status } from '@/src/lib/vendorTypes';

const VENDOR_TYPES: VendorType[] = ['subcontractor', 'supplier', 'consultant', 'other'];
const W9_STATUSES: W9Status[] = ['missing', 'requested', 'uploaded', 'verified'];

export default function TaxVendorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const { vendors, hydrated, addVendor, updateVendor, removeVendor } = useVendorDirectory();

  const existing = useMemo(() => vendors.find((v) => v.id === id), [vendors, id]);

  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [vendorType, setVendorType] = useState<VendorType>('subcontractor');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [w9Status, setW9Status] = useState<W9Status>('missing');
  const [flag1099Review, setFlag1099Review] = useState(false);

  useEffect(() => {
    if (existing && !isNew) {
      setBusinessName(existing.businessName);
      setLegalName(existing.legalName || '');
      setVendorType(existing.vendorType);
      setEmail(existing.email || '');
      setPhone(existing.phone || '');
      setAddress(existing.address || '');
      setNotes(existing.notes || '');
      setW9Status(existing.w9Status);
      setFlag1099Review(existing.requires1099Review === true);
    }
  }, [existing, isNew]);

  if (!isNew && hydrated && !existing) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', padding: 24 }]}>
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
      const v = addVendor({
        businessName: bn,
        legalName: legalName.trim() || undefined,
        vendorType,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        w9Status,
        w9FileUri: undefined,
        defaultCategory: undefined,
        requires1099Review: flag1099Review,
      });
      router.replace(`/tax-vendor/${v.id}`);
      return;
    }
    updateVendor(id, {
      businessName: bn,
      legalName: legalName.trim() || undefined,
      vendorType,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      w9Status,
      requires1099Review: flag1099Review,
    });
    Alert.alert('Saved', 'Vendor profile updated.');
  };

  const requestW9 = async () => {
    const subject = encodeURIComponent(`W-9 request — ${businessName.trim() || 'Vendor'}`);
    const body = encodeURIComponent(
      'Hello,\n\nPlease send your completed IRS Form W-9 for our records.\n\nThank you.'
    );
    if (email.trim()) {
      const url = `mailto:${email.trim()}?subject=${subject}&body=${body}`;
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        await Linking.openURL(url);
        updateVendor(id, { w9Status: 'requested' });
        setW9Status('requested');
        return;
      }
    }
    await Share.share({
      message: `Please send your completed IRS Form W-9 for ${businessName.trim() || 'our vendor records'}.`,
    });
    if (!isNew) {
      updateVendor(id, { w9Status: 'requested' });
      setW9Status('requested');
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
      setW9Status('uploaded');
      return;
    }
    updateVendor(id, { w9Status: 'uploaded' });
    setW9Status('uploaded');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <View style={styles.backWrap}>
            <LinearGradient
              colors={['rgba(45, 255, 196, 0.8)', 'rgba(0, 166, 255, 0.8)']}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.backBorder}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
                style={[styles.backInner, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="arrow-back" size={24} color={darkMode ? '#FFFFFF' : '#000000'} />
              </TouchableOpacity>
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{isNew ? 'Add Vendor' : 'Vendor profile'}</Text>
            {isNew ? (
              <Text style={styles.titleHelper}>
                Add subcontractors, suppliers, consultants, or other vendors you pay for project work.
              </Text>
            ) : null}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Field label="Business name" value={businessName} onChangeText={setBusinessName} />
          <Field label="Legal name (optional)" value={legalName} onChangeText={setLegalName} />
          <Text style={styles.label}>Vendor type</Text>
          <View style={styles.pills}>
            {VENDOR_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setVendorType(t)}
                style={[styles.pill, vendorType === t && styles.pillOn]}
              >
                <Text style={[styles.pillText, vendorType === t && styles.pillTextOn]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>Potential 1099 review</Text>
          <Text style={styles.overrideHint}>
            Suppliers are not flagged for 1099 review by default. Turn this on only when your CPA expects review for
            this vendor (e.g. certain supplier payments). Informational only. Not tax advice.
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Flag for Potential 1099 review</Text>
            <Switch
              value={flag1099Review}
              onValueChange={setFlag1099Review}
              trackColor={{ false: '#334155', true: 'rgba(45,255,196,0.45)' }}
              thumbColor={flag1099Review ? '#2DFFC4' : '#94a3b8'}
            />
          </View>

          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Address" value={address} onChangeText={setAddress} multiline />
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline />

          <Text style={styles.section}>W-9 status</Text>
          <Text style={styles.w9Disclaimer}>
            W-9 tracking is for bookkeeping support only. Informational only. Not tax advice. Verify vendor
            information and filing requirements with your CPA or tax professional. Attach a photo or scan from your
            library (works in Expo Go and dev clients).
          </Text>
          <View style={styles.pills}>
            {W9_STATUSES.map((s) => (
              <Pressable key={s} onPress={() => setW9Status(s)} style={[styles.pill, w9Status === s && styles.pillOn]}>
                <Text style={[styles.pillText, w9Status === s && styles.pillTextOn]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.actions}>
            <ActionButton icon="email" label="Request W-9" onPress={requestW9} />
            <ActionButton icon="photo-library" label="Upload W-9 (photo)" onPress={uploadW9} />
            <ActionButton icon="check-circle" label="Mark as received" onPress={markReceived} />
          </View>

          <Pressable style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveText}>{isNew ? 'Create vendor' : 'Save changes'}</Text>
          </Pressable>

          {!isNew ? (
            <Pressable style={styles.delBtn} onPress={confirmDelete}>
              <Text style={styles.delText}>Delete vendor</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="rgba(148,163,184,0.6)"
        style={[styles.input, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        multiline={!!multiline}
        keyboardType={keyboardType || 'default'}
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
  screen: { flex: 1, backgroundColor: '#000000' },
  safe: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 8, gap: 12 },
  backWrap: { width: 42 },
  backBorder: { width: 42, height: 42, borderRadius: 20, padding: 1, overflow: 'hidden' },
  backInner: { width: 40, height: 40, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  titleHelper: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    fontWeight: '600',
  },
  scroll: { padding: 16, paddingBottom: 48 },
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
  w9Disclaimer: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
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
  actions: { gap: 10, marginBottom: 20 },
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
