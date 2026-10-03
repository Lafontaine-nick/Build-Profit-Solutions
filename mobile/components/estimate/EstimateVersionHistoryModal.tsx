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
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
  estimateFlowCardStyle,
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
          <View
            pointerEvents="box-none"
            style={[styles.headerRow, !darkMode && { borderBottomColor: Colors.line }]}
          >
            <View style={styles.headerText} pointerEvents="none">
              <Text style={[styles.headerTitle, { color: Colors.text }]}>Saved bids</Text>
              <Text style={[styles.headerSubtitle, !darkMode && { color: Colors.sub }]}>
                {savedEstimates.length === 1
                  ? '1 saved bid'
                  : `${savedEstimates.length} saved bids`}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={[
                styles.backButton,
                { backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.surface2 },
              ]}
            >
              <MaterialIcons name="arrow-back" size={22} color={darkMode ? '#e2e8f0' : Colors.text} />
            </TouchableOpacity>
          </View>

          {sortedEstimates.length === 0 ? (
            <View style={estimateFlowCardStyle(flowCardColors, darkMode)}>
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
                const bidTotal = resolveTotal(item);
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
                    <Text style={{ color: bidTotal > 0 ? '#2dcc9a' : '#d7e1f0', fontSize: 22, fontWeight: '800', marginTop: 6 }}>
                      {formatTemplateMoney(bidTotal)}
                    </Text>
                    <Text style={[estimateSummarySectionSubtitleStyle(darkMode), { marginTop: 4, fontSize: 12 }]}>
                      {metaParts.join(' · ')}
                    </Text>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => confirmOpen(item, onRestore)}
                        style={styles.openBidButton}
                      >
                        <Text style={styles.openBidText}>Open bid</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 16,
    marginBottom: 14,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  headerText: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 56,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 23,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#d7e1f0',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.12,
    lineHeight: 20,
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(45, 204, 154, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(45, 204, 154, 0.35)',
  },
  recentBadgeText: {
    color: '#2dcc9a',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  openBidButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#2dcc9a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  openBidText: {
    color: '#050B13',
    fontSize: 15,
    fontWeight: '800',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
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
