import React, { useMemo } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import {
  ESTIMATE_FLOW_CHIP_GREEN,
  ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
  estimateFlowCardStyle,
  estimateFlowOutlineActionButtonStyle,
  estimateFlowOutlineActionButtonTextStyle,
  estimateSummarySectionSubtitleStyle,
  estimateSummarySectionTitleStyle,
} from '@/utils/estimateFlowCardStyle';
import { formatTemplateMoney } from '@/utils/estimateSavedBidTemplates';

export type SavedEstimateSnapshot = {
  id: string;
  title?: string;
  customer?: string;
  customerName?: string;
  timestamp?: string;
  createdAt?: string;
  total?: number;
  grandTotal?: number;
  data?: {
    materialLineItems?: unknown[];
    laborLineItems?: unknown[];
  };
};

type FlowColors = {
  bg: string;
  text: string;
  sub: string;
  line: string;
  surface2: string;
};

type Props = {
  visible: boolean;
  darkMode: boolean;
  Colors: FlowColors;
  savedEstimates: SavedEstimateSnapshot[];
  onClose: () => void;
  onRestore: (estimate: SavedEstimateSnapshot) => void;
  onDelete: (estimateId: string) => void;
  computeTotal?: (estimate: SavedEstimateSnapshot) => number;
};

function savedEstimateTitle(item: SavedEstimateSnapshot): string {
  const title = String(item.title || '').trim();
  if (title && title !== 'Untitled Bid') return title;
  return 'Untitled estimate';
}

function savedEstimateClientLabel(item: SavedEstimateSnapshot): string {
  const client = String(item.customer || item.customerName || '').trim();
  if (!client || client.toLowerCase() === 'unknown customer') return 'No client';
  return client;
}

function savedEstimateLineItemCount(item: SavedEstimateSnapshot): number {
  const materials = item.data?.materialLineItems?.length || 0;
  const labor = item.data?.laborLineItems?.length || 0;
  return materials + labor;
}

function formatSavedTimestamp(item: SavedEstimateSnapshot): string {
  const raw = item.timestamp || item.createdAt;
  if (!raw) return 'Unknown date';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today at ${timePart}`;

  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${datePart} at ${timePart}`;
}

function sortByMostRecent(items: SavedEstimateSnapshot[]): SavedEstimateSnapshot[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.timestamp || a.createdAt || 0).getTime();
    const bTime = new Date(b.timestamp || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function confirmOpen(
  item: SavedEstimateSnapshot,
  onOpen: (estimate: SavedEstimateSnapshot) => void,
) {
  Alert.alert(
    'Open this bid?',
    'Your current work is saved automatically.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open bid',
        onPress: () => {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          onOpen(item);
        },
      },
    ],
  );
}

function confirmDelete(
  item: SavedEstimateSnapshot,
  onDelete: (estimateId: string) => void,
) {
  Alert.alert(
    'Delete this saved bid?',
    'This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          onDelete(item.id);
        },
      },
    ],
  );
}

function showVersionOverflowMenu(
  item: SavedEstimateSnapshot,
  onDelete: (estimateId: string) => void,
) {
  Alert.alert(savedEstimateTitle(item), undefined, [
    {
      text: 'Delete saved bid',
      style: 'destructive',
      onPress: () => confirmDelete(item, onDelete),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export default function EstimateVersionHistoryModal({
  visible,
  darkMode,
  Colors,
  savedEstimates,
  onClose,
  onRestore,
  onDelete,
  computeTotal,
}: Props) {
  const insets = useSafeAreaInsets();
  const flowCardColors = useMemo(
    () => ({ line: Colors.line, surface2: Colors.surface2, sub: Colors.sub, text: Colors.text }),
    [Colors.line, Colors.surface2, Colors.sub, Colors.text],
  );

  const sortedEstimates = useMemo(() => sortByMostRecent(savedEstimates), [savedEstimates]);

  const resolveTotal = (item: SavedEstimateSnapshot) => {
    if (typeof computeTotal === 'function') return computeTotal(item);
    return Number(item.total || item.grandTotal || 0);
  };

  const headerTop = Math.max(insets.top, Platform.OS === 'ios' ? 12 : 0) + 8;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.root, { backgroundColor: Colors.bg }]}>
        <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
            paddingTop: headerTop,
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={BRAND_FRAME_GRADIENT_START}
              end={BRAND_FRAME_GRADIENT_END}
              style={styles.backRing}
            >
              <GradientRingBackInner
                darkMode={darkMode}
                onPress={onClose}
                style={[styles.backInner, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
              >
                <MaterialIcons name="arrow-back" size={22} color={darkMode ? '#FFFFFF' : Colors.text} />
              </GradientRingBackInner>
            </LinearGradient>
            <View style={styles.headerText}>
              <Text style={[estimateSummarySectionTitleStyle(), { color: Colors.text, fontSize: 20 }]}>
                Saved bids
              </Text>
              <Text style={[estimateSummarySectionSubtitleStyle(darkMode), { marginTop: 3 }]}>
                {savedEstimates.length === 1
                  ? '1 saved bid'
                  : `${savedEstimates.length} saved bids`}
              </Text>
            </View>
          </View>

          <View style={[estimateFlowCardStyle(flowCardColors, darkMode, { marginBottom: 14 }), { paddingVertical: 12 }]}>
            <Text style={[estimateSummarySectionSubtitleStyle(darkMode), { lineHeight: 18 }]}>
              Open a saved estimate. Your current work is saved automatically.
            </Text>
          </View>

          {sortedEstimates.length === 0 ? (
            <View style={estimateFlowCardStyle(flowCardColors, darkMode)}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="document-text-outline" size={36} color={Colors.sub} />
              </View>
              <Text style={[estimateSummarySectionTitleStyle(), { color: Colors.text, fontSize: 17 }]}>
                No saved bids yet
              </Text>
              <Text style={[estimateSummarySectionSubtitleStyle(darkMode), { marginTop: 8, lineHeight: 18 }]}>
                Bids are saved automatically as you work on this estimate.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {sortedEstimates.map((item, index) => {
                const lineItemCount = savedEstimateLineItemCount(item);
                const metaParts = [
                  savedEstimateClientLabel(item),
                  formatSavedTimestamp(item),
                  lineItemCount > 0 ? `${lineItemCount} items` : null,
                ].filter(Boolean);
                const isMostRecent = index === 0;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => confirmOpen(item, onRestore)}
                    style={({ pressed }) => [
                      estimateFlowCardStyle(flowCardColors, darkMode),
                      pressed ? { opacity: 0.92 } : null,
                    ]}
                  >
                    <View style={styles.cardTitleRow}>
                      <Text
                        style={{ color: Colors.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.2, flex: 1 }}
                        numberOfLines={2}
                      >
                        {savedEstimateTitle(item)}
                      </Text>
                      {isMostRecent ? (
                        <View style={styles.recentBadge}>
                          <Text style={styles.recentBadgeText}>Most recent</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800', marginTop: 6 }}>
                      {formatTemplateMoney(resolveTotal(item))}
                    </Text>
                    <Text style={[estimateSummarySectionSubtitleStyle(darkMode), { marginTop: 4, fontSize: 12 }]}>
                      {metaParts.join(' · ')}
                    </Text>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => confirmOpen(item, onRestore)}
                        style={estimateFlowOutlineActionButtonStyle()}
                      >
                        <Text style={estimateFlowOutlineActionButtonTextStyle()}>Open bid</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => showVersionOverflowMenu(item, onDelete)}
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
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  backRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  backInner: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: { flex: 1 },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recentBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  recentBadgeText: {
    color: ESTIMATE_FLOW_CHIP_GREEN,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
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
});
