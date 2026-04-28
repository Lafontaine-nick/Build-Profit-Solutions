import React from 'react';
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
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useVendorDirectory } from '@/contexts/VendorDirectoryContext';

export default function TaxVendorsScreen() {
  const router = useRouter();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = React.useMemo(() => getColors(themeContext), [themeContext]);
  const { vendors, hydrated } = useVendorDirectory();

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
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/tax-vendor/${item.id}`);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.businessName}</Text>
                  <Text style={styles.rowMeta}>
                    {item.vendorType} · W-9: {item.w9Status}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="rgba(148,163,184,0.7)" />
              </Pressable>
            )}
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
  rowMeta: { color: 'rgba(148, 163, 184, 0.95)', fontSize: 12, marginTop: 4 },
  muted: { color: 'rgba(148, 163, 184, 0.9)', fontSize: 14, paddingVertical: 20 },
});
