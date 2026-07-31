import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { BRAND_FRAME_GRADIENT_COLORS, BRAND_FRAME_GRADIENT_END, BRAND_FRAME_GRADIENT_START } from '@/constants/brandFrameGradient';
import GradientRingBackInner from '@/components/GradientRingBackInner';
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
        <View style={styles.header}>
          <LinearGradient
            colors={BRAND_FRAME_GRADIENT_COLORS}
            start={BRAND_FRAME_GRADIENT_START}
            end={BRAND_FRAME_GRADIENT_END}
            style={styles.backButtonBorder}
          >
            <GradientRingBackInner
              darkMode={darkMode}
              onPress={onClose}
              style={[styles.backButtonInner, { backgroundColor: Colors.bg }]}
              accessibilityLabel="Close pricing library"
            >
              <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
            </GradientRingBackInner>
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: Colors.text }]}>Pricing library</Text>
            <Text style={[styles.subtitle, { color: Colors.sub }]}>Your saved contractor rates</Text>
          </View>
        </View>
        <Text style={{ color: Colors.sub, fontSize: 13, paddingHorizontal: 20, marginBottom: 12, lineHeight: 18 }}>
          Rates you entered manually on past bids — per-unit (e.g. waterproofing $/sqft) or flat allowances
          (permits, plans, fees). Auto-calculated splits are not saved. Suggestions always require your
          approval.
        </Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={Colors.sub} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
            {sections.length === 0 ? (
              <Text style={{ color: Colors.sub, fontSize: 14 }}>
                No manually entered rates yet. Type prices on Confirm Scope or in manual pricing, then apply
                the bid.
              </Text>
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
                          backgroundColor: darkMode ? 'rgba(255,255,255,0.045)' : Colors.surface2,
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
            <TouchableOpacity
              style={{ marginTop: 16 }}
              onPress={() => {
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
              }}
            >
              <Text style={{ color: '#f87171', fontWeight: '700', textAlign: 'center' }}>
                Reset all saved pricing
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    gap: 14,
    position: 'relative',
  },
  backButtonBorder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 1,
    overflow: 'hidden',
  },
  backButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: { fontSize: 23, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 3 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    padding: 15,
    borderRadius: 16,
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
