import React, { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useVendorDirectory } from '@/contexts/VendorDirectoryContext';
import { useProjectList } from '@/contexts/ProjectListContext';
import { expenseAmount, getYearExpenses, normalizeVendorNameKey } from '@/src/lib/taxCenter';
import { isReviewableVendorType, type VendorType, type W9Status } from '@/src/lib/vendorTypes';

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
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = React.useMemo(() => getColors(themeContext), [themeContext]);
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
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <View style={styles.backWrap}>
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
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
          <Text style={styles.title}>Vendors & Subcontractors</Text>
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/tax-vendor/new');
            }}
          >
            <MaterialIcons name="add" size={26} color="#2DFFC4" />
          </Pressable>
        </View>

        <Text style={styles.sub}>
          Track W-9 status and vendor details for bookkeeping and Potential 1099 review. Informational only. Not tax
          advice. Review with your CPA or tax professional.
        </Text>

        {!hydrated ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : (
          <FlatList
            data={vendors}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.muted}>
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
                maximumFractionDigits: 0,
              }).format(paid);
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
                    <Text style={styles.rowTitle}>{item.businessName}</Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{typeBadgeLabel(item.vendorType)}</Text>
                      </View>
                      {item.requires1099Review ? (
                        <View style={styles.flagBadge}>
                          <Text style={styles.flagBadgeText}>Potential 1099 Review</Text>
                        </View>
                      ) : null}
                      {w9Line ? (
                        <View style={styles.w9Badge}>
                          <Text style={styles.w9BadgeText}>{w9Line}</Text>
                        </View>
                      ) : null}
                    </View>
                    {!supplierMinimal ? (
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {[item.email, item.phone].filter(Boolean).join(' · ') || '—'}
                      </Text>
                    ) : null}
                    {item.defaultCategory ? (
                      <Text style={styles.rowSmall} numberOfLines={1}>
                        Default category: {item.defaultCategory}
                      </Text>
                    ) : null}
                    {item.defaultPaymentMethod ? (
                      <Text style={styles.rowSmall} numberOfLines={1}>
                        Payment: {item.defaultPaymentMethod}
                      </Text>
                    ) : null}
                    {!supplierMinimal && item.notes?.trim() ? (
                      <Text style={styles.rowSmall} numberOfLines={2}>
                        Note: {item.notes.trim()}
                      </Text>
                    ) : null}
                    <Text style={styles.rowSmall}>
                      Paid ({currentYear}): {paidFmt}
                      {projList.length
                        ? ` · Projects: ${projList.slice(0, 3).join(', ')}${projList.length > 3 ? '…' : ''}`
                        : ''}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color="rgba(148,163,184,0.7)" />
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  safe: { flex: 1, paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    gap: 12,
  },
  backWrap: { width: 42 },
  backBorder: { width: 42, height: 42, borderRadius: 20, padding: 1, overflow: 'hidden' },
  backInner: {
    width: 40,
    height: 40,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  addBtn: { padding: 6 },
  sub: { color: 'rgba(148, 163, 184, 0.95)', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  list: { paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    marginBottom: 10,
  },
  rowTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(45, 255, 196, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.28)',
  },
  typeBadgeText: { color: '#7FDAC5', fontSize: 11, fontWeight: '800' },
  flagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(96, 165, 250, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  flagBadgeText: { color: '#BFDBFE', fontSize: 10, fontWeight: '800' },
  w9Badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.22)',
  },
  w9BadgeText: { color: '#FDE68A', fontSize: 11, fontWeight: '700' },
  rowMeta: { color: 'rgba(148, 163, 184, 0.95)', fontSize: 12, marginTop: 6 },
  rowSmall: { color: 'rgba(148, 163, 184, 0.88)', fontSize: 11, marginTop: 4 },
  muted: { color: 'rgba(148, 163, 184, 0.9)', fontSize: 14, paddingVertical: 20 },
});
