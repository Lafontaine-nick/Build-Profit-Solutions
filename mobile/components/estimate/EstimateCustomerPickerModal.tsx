import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import {
  ESTIMATE_FLOW_BLUE,
  ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
  estimateFlowCardStyle,
  estimateFlowOutlineActionButtonStyle,
  estimateFlowOutlineActionButtonTextStyle,
  estimateSummarySectionSubtitleStyle,
  estimateSummarySectionTitleStyle,
} from '@/utils/estimateFlowCardStyle';
import type { SavedEstimateCustomer } from '@/utils/estimateSavedCustomers';
import {
  formatSavedCustomerBidPill,
  formatSavedCustomerSecondaryDetail,
} from '@/utils/estimateSavedCustomers';

type Props = {
  visible: boolean;
  customers: SavedEstimateCustomer[];
  onClose: () => void;
  onSelect: (customer: SavedEstimateCustomer) => void;
  onDelete: (customer: SavedEstimateCustomer) => void;
};

function showCustomerOverflowMenu(
  customer: SavedEstimateCustomer,
  onDelete: (customer: SavedEstimateCustomer) => void,
) {
  Alert.alert(customer.name, undefined, [
    {
      text: 'Delete customer',
      style: 'destructive',
      onPress: () => {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        onDelete(customer);
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export default function EstimateCustomerPickerModal({
  visible,
  customers,
  onClose,
  onSelect,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const [query, setQuery] = useState('');

  const flowCardColors = useMemo(
    () => ({ line: Colors.line, surface2: Colors.surface2, sub: Colors.sub, text: Colors.text }),
    [Colors.line, Colors.surface2, Colors.sub, Colors.text],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) => {
      const haystack = [
        customer.name,
        customer.email,
        customer.phone,
        customer.address,
        customer.city,
        customer.state,
        customer.company,
        customer.recentProjects.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [customers, query]);

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const handleSelect = (customer: SavedEstimateCustomer) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onSelect(customer);
  };

  const headerTopPadding = Math.max(insets.top, Platform.OS === 'ios' ? 12 : 0) + 8;
  const hasCustomers = customers.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.root, { backgroundColor: Colors.bg }]}>
        <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.safeArea}>
          <View style={[styles.headerRow, { paddingTop: headerTopPadding }]}>
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={BRAND_FRAME_GRADIENT_START}
              end={BRAND_FRAME_GRADIENT_END}
              style={styles.backButtonBorder}
            >
              <GradientRingBackInner
                darkMode={darkMode}
                onPress={handleClose}
                style={[styles.backButton, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={22}
                  color={darkMode ? '#FFFFFF' : Colors.text}
                />
              </GradientRingBackInner>
            </LinearGradient>

            <View style={styles.headerText}>
              <Text style={[estimateSummarySectionTitleStyle(), { color: Colors.text, fontSize: 20 }]}>
                Saved customers
              </Text>
              <Text style={[estimateSummarySectionSubtitleStyle(darkMode), { marginTop: 3 }]}>
                {customers.length === 1 ? '1 saved customer' : `${customers.length} saved customers`}
              </Text>
            </View>
          </View>

          {hasCustomers ? (
            <View
              style={[
                styles.searchWrap,
                {
                  backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
                  borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
                },
              ]}
            >
              <Ionicons name="search" size={18} color={Colors.sub} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search name, email, phone, project..."
                placeholderTextColor={Colors.sub}
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.searchInput, { color: Colors.text }]}
              />
              {query.length > 0 ? (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color={Colors.sub} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <FlatList
            style={styles.list}
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
              paddingBottom: Math.max(insets.bottom, 20),
              flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              hasCustomers ? (
                <View
                  style={[
                    estimateFlowCardStyle(flowCardColors, darkMode, { marginBottom: 12 }),
                    { paddingVertical: 12 },
                  ]}
                >
                  <Text style={[estimateSummarySectionSubtitleStyle(darkMode), { lineHeight: 18 }]}>
                    Select a customer to fill this bid. Your current entries stay until you choose one.
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={[estimateFlowCardStyle(flowCardColors, darkMode), styles.emptyCard]}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="people-outline" size={36} color={Colors.sub} />
                </View>
                <Text style={[estimateSummarySectionTitleStyle(), { color: Colors.text, fontSize: 17 }]}>
                  No saved customers yet
                </Text>
                <Text style={[estimateSummarySectionSubtitleStyle(darkMode), styles.emptyBody]}>
                  Save or submit a bid with customer info and it will show up here for your next estimate.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const secondary = formatSavedCustomerSecondaryDetail(item);
              const latestProject = item.recentProjects[0];
              const bidLabel = formatSavedCustomerBidPill(item.bidCount);
              const metaParts = [secondary, bidLabel].filter(Boolean);

              return (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => [
                    estimateFlowCardStyle(flowCardColors, darkMode, { marginBottom: 10 }),
                    pressed ? { opacity: 0.92 } : null,
                  ]}
                >
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {latestProject ? (
                    <Text style={{ color: ESTIMATE_FLOW_BLUE, fontSize: 13, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>
                      {latestProject}
                    </Text>
                  ) : null}
                  {metaParts.length > 0 ? (
                    <Text style={[estimateSummarySectionSubtitleStyle(darkMode), { marginTop: 4, fontSize: 12 }]} numberOfLines={2}>
                      {metaParts.join(' · ')}
                    </Text>
                  ) : null}

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleSelect(item)}
                      style={estimateFlowOutlineActionButtonStyle()}
                    >
                      <Text style={estimateFlowOutlineActionButtonTextStyle()}>Use customer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => showCustomerOverflowMenu(item, onDelete)}
                      style={[
                        styles.overflowBtn,
                        {
                          borderColor: darkMode ? 'rgba(148, 163, 184, 0.18)' : Colors.line,
                          backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        },
                      ]}
                      accessibilityLabel="More actions"
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={Colors.sub} />
                    </TouchableOpacity>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
    paddingBottom: 14,
  },
  backButtonBorder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  backButton: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  list: { flex: 1 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  overflowBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: { marginTop: 8, alignItems: 'center' },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 12,
  },
  emptyBody: { marginTop: 8, lineHeight: 20, textAlign: 'center' },
});
