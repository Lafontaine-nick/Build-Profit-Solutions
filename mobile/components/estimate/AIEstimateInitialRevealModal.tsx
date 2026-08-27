import React, { useCallback, useEffect, useMemo, useState, memo, startTransition } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney } from '@/utils/estimateAiDraft';
import { getScopePackagesForReview } from '@/utils/scopePackagesForReview';
import { scopePackagePricedAmount } from '@/utils/estimateDraftReviewUi';
import {
  countInitialRevealAttentionItems,
  draftNeedsScopeConfirmation,
  getInitialRevealDisplayTitle,
  getInitialRevealHeroDisplay,
  getInitialRevealPrimaryCtaLabel,
  getInitialRevealPriorityItems,
  getInitialRevealStatusLabel,
  getInitialRevealTagline,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import { estimateFlowCardStyle, estimateFlowDividerColor, aiFlowCardBackground } from '@/utils/estimateFlowCardStyle';
import { BRAND_FRAME_GRADIENT_END, BRAND_FRAME_GRADIENT_START } from '@/constants/brandFrameGradient';

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
  markupPct?: number;
  fromAssistant?: boolean;
  onBack: () => void;
  onClose: () => void;
  onOpenDetailedReview: () => void;
  onConfirmScope?: () => void;
  onRegenerate: () => void;
};

const STATUS_COLORS = {
  ready: { bg: 'rgba(34, 197, 94, 0.14)', color: '#4ade80' },
  mostly: { bg: 'rgba(45, 255, 196, 0.1)', color: '#2DFFC4' },
  review: { bg: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' },
};

/** Muted teal→blue wash — same angle as back arrow, much lower opacity than the ring. */
const HERO_GRADIENT_DARK = ['rgba(45, 255, 196, 0.05)', 'rgba(0, 166, 255, 0.035)'] as const;
const HERO_GRADIENT_LIGHT = ['rgba(45, 255, 196, 0.07)', 'rgba(0, 166, 255, 0.04)'] as const;
const HERO_BG_DARK = '#0e141c';
/** Brand cyan — links, totals, secondary accents (blue end of back-arrow gradient). */
const BRAND_ACCENT = '#00A6FF';
const BRAND_ACCENT_LIGHT = '#0284c7';
/** Emerald — primary CTA only. */
const FLOW_ACCENT = '#22c55e';

function fireHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(style).catch(() => {});
}

function AIEstimateInitialRevealModal({
  visible,
  draft,
  markupPct = 0,
  fromAssistant = false,
  onBack,
  onClose,
  onOpenDetailedReview,
  onConfirmScope,
  onRegenerate,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [confirmListExpanded, setConfirmListExpanded] = useState(false);

  const viewModel = useMemo(() => {
    if (!draft) return null;

    const attentionCount = countInitialRevealAttentionItems(draft);
    const totals = getInitialRevealTotals(draft, markupPct);
    const needsScopeConfirmation = draftNeedsScopeConfirmation(draft);
    const allConfirmItems = getInitialRevealPriorityItems(draft, 50).items;
    const previewItems = getInitialRevealPriorityItems(draft, 3).items;

    return {
      attentionCount,
      status: getInitialRevealStatusLabel(draft, attentionCount),
      totals,
      understood: getInitialRevealUnderstoodBullets(draft, 2),
      allConfirmItems,
      previewItems,
      displayTitle: getInitialRevealDisplayTitle(draft),
      tagline: getInitialRevealTagline(draft),
      needsScopeConfirmation,
      primaryCta: getInitialRevealPrimaryCtaLabel(attentionCount, needsScopeConfirmation),
      hero: getInitialRevealHeroDisplay(totals, needsScopeConfirmation),
      scopePreview: getScopePackagesForReview(draft).slice(0, 6).map((pkg) => {
        const name = String(pkg.name || pkg.scope || 'Scope item').trim();
        const amount = scopePackagePricedAmount(pkg, draft);
        return { name, amount };
      }),
    };
  }, [draft, markupPct]);

  const brandAccent = darkMode ? BRAND_ACCENT : BRAND_ACCENT_LIGHT;
  const flowCardStyle = useMemo(
    () => estimateFlowCardStyle(Colors, darkMode),
    [Colors, darkMode]
  );
  const dividerColor = estimateFlowDividerColor(darkMode);
  const flowCardBg = aiFlowCardBackground(darkMode, Colors.surface2);
  const hiddenConfirmCount = viewModel
    ? Math.max(0, viewModel.allConfirmItems.length - viewModel.previewItems.length)
    : 0;
  const visibleConfirmItems = viewModel
    ? confirmListExpanded
      ? viewModel.allConfirmItems
      : viewModel.previewItems
    : [];

  useEffect(() => {
    if (visible) {
      setConfirmListExpanded(false);
      setDetailsExpanded(false);
    }
  }, [visible]);

  const handleBack = useCallback(() => {
    fireHaptic(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handlePrimary = useCallback(() => {
    fireHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (viewModel?.needsScopeConfirmation && onConfirmScope) {
      onConfirmScope();
      return;
    }
    onOpenDetailedReview();
  }, [viewModel?.needsScopeConfirmation, onConfirmScope, onOpenDetailedReview]);

  const handleDetailed = useCallback(() => {
    fireHaptic(Haptics.ImpactFeedbackStyle.Light);
    onOpenDetailedReview();
  }, [onOpenDetailedReview]);

  const handleExpandConfirm = useCallback(() => {
    fireHaptic(Haptics.ImpactFeedbackStyle.Light);
    startTransition(() => setConfirmListExpanded(true));
  }, []);

  const handleCollapseConfirm = useCallback(() => {
    startTransition(() => setConfirmListExpanded(false));
  }, []);

  const handleToggleScope = useCallback(() => {
    fireHaptic(Haptics.ImpactFeedbackStyle.Light);
    startTransition(() => setDetailsExpanded((v) => !v));
  }, []);

  const scrollPaddingBottom = useMemo(
    () => Math.max(insets.bottom, 16) + 108,
    [insets.bottom]
  );

  if (!visible) return null;

  const statusStyle = viewModel ? STATUS_COLORS[viewModel.status.tone] : STATUS_COLORS.mostly;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBack}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={[styles.screen, { backgroundColor: Colors.bg }]}>
        <AIEstimateFlowHeader
          title="Initial estimate"
          subtitle={
            viewModel?.needsScopeConfirmation
              ? 'Your first look — confirm scope to refine the number'
              : 'Quick summary before detailed review'
          }
          fromAssistant={fromAssistant}
          onBack={handleBack}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!viewModel ? (
            <Text style={{ color: Colors.sub, fontSize: 14 }}>No draft to show.</Text>
          ) : (
            <>
              <LinearGradient
                colors={darkMode ? HERO_GRADIENT_DARK : HERO_GRADIENT_LIGHT}
                start={BRAND_FRAME_GRADIENT_START}
                end={BRAND_FRAME_GRADIENT_END}
                style={[
                  styles.heroShell,
                  { backgroundColor: darkMode ? HERO_BG_DARK : Colors.bg },
                ]}
              >
                <View style={styles.heroTopRow}>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                      {viewModel.status.label}
                    </Text>
                  </View>
                  <Text style={[styles.metaText, { color: Colors.sub }]}>
                    {viewModel.totals.scopeItemCount} items
                  </Text>
                </View>

                <Text style={[styles.projectTitle, { color: Colors.text }]} numberOfLines={2}>
                  {viewModel.displayTitle}
                </Text>
                {viewModel.tagline ? (
                  <Text style={[styles.tagline, { color: Colors.sub }]} numberOfLines={2}>
                    {viewModel.tagline}
                  </Text>
                ) : null}

                <Text
                  style={[
                    styles.heroTotal,
                    {
                      color: viewModel.hero.hasAmount ? brandAccent : Colors.sub,
                      fontSize: viewModel.hero.hasAmount ? 44 : 36,
                    },
                  ]}
                >
                  {viewModel.hero.amountText}
                </Text>
                <Text style={[styles.heroHint, { color: Colors.sub }]}>{viewModel.hero.hint}</Text>

                {viewModel.hero.hasAmount &&
                (viewModel.totals.material != null ||
                  viewModel.totals.labor != null ||
                  viewModel.totals.allowance != null) ? (
                  <View style={styles.statsRow}>
                    {viewModel.totals.material != null ? (
                      <StatChip
                        label="Materials"
                        value={formatDraftMoney(viewModel.totals.material)}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                    ) : null}
                    {viewModel.totals.labor != null ? (
                      <StatChip
                        label="Labor"
                        value={formatDraftMoney(viewModel.totals.labor)}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                    ) : null}
                    {viewModel.totals.allowance != null ? (
                      <StatChip
                        label="Allowances"
                        value={formatDraftMoney(viewModel.totals.allowance)}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                    ) : null}
                  </View>
                ) : null}
              </LinearGradient>

              {!viewModel.needsScopeConfirmation ? (
                <View style={styles.modeToggleRow}>
                  <View
                    style={[
                      styles.modePill,
                      {
                        backgroundColor: darkMode ? 'rgba(0, 166, 255, 0.1)' : 'rgba(0, 166, 255, 0.08)',
                        borderColor: darkMode ? 'rgba(0, 166, 255, 0.28)' : 'rgba(0, 166, 255, 0.22)',
                      },
                    ]}
                  >
                    <Text style={[styles.modePillText, { color: brandAccent }]}>Quick review</Text>
                  </View>
                  <Pressable
                    onPress={handleDetailed}
                    style={({ pressed }) => [
                      styles.modePill,
                      { borderColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line },
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Open detailed review"
                  >
                    <Text style={[styles.modePillText, { color: Colors.sub }]}>Detailed review</Text>
                  </Pressable>
                </View>
              ) : null}

              <View
                style={[
                  styles.contentCard,
                  flowCardStyle,
                  { padding: 0, backgroundColor: flowCardBg },
                ]}
              >
                {viewModel.understood.length > 0 ? (
                  <View style={styles.block}>
                    <Text style={[styles.blockTitle, { color: Colors.text }]}>What we found</Text>
                    {viewModel.understood.map((line) => (
                      <Text key={line} style={[styles.bodyLine, { color: Colors.sub }]}>
                        {line}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {visibleConfirmItems.length > 0 ? (
                  <View
                    style={[
                      styles.block,
                      viewModel.understood.length > 0 && styles.blockBorder,
                      { borderTopColor: dividerColor },
                    ]}
                  >
                    <View style={styles.blockTitleRow}>
                      <Text style={[styles.blockTitle, { color: Colors.text }]}>Next to confirm</Text>
                      {viewModel.attentionCount > 0 ? (
                        <View style={[styles.countPill, { backgroundColor: 'rgba(251, 191, 36, 0.14)' }]}>
                          <Text style={styles.countPillText}>{viewModel.attentionCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    {visibleConfirmItems.map((item, index) => (
                      <View key={`${item}-${index}`} style={styles.checkRow}>
                        <View style={[styles.checkDot, { borderColor: '#fbbf24' }]} />
                        <Text style={[styles.checkText, { color: Colors.text }]} numberOfLines={2}>
                          {item}
                        </Text>
                      </View>
                    ))}
                    {!confirmListExpanded && hiddenConfirmCount > 0 ? (
                      <Pressable
                        onPress={handleExpandConfirm}
                        style={({ pressed }) => [styles.moreLink, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={`Show ${hiddenConfirmCount} more items`}
                        hitSlop={8}
                      >
                        <Text style={[styles.moreLinkText, { color: brandAccent }]}>+{hiddenConfirmCount} more</Text>
                      </Pressable>
                    ) : null}
                    {confirmListExpanded && viewModel.allConfirmItems.length > 3 ? (
                      <Pressable
                        onPress={handleCollapseConfirm}
                        style={({ pressed }) => [styles.moreLink, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel="Show fewer items"
                        hitSlop={8}
                      >
                        <Text style={[styles.moreLinkText, { color: Colors.sub, fontWeight: '600' }]}>
                          Show less
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {viewModel.scopePreview.length > 0 ? (
                  <View
                    style={[
                      styles.block,
                      styles.blockBorder,
                      { borderTopColor: dividerColor },
                    ]}
                  >
                    <Pressable
                      onPress={handleToggleScope}
                      style={({ pressed }) => [styles.scopeHeader, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: detailsExpanded }}
                      hitSlop={4}
                    >
                      <Text style={[styles.blockTitle, { color: Colors.text }]}>
                        Scope · {viewModel.totals.scopeItemCount || viewModel.scopePreview.length} items
                      </Text>
                      <MaterialIcons
                        name={detailsExpanded ? 'expand-less' : 'expand-more'}
                        size={22}
                        color={Colors.sub}
                      />
                    </Pressable>
                    {detailsExpanded
                      ? viewModel.scopePreview.map(({ name, amount }) => (
                          <View key={name} style={styles.scopeRow}>
                            <Text style={[styles.scopeName, { color: Colors.text }]} numberOfLines={1}>
                              {name}
                            </Text>
                            <Text style={[styles.scopeAmount, { color: amount > 0 ? brandAccent : Colors.sub }]}>
                              {amount > 0 ? formatDraftMoney(amount) : '—'}
                            </Text>
                          </View>
                        ))
                      : null}
                  </View>
                ) : null}
              </View>
            </>
          )}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopColor: darkMode ? 'rgba(255,255,255,0.06)' : Colors.line,
              backgroundColor: Colors.bg,
            },
          ]}
        >
          <Pressable
            disabled={!draft}
            onPress={handlePrimary}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                opacity: draft ? (pressed ? 0.88 : 1) : 0.55,
              },
            ]}
          >
            <Text style={styles.primaryBtnText}>{viewModel?.primaryCta ?? 'Continue'}</Text>
            <MaterialIcons
              name={viewModel?.needsScopeConfirmation ? 'chevron-right' : 'arrow-forward'}
              size={22}
              color="#0f172a"
            />
          </Pressable>

          <View style={styles.secondaryRow}>
            <Pressable onPress={onRegenerate} style={({ pressed }) => pressed && styles.pressed} hitSlop={8}>
              <Text style={[styles.secondaryText, { color: Colors.sub }]}>Edit notes</Text>
            </Pressable>
            <Text style={[styles.secondaryDot, { color: Colors.sub }]}>·</Text>
            <Pressable onPress={onClose} style={({ pressed }) => pressed && styles.pressed} hitSlop={8}>
              <Text style={[styles.secondaryText, { color: Colors.sub }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StatChip({
  label,
  value,
  darkMode,
  Colors,
}: {
  label: string;
  value: string;
  darkMode: boolean;
  Colors: { text: string; sub: string };
}) {
  return (
    <View
      style={[
        styles.statChip,
        { backgroundColor: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.7)' },
      ]}
    >
      <Text style={[styles.statLabel, { color: Colors.sub }]}>{label}</Text>
      <Text style={[styles.statValue, { color: Colors.text }]}>{value}</Text>
    </View>
  );
}

export default memo(AIEstimateInitialRevealModal);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  pressed: {
    opacity: 0.72,
  },
  heroShell: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    marginHorizontal: -8,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  projectTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  tagline: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    fontWeight: '500',
  },
  heroTotal: {
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 14,
  },
  heroHint: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  statChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 96,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    marginHorizontal: -8,
  },
  modePill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  contentCard: {
    overflow: 'hidden',
    marginHorizontal: -8,
  },
  block: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  blockBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countPillText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
  },
  bodyLine: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  checkDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginTop: 2,
  },
  checkText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  moreLink: {
    marginTop: 2,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  moreLinkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scopeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  scopeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  scopeAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: FLOW_ACCENT,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryDot: {
    opacity: 0.5,
  },
});
