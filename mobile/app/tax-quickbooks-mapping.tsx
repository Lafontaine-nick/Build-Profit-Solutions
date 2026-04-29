import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useVendorDirectory } from '@/contexts/VendorDirectoryContext';
import { TAX_CATEGORIES, type TaxCategory } from '@/src/lib/taxCenter';

/** Example-only labels for bookkeeping / CPA handoff — not a live QuickBooks link. */
const SUGGESTED_ACCOUNTING_MAP: Partial<Record<TaxCategory, string>> = {
  Materials: 'Job Materials',
  Labor: 'Labor',
  Subcontractors: 'Contract Labor',
  'Equipment Rental': 'Equipment Rental',
  'Permits / Plans': 'Permits & Fees',
  Insurance: 'Insurance',
  'Vehicle / Mileage': 'Auto Expense',
  'Software / Tools': 'Software',
  'Office / Admin': 'Office Expense',
  Other: 'Uncategorized Expense',
};

export default function TaxQuickBooksMappingScreen() {
  const router = useRouter();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const { quickBooksCategoryMap, setQuickBooksCategoryMap } = useVendorDirectory();
  const [local, setLocal] = useState<Partial<Record<TaxCategory, string>>>(() => ({ ...quickBooksCategoryMap }));

  useEffect(() => {
    setLocal({ ...quickBooksCategoryMap });
  }, [quickBooksCategoryMap]);

  const save = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setQuickBooksCategoryMap(local);
    Alert.alert('Saved', 'Mappings stored on this device for export prep.');
  };

  const applySuggested = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLocal((prev) => ({ ...prev, ...SUGGESTED_ACCOUNTING_MAP }));
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
          <Text style={styles.title}>Accounting Mapping</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.note}>
            Use this to match BPS categories to your accounting or QuickBooks categories before exporting reports to your
            bookkeeper or CPA. This does not connect to QuickBooks yet.
          </Text>
          <Text style={styles.syncNote}>
            These mappings appear in the Accountant Workbook and can later support QuickBooks sync. QuickBooks sync is
            coming soon. You can prepare category mappings now and export an Accountant Workbook for your CPA.
          </Text>
          <Text style={styles.examples}>
            Examples: Materials → Job Materials · Labor → Labor · Subcontractors → Contract Labor · Equipment Rental →
            Equipment Rental · Permits / Plans → Permits & Fees · Insurance → Insurance · Vehicle / Mileage → Auto Expense
            · Software / Tools → Software · Office / Admin → Office Expense · Other → Uncategorized Expense
          </Text>

          <Pressable style={styles.suggestBtn} onPress={applySuggested}>
            <MaterialIcons name="auto-awesome" size={20} color="#2DFFC4" />
            <Text style={styles.suggestText}>Use suggested mapping</Text>
          </Pressable>

          <Text style={styles.secondaryNote}>
            Informational only. Not tax advice. Review with your CPA or tax professional.
          </Text>

          {TAX_CATEGORIES.map((cat) => (
            <View key={cat} style={styles.row}>
              <Text style={styles.cat}>{cat}</Text>
              <TextInput
                value={local[cat] || ''}
                onChangeText={(t) => setLocal((prev) => ({ ...prev, [cat]: t }))}
                placeholder="Accounting / QuickBooks category"
                placeholderTextColor="rgba(148,163,184,0.5)"
                style={styles.input}
              />
            </View>
          ))}

          <Pressable style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveText}>Save mappings</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  safe: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 8, gap: 12 },
  backWrap: { width: 42 },
  backBorder: { width: 42, height: 42, borderRadius: 20, padding: 1, overflow: 'hidden' },
  backInner: { width: 40, height: 40, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  scroll: { padding: 16, paddingBottom: 48 },
  note: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  syncNote: {
    color: 'rgba(148, 163, 184, 0.92)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  examples: {
    color: 'rgba(148, 163, 184, 0.88)',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 14,
  },
  secondaryNote: {
    color: 'rgba(148, 163, 184, 0.85)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.35)',
    backgroundColor: 'rgba(45, 255, 196, 0.08)',
  },
  suggestText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  row: { marginBottom: 16 },
  cat: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginBottom: 6 },
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
  saveBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(45, 255, 196, 0.2)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.35)',
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
