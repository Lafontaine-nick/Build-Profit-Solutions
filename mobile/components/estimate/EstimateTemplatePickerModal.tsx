import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  StyleSheet,
  StatusBar,
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
import type { SavedBidTemplate } from '@/utils/estimateSavedBidTemplates';
import {
  formatTemplateCategory,
  formatTemplateMoney,
  formatTemplateUsageLabel,
} from '@/utils/estimateSavedBidTemplates';

type Props = {
  visible: boolean;
  templates: SavedBidTemplate[];
  onClose: () => void;
  onSelect: (template: SavedBidTemplate) => void;
  onDelete: (template: SavedBidTemplate) => void;
};

export default function EstimateTemplatePickerModal({
  visible,
  templates,
  onClose,
  onSelect,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((template) => {
      const haystack = [
        template.name,
        template.category,
        template.trade,
        template.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [templates, query]);

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const headerTopPadding = Math.max(insets.top, Platform.OS === 'ios' ? 12 : 0) + 8;

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
            <View style={styles.headerSide}>
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
                    size={24}
                    color={darkMode ? '#FFFFFF' : Colors.text}
                  />
                </GradientRingBackInner>
              </LinearGradient>
            </View>

            <View style={styles.headerText}>
              <Text style={[styles.title, { color: Colors.text }]}>Saved Bid Templates</Text>
              <Text style={[styles.subtitle, { color: Colors.sub }]}>
                Reuse materials, labor, and pricing packages
              </Text>
            </View>

            <View style={styles.headerSide} />
          </View>

          <View
            style={[
              styles.searchWrap,
              {
                backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
                borderColor: Colors.line,
              },
            ]}
          >
            <Ionicons name="search" size={18} color={Colors.sub} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, category, trade..."
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

          <FlatList
            style={styles.list}
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: Math.max(insets.bottom, 20),
              flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="document-text-outline" size={42} color={Colors.sub} />
                <Text style={[styles.emptyTitle, { color: Colors.text }]}>
                  No saved bid templates yet
                </Text>
                <Text style={[styles.emptyBody, { color: Colors.sub }]}>
                  Save your most common estimates as templates so you can build repeat bids faster.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const category = formatTemplateCategory(item);
              const pillLabel = formatTemplateUsageLabel(item.usageCount);
              const materialsLabel = formatTemplateMoney(item.estimatedMaterialsTotal);
              const laborLabel = formatTemplateMoney(item.estimatedLaborTotal);
              const totalLabel = formatTemplateMoney(item.estimatedBidTotal);

              return (
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: darkMode ? '#111827' : Colors.surface2,
                      borderColor: Colors.line,
                    },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => onSelect(item)}
                    style={styles.cardContent}
                  >
                    <Text style={[styles.cardName, { color: Colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.cardCategory} numberOfLines={1}>
                      {category}
                    </Text>
                    <Text style={[styles.cardMeta, { color: Colors.sub }]} numberOfLines={1}>
                      Materials {materialsLabel} · Labor {laborLabel}
                    </Text>
                    <Text style={[styles.cardTotal, { color: Colors.text }]} numberOfLines={1}>
                      Total {totalLabel} · {item.lineItemCount} items
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.deleteColumn}>
                    <TouchableOpacity
                      onPress={() => onDelete(item)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.deleteButton}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fca5a5" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.badgeColumn}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => onSelect(item)}
                      style={styles.badge}
                    >
                      <Text style={styles.badgeText}>{pillLabel}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const DELETE_COLUMN_WIDTH = 36;
const BADGE_COLUMN_WIDTH = 72;

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerSide: { width: 52, alignItems: 'flex-start' },
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
  headerText: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  list: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 10,
    marginBottom: 10,
  },
  cardContent: { flex: 1, minWidth: 0, paddingRight: 8 },
  cardName: { fontSize: 17, fontWeight: '800' },
  cardCategory: {
    fontSize: 13,
    fontWeight: '700',
    color: '#22c55e',
    marginTop: 4,
  },
  cardMeta: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  cardTotal: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  deleteColumn: {
    width: DELETE_COLUMN_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 1,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.28)',
  },
  badgeColumn: {
    width: BADGE_COLUMN_WIDTH,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  badgeText: { color: '#22c55e', fontSize: 11, fontWeight: '800' },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
