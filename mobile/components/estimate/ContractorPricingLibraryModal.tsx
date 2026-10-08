import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import BackButton from '@/components/ui/BackButton';
import { PHONE_CARD_GUTTER } from '@/constants/ScreenLayout';
import {
  deletePricingRate,
  fetchPricingLibrary,
  type PricingLibrarySection,
} from '@/utils/contractorPricingMemory';
import { clearAllSavedPricingData } from '@/utils/estimateSavedPricingCleanup';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type LibraryItem = PricingLibrarySection['items'][number];

type GroupedLibraryItem = {
  id: string;
  scopeItemName: string;
  material: number;
  labor: number;
  total: number;
  nationalMaterial: number;
  usageCount: number;
  pricingSource: string;
};

const NATIONAL_MATERIAL_RATES: Record<string, number> = {
  waterproofing: 5,
  shower_tile: 8,
  shower_wall_tile: 8,
  shower_floor_tile: 9,
  glass_door: 835,
};

function groupLibraryItems(items: LibraryItem[]): GroupedLibraryItem[] {
  const groups = new Map<string, GroupedLibraryItem>();
  for (const item of items) {
    const name = String(item.scopeItemName || '').replace(/\s+—\s+(?:labor|materials?)$/i, '').trim();
    const category = String(item.category || '').toLowerCase();
    const amount = Number(item.totalAmount) || 0;
    const current = groups.get(name) || {
      id: item.id,
      scopeItemName: name,
      material: 0,
      labor: 0,
      total: 0,
      nationalMaterial: 0,
      usageCount: 0,
      pricingSource: item.pricingSource,
    };
    if (category === 'material') current.material += amount;
    else if (category === 'labor') current.labor += amount;
    else current.total += amount;
    current.usageCount = Math.max(current.usageCount, item.usageCount || 0);
    const benchmarkRate = NATIONAL_MATERIAL_RATES[item.checklistItemId || ''];
    const quantity = Number(item.quantity) || 0;
    if (current.material === 0 && benchmarkRate && quantity > 0) {
      current.nationalMaterial = benchmarkRate * quantity;
    }
    groups.set(name, current);
  }
  return [...groups.values()].map((item) => {
    const benchmarkMaterial = item.material === 0 ? item.nationalMaterial : 0;
    return {
      ...item,
      total: item.total || item.material + item.labor + benchmarkMaterial,
    };
  });
}

export default function ContractorPricingLibraryModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<PricingLibrarySection[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { sections: s } = await fetchPricingLibrary();
      setSections(s);
    } catch (e) {
      Alert.alert('Pricing library', (e as Error)?.message || 'Could not load');
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const confirmReset = () => {
    Alert.alert(
      'Reset all saved pricing?',
      'This removes saved bid templates on this device and all library rates. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await clearAllSavedPricingData();
            await load();
          },
        },
      ]
    );
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete rate?', `Remove "${name}" from your pricing library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePricingRate(id);
            await load();
          } catch (e) {
            Alert.alert('Error', (e as Error)?.message || 'Delete failed');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.shell, { backgroundColor: Colors.bg, paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <View style={{ position: 'absolute', left: 0, top: 0 }}>
            <BackButton darkMode={darkMode} onPress={onClose} accessibilityLabel="Close pricing library" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: darkMode ? '#f9fafb' : Colors.text }]}>Pricing library</Text>
            <Text style={[styles.subtitle, { color: Colors.sub }]}>Saved contractor rates</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={Colors.sub} />
        ) : (
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
            {sections.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: Colors.surface2,
                    borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                  },
                ]}
              >
                <Text style={[styles.emptyBody, { color: Colors.sub }]}>
                  Rates you type on Confirm Scope or in manual pricing. Auto-calculated splits are not saved.
                </Text>
                <Text style={[styles.emptyTitle, { color: Colors.text }]}>No saved rates yet.</Text>
                <TouchableOpacity style={styles.resetLink} onPress={confirmReset} activeOpacity={0.7}>
                  <Text style={styles.resetLinkText}>Reset all saved pricing</Text>
                </TouchableOpacity>
              </View>
            ) : (
              sections.map((section) => (
                <View key={section.trade} style={{ marginBottom: 20 }}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionAccent} />
                    <Text style={[styles.sectionTitle, { color: Colors.text }]}>
                      {section.label.charAt(0).toUpperCase() + section.label.slice(1)}
                    </Text>
                    <View style={[styles.sectionRule, { backgroundColor: Colors.line }]} />
                  </View>
                  {groupLibraryItems(section.items).map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.card,
                        {
                          borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                          backgroundColor: Colors.surface2,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>
                          {item.scopeItemName}
                        </Text>
                        <View style={styles.priceSummaryRow}>
                          <View style={styles.breakdownRow}>
                          <View style={styles.materialColumn}>
                            <Text style={[styles.breakdownText, { color: Colors.sub }]}>
                              Materials{' '}
                              <Text style={{ color: item.material > 0 ? '#22c55e' : '#fbbf24' }}>
                                ${(item.material || item.nationalMaterial).toLocaleString()}
                              </Text>
                            </Text>
                            {item.nationalMaterial > 0 && item.material === 0 ? (
                              <Text style={styles.nationalMaterial}>National average</Text>
                            ) : null}
                          </View>
                          <View style={styles.laborColumn}>
                            <Text style={[styles.breakdownText, { color: Colors.sub }]}>
                              Labor{' '}
                              <Text style={{ color: item.labor > 0 ? '#22c55e' : Colors.sub }}>
                                ${item.labor.toLocaleString()}
                              </Text>
                            </Text>
                            {item.labor > 0 && item.material === 0 ? (
                              <Text style={styles.userEnteredLabel}>User entered</Text>
                            ) : null}
                          </View>
                          </View>
                          <Text style={styles.totalValue}>${item.total.toLocaleString()}</Text>
                        </View>
                        {item.material > 0 && item.labor > 0 ? (
                          <Text style={[styles.userEnteredLabel, styles.bothUserEnteredLabel]}>
                            User entered
                          </Text>
                        ) : null}
                        <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 7 }}>
                          Used {item.usageCount} time{item.usageCount === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDelete(item.id, item.scopeItemName)}
                        style={styles.deleteButton}
                        hitSlop={8}
                      >
                        <MaterialIcons name="delete-outline" size={16} color="#fb7185" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))
            )}
            {sections.length > 0 ? (
              <TouchableOpacity style={styles.resetLink} onPress={confirmReset} activeOpacity={0.7}>
                <Text style={styles.resetLinkText}>Reset all saved pricing</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  headerRow: {
    position: 'relative',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
    marginHorizontal: Platform.OS === 'web' ? 8 : PHONE_CARD_GUTTER,
  },
  headerCopy: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 52,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 18, marginTop: 4, textAlign: 'center' },
  scrollContent: {
    paddingHorizontal: Platform.OS === 'web' ? 8 : PHONE_CARD_GUTTER,
    paddingBottom: 40,
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  emptyBody: { fontSize: 14, lineHeight: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  resetLink: {
    marginTop: 16,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLinkText: { color: '#f87171', fontWeight: '700', fontSize: 15, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    marginLeft: 3,
  },
  deleteButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  priceSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 10,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  breakdownText: { fontSize: 13, fontWeight: '600' },
  materialColumn: { gap: 2, flexShrink: 1 },
  laborColumn: { gap: 2 },
  userEnteredLabel: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  bothUserEnteredLabel: {
    alignSelf: 'flex-start',
    textAlign: 'left',
    marginTop: 2,
    fontSize: 12,
  },
  nationalMaterial: { color: '#fbbf24', fontSize: 11, fontWeight: '700' },
  totalValue: {
    color: '#22c55e',
    fontSize: 20,
    fontWeight: '900',
    minWidth: 58,
    textAlign: 'right',
    marginLeft: 'auto',
  },
});
