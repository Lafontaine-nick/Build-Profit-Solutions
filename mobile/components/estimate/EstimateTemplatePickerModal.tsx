import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import {
  ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
  ESTIMATE_TEMPLATE_PRESERVATION_LONG,
  estimateFlowCardStyle,
  estimateSummarySectionSubtitleStyle,
  estimateSummarySectionTitleStyle,
} from '@/utils/estimateFlowCardStyle';
import type { SavedBidTemplate } from '@/utils/estimateSavedBidTemplates';
import {
  formatTemplateCategory,
  formatTemplateMoney,
} from '@/utils/estimateSavedBidTemplates';

type Props = {
  visible: boolean;
  templates: SavedBidTemplate[];
  onClose: () => void;
  onSelect: (template: SavedBidTemplate) => void;
  onDelete: (template: SavedBidTemplate) => void;
  onSaveCurrent?: () => void;
};

function formatTemplateUpdatedAt(template: SavedBidTemplate): string {
  const raw = template.updatedAt || template.createdAt;
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return `Updated ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function showTemplateOverflowMenu(template: SavedBidTemplate, onDelete: (t: SavedBidTemplate) => void) {
  Alert.alert(template.name, undefined, [
    {
      text: 'Delete template',
      style: 'destructive',
      onPress: () => onDelete(template),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export default function EstimateTemplatePickerModal({
  visible,
  templates,
  onClose,
  onSelect,
  onDelete,
  onSaveCurrent,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const [query, setQuery] = useState('');
  const hasTemplates = templates.length > 0;

  const flowCardColors = useMemo(
    () => ({ line: Colors.line, surface2: Colors.surface2, sub: Colors.sub, text: Colors.text }),
    [Colors.line, Colors.surface2, Colors.sub, Colors.text],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((template) => {
      const haystack = [template.name, template.category, template.trade, template.description]
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

  const handleSaveCurrent = () => {
    if (!onSaveCurrent) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSaveCurrent();
  };

  const headerTopPadding = Math.max(insets.top, Platform.OS === 'ios' ? 12 : 0) + 8;
  const footerPad = Math.max(insets.bottom, 16);

  const renderEmptyState = () => (
    <View style={[estimateFlowCardStyle(flowCardColors, darkMode), styles.emptyCard]}>
      <Text style={[estimateSummarySectionTitleStyle(), { color: Colors.text, fontSize: 17, textAlign: 'center' }]}>
        No templates yet
      </Text>
      <Text style={[estimateSummarySectionSubtitleStyle(darkMode), styles.emptyBody]}>
        Save this estimate as a reusable starting point for similar jobs.
      </Text>
      {onSaveCurrent ? (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleSaveCurrent}
          style={[styles.mintButton, { marginTop: 8 }]}
        >
          <Text style={styles.mintButtonText}>Save as template</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={[styles.emptyFootnote, { color: Colors.sub }]}>
        {ESTIMATE_TEMPLATE_PRESERVATION_LONG}
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <View style={[styles.root, { backgroundColor: Colors.bg }]}>
        <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.safeArea}>
          <View
            pointerEvents="box-none"
            style={[
              styles.headerRow,
              { paddingTop: headerTopPadding },
              !darkMode && { borderBottomColor: Colors.line },
            ]}
          >
            <View style={styles.headerText} pointerEvents="none">
              <Text style={[styles.headerTitle, { color: Colors.text }]}>Bid templates</Text>
              <Text style={[styles.headerSubtitle, !darkMode && { color: Colors.sub }]}>
                Reusable starting points for similar jobs
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={[
                styles.backButton,
                { top: headerTopPadding },
                { backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.surface2 },
              ]}
            >
              <MaterialIcons name="arrow-back" size={22} color={darkMode ? '#e2e8f0' : Colors.text} />
            </TouchableOpacity>
          </View>

          {hasTemplates ? (
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
          ) : null}

          <FlatList
            style={styles.list}
            data={hasTemplates ? filtered : []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
              paddingBottom: hasTemplates && onSaveCurrent ? footerPad + 72 : footerPad + 8,
              flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={hasTemplates ? null : renderEmptyState}
            renderItem={({ item }) => {
              const category = formatTemplateCategory(item);
              const materialsLabel = formatTemplateMoney(item.estimatedMaterialsTotal);
              const laborLabel = formatTemplateMoney(item.estimatedLaborTotal);
              const updatedLabel = formatTemplateUpdatedAt(item);

              return (
                <View style={estimateFlowCardStyle(flowCardColors, darkMode, { marginBottom: 10 })}>
                  <Text style={[styles.cardName, { color: Colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardCategory} numberOfLines={1}>
                    {category} · {item.lineItemCount} items
                  </Text>
                  <Text style={[styles.cardMeta, { color: Colors.sub }]} numberOfLines={1}>
                    Materials {materialsLabel} · Labor {laborLabel}
                  </Text>
                  {updatedLabel ? (
                    <Text style={[styles.cardUpdated, { color: Colors.sub }]} numberOfLines={1}>
                      {updatedLabel}
                    </Text>
                  ) : null}

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => onSelect(item)}
                      style={[styles.mintButton, { flex: 1, width: undefined }]}
                    >
                      <Text style={styles.mintButtonText}>Use template</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => showTemplateOverflowMenu(item, onDelete)}
                      style={[
                        styles.overflowBtn,
                        {
                          borderColor: darkMode ? 'rgba(148, 163, 184, 0.18)' : Colors.line,
                          backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        },
                      ]}
                      accessibilityLabel="More template actions"
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={Colors.sub} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />

          {hasTemplates && onSaveCurrent ? (
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: footerPad,
                  borderTopColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
                  backgroundColor: Colors.bg,
                },
              ]}
            >
              <TouchableOpacity activeOpacity={0.88} onPress={handleSaveCurrent} style={styles.mintButton}>
                <Text style={styles.mintButtonText}>Save as template</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
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
    left: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mintButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#2dcc9a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mintButtonText: {
    color: '#050B13',
    fontSize: 16,
    fontWeight: '800',
  },
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
  cardName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  cardCategory: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2dcc9a',
    marginTop: 4,
  },
  cardMeta: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  cardUpdated: { fontSize: 12, marginTop: 4 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  overflowBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    marginTop: 8,
    alignItems: 'center',
  },
  emptyBody: {
    marginTop: 8,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  emptyFootnote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
  },
});
