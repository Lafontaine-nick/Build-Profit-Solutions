import React, { useMemo } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TAX_CENTER_WEB_MAX_CONTENT_WIDTH } from '@/constants/ScreenLayout';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useVendorDirectory } from '@/contexts/VendorDirectoryContext';
import { useProjectList } from '@/contexts/ProjectListContext';
import { expenseAmount, getYearExpenses, normalizeVendorNameKey } from '@/src/lib/taxCenter';
import { isReviewableVendorType, type VendorType, type W9Status } from '@/src/lib/vendorTypes';

function paidColor(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return '#94a3b8';
  if (amount < 0) return '#f87171';
  return '#2dcc9a';
}

function typeBadgeLabel(t: VendorType): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function w9BadgeText(
  w9: W9Status,
  vendorType: VendorType,
  requires1099Review?: boolean
): string | null {
  if (vendorType === 'supplier' && !requires1099Review) return null;
  if (w9 === 'not_applicable') return 'W-9: N/A';
  return `W-9: ${w9}`;
}

export default function TaxVendorsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();
  const { vendors, hydrated } = useVendorDirectory();
  const { projects } = useProjectList();
  const currentYear = new Date().getFullYear();
  const yearExpenses = useMemo(() => getYearExpenses(projects, currentYear), [projects, currentYear]);

  const statsByVendorId = useMemo(() => {
    const map = new Map<string, { paid: number; projects: Set<string> }>();
    for (const v of vendors) {
      map.set(v.id, { paid: 0, projects: new Set<string>() });
    }
    for (const e of yearExpenses) {
      const vid = e.vendorId ? String(e.vendorId) : '';
      const nameKey = normalizeVendorNameKey(String(e.vendorName || e.vendor || ''));
      let id: string | undefined;
      if (vid && map.has(vid)) id = vid;
      else {
        const match = vendors.find((vv) => normalizeVendorNameKey(vv.businessName) === nameKey);
        id = match?.id;
      }
      if (!id || !map.has(id)) continue;
      const entry = map.get(id)!;
      entry.paid += expenseAmount(e);
      const pn = String(e.projectName || '').trim();
      if (pn) entry.projects.add(pn);
    }
    return map;
  }, [vendors, yearExpenses]);

  return (
    <View style={styles.screenRoot}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
            <View style={styles.sideButton} pointerEvents="box-none">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Back"
                style={styles.iconButton}
              >
                <MaterialIcons name="chevron-left" size={22} color={darkMode ? '#e2e8f0' : '#0f172a'} />
              </Pressable>
            </View>
            <View style={styles.headerTitleCluster} pointerEvents="none">
              <Text style={styles.kicker}>Vendor directory</Text>
              <Text style={styles.screenTitle}>Vendors</Text>
            </View>
            <View style={styles.addWrap} pointerEvents="box-none">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/tax-vendor/new');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Add vendor"
                style={styles.iconButton}
              >
                <MaterialIcons name="add" size={22} color="#2dcc9a" />
              </Pressable>
            </View>
          </View>

          {!hydrated ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : (
            <FlatList
                data={vendors}
                keyExtractor={(item) => item.id}
                style={styles.listGrow}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    No vendors yet. Tap + to add subcontractors, suppliers, consultants, or other project vendors.
                  </Text>
                }
                renderItem={({ item }) => {
                  const st = statsByVendorId.get(item.id);
                  const paid = st?.paid ?? 0;
                  const projList = st ? Array.from(st.projects).sort() : [];
                  const paidFmt = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(paid);
                  const detailLine = [item.defaultCategory, item.defaultPaymentMethod].filter(Boolean).join(' · ');
                  const supplierMinimal = item.vendorType === 'supplier' && !item.requires1099Review;
                  const showW9AndFlags = isReviewableVendorType(item.vendorType) || item.requires1099Review === true;
                  const w9Line = showW9AndFlags ? w9BadgeText(item.w9Status, item.vendorType, item.requires1099Review) : null;

                  return (
                    <Pressable
                      style={styles.row}
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push(`/tax-vendor/${item.id}`);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.rowTop}>
                          <Text style={styles.rowTitle} numberOfLines={2}>
                            {item.businessName}
                          </Text>
                          <Text style={[styles.rowPaid, { color: paidColor(paid) }]}>{paidFmt}</Text>
                        </View>
                        <View style={styles.badgeRow}>
                          <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{typeBadgeLabel(item.vendorType)}</Text>
                          </View>
                          {item.requires1099Review ? (
                            <View style={styles.flagBadge}>
                              <Text style={styles.flagBadgeText}>1099 review</Text>
                            </View>
                          ) : null}
                          {w9Line ? (
                            <View style={styles.w9Badge}>
                              <Text style={styles.w9BadgeText}>{w9Line}</Text>
                            </View>
                          ) : null}
                        </View>
                        {!supplierMinimal && [item.email, item.phone].filter(Boolean).length > 0 ? (
                          <Text style={styles.rowSmall} numberOfLines={1}>
                            {[item.email, item.phone].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                        {detailLine ? (
                          <Text style={styles.rowSmall} numberOfLines={1}>
                            {detailLine}
                          </Text>
                        ) : null}
                        {projList.length ? (
                          <Text style={styles.rowSmall} numberOfLines={2}>
                            {projList.slice(0, 3).join(', ')}
                            {projList.length > 3 ? '…' : ''}
                          </Text>
                        ) : null}
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color="rgba(148,163,184,0.7)" />
                    </Pressable>
                  );
                }}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pageShell: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 12,
    minHeight: 0,
  },
  pageShellWeb: {
    maxWidth: TAX_CENTER_WEB_MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  headerRow: {
    minHeight: 56,
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  sideButton: {
    position: 'absolute',
    left: 0,
    zIndex: 2,
  },
  addWrap: {
    position: 'absolute',
    right: 0,
    zIndex: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCluster: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  kicker: {
    color: '#8eecc9',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: -0.25,
    lineHeight: 23,
    textAlign: 'center',
  },
  listGrow: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#202022',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', flex: 1 },
  rowPaid: { fontSize: 16, fontWeight: '800', letterSpacing: -0.25 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(45, 204, 154, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(45, 204, 154, 0.55)',
  },
  typeBadgeText: { color: '#8eecc9', fontSize: 11, fontWeight: '800' },
  flagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  flagBadgeText: { color: '#FBBF24', fontSize: 11, fontWeight: '800' },
  w9Badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  w9BadgeText: { color: '#FBBF24', fontSize: 11, fontWeight: '700' },
  rowMeta: { color: 'rgba(148, 163, 184, 0.95)', fontSize: 12, marginTop: 6 },
  rowSmall: { color: 'rgba(148, 163, 184, 0.88)', fontSize: 11, marginTop: 4 },
  muted: { color: 'rgba(148, 163, 184, 0.9)', fontSize: 14, paddingVertical: 12 },
  emptyText: {
    color: 'rgba(148, 163, 184, 0.92)',
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: 28,
    textAlign: 'center',
  },
});
